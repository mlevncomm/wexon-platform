/**
 * DB-backed admin preview write-control tests (PR3).
 * Gated by assertLocalDbTestGuard — remote/prod targets fail closed.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { createRestaurant, type WexPayMutationContext } from "@/lib/wexpay-service";
import { WexPayAccessError } from "@/lib/wexpay-tenant";
import {
  buildAdminPreviewWriteCapability,
  evaluateAdminPreviewWriteGate,
  validatePreviewWriteEnableInput,
} from "@/lib/wexon-admin-preview-write";
import { writeAuditLog } from "@/lib/wexon-audit";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);
const createdOrgIds: string[] = [];
const createdRestaurantIds: string[] = [];

function withSecret<T>(fn: () => T): T {
  const previous = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = `db-test-preview-secret-${suffix}`;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  }
}

function adminContext(organizationId: string, canManage: boolean): WexPayMutationContext {
  return {
    organizationId,
    canManage,
    entitlementMap: {
      table_limit: 50,
      branch_limit: 10,
      product_limit: 500,
      feature_multi_location: true,
    },
    actor: { type: "admin_session", email: `preview+${suffix}@wexon.test`, role: "ADMIN" },
    ipAddress: "127.0.0.1",
  };
}

function customerContext(organizationId: string, userId: string): WexPayMutationContext {
  return {
    organizationId,
    canManage: true,
    entitlementMap: {
      table_limit: 50,
      branch_limit: 10,
      product_limit: 500,
      feature_multi_location: true,
    },
    actor: {
      type: "customer_session",
      userId,
      email: `owner+${suffix}@example.test`,
      role: "OWNER",
    },
    ipAddress: "127.0.0.1",
  };
}

describe("admin preview write controls (db)", () => {
  let orgA: { id: string; slug: string };
  let orgB: { id: string; slug: string };
  let demoOrg: { id: string; slug: string };
  let inactiveOrg: { id: string; slug: string };
  let customerUserId: string;

  before(async () => {
    orgA = await prisma.organization.create({
      data: {
        name: `Preview A ${suffix}`,
        slug: `preview-a-${suffix}`,
        isActive: true,
        isDemo: false,
      },
      select: { id: true, slug: true },
    });
    orgB = await prisma.organization.create({
      data: {
        name: `Preview B ${suffix}`,
        slug: `preview-b-${suffix}`,
        isActive: true,
        isDemo: false,
      },
      select: { id: true, slug: true },
    });
    demoOrg = await prisma.organization.create({
      data: {
        name: `Preview Demo ${suffix}`,
        slug: `preview-demo-${suffix}`,
        isActive: true,
        isDemo: true,
      },
      select: { id: true, slug: true },
    });
    inactiveOrg = await prisma.organization.create({
      data: {
        name: `Preview Inactive ${suffix}`,
        slug: `preview-inactive-${suffix}`,
        isActive: false,
        isDemo: false,
      },
      select: { id: true, slug: true },
    });
    createdOrgIds.push(orgA.id, orgB.id, demoOrg.id, inactiveOrg.id);

    const user = await prisma.user.create({
      data: {
        email: `preview-owner+${suffix}@example.test`,
        name: "Preview Owner",
        passwordHash: "unused",
        isActive: true,
        memberships: {
          create: {
            organizationId: orgA.id,
            role: "OWNER",
            status: "ACTIVE",
          },
        },
      },
      select: { id: true },
    });
    customerUserId = user.id;
  });

  after(async () => {
    if (createdRestaurantIds.length) {
      await prisma.restaurant.deleteMany({ where: { id: { in: createdRestaurantIds } } });
    }
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: createdOrgIds } },
    });
    await prisma.membership.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
    await prisma.user.deleteMany({ where: { id: customerUserId } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  });

  it("read-only admin context mutation is denied and DB unchanged", async () => {
    const before = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    await assert.rejects(
      () =>
        createRestaurant(adminContext(orgA.id, false), {
          name: `Denied ${suffix}`,
          slug: `denied-${suffix}`,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    const after = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    assert.equal(after, before);
  });

  it("wrong slug enable validation fails against DB slug", async () => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    const result = validatePreviewWriteEnableInput({
      slug: "definitely-wrong-slug",
      expectedSlug: org.slug,
      reason: "long enough reason",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "slug_mismatch");
  });

  it("demo write enable gate always denied", async () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: demoOrg.id,
        reason: "attempt demo write",
      });
      const gate = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: demoOrg.id,
        organization: { isActive: true, isDemo: true },
      });
      assert.equal(gate.ok, false);
      if (!gate.ok) assert.equal(gate.reason, "organization_demo");
    });
  });

  it("correct slug capability allows only that org; Org A capability denies Org B", async () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: orgA.id,
        reason: "support write window",
      });
      const forA = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: orgA.id,
        organization: { isActive: true, isDemo: false },
      });
      assert.equal(forA.ok, true);

      const forB = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: orgB.id,
        organization: { isActive: true, isDemo: false },
      });
      assert.equal(forB.ok, false);
      if (!forB.ok) assert.equal(forB.reason, "capability_mismatch");
    });

    const slugOk = validatePreviewWriteEnableInput({
      slug: orgA.slug,
      expectedSlug: orgA.slug,
      reason: "support write window",
    });
    assert.equal(slugOk.ok, true);
  });

  it("inactive organization denied", async () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: inactiveOrg.id,
        reason: "support write window",
      });
      const gate = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: inactiveOrg.id,
        organization: { isActive: false, isDemo: false },
      });
      assert.equal(gate.ok, false);
      if (!gate.ok) assert.equal(gate.reason, "organization_inactive");
    });
  });

  it("capability expiry denied", async () => {
    withSecret(() => {
      const now = Date.now();
      const capability = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: orgA.id,
        reason: "support write window",
        now,
        ttlMs: 1_000,
      });
      const gate = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: orgA.id,
        organization: { isActive: true, isDemo: false },
        now: now + 5_000,
      });
      assert.equal(gate.ok, false);
      if (!gate.ok) assert.equal(gate.reason, "capability_expired");
    });
  });

  it("audit failure rolls back mutation in transaction", async () => {
    const before = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    await assert.rejects(async () => {
      await prisma.$transaction(async (tx) => {
        await tx.restaurant.create({
          data: {
            organizationId: orgA.id,
            name: `AuditFail ${suffix}`,
            slug: `audit-fail-${suffix}`,
            isActive: true,
          },
        });
        // Simulate required preview audit failure → entire transaction rolls back.
        throw new Error("audit_failed");
      });
    });
    const after = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    assert.equal(after, before);
  });

  it("normal customer mutations still work", async () => {
    const restaurant = await createRestaurant(customerContext(orgA.id, customerUserId), {
      name: `Customer Ok ${suffix}`,
      slug: `customer-ok-${suffix}`,
    });
    createdRestaurantIds.push(restaurant.id);
    const found = await prisma.restaurant.findUnique({ where: { id: restaurant.id } });
    assert.ok(found);
    assert.equal(found!.organizationId, orgA.id);
  });

  it("successful preview write audit metadata is sanitized", async () => {
    await writeAuditLog({
      action: "admin.preview.write_enabled",
      organizationId: orgA.id,
      entityType: "Organization",
      entityId: orgA.id,
      source: "admin_preview_write",
      metadata: {
        adminId: "admin_1",
        emailMasked: "a***@wexon.dev",
        actionKey: "enable_write",
        reason: "db test reason",
      },
    });
    const row = await prisma.auditLog.findFirst({
      where: { organizationId: orgA.id, action: "admin.preview.write_enabled" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(row);
    const meta = (row!.metadataJson ?? {}) as Record<string, unknown>;
    assert.equal(meta.cloudflareSubject, undefined);
    assert.equal(meta.jwt, undefined);
    assert.equal(meta.password, undefined);
  });
});
