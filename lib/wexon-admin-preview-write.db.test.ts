/**
 * DB-backed admin preview write-control tests (PR3).
 * Gated by assertLocalDbTestGuard — remote/prod targets fail closed.
 *
 * Service hard-deny cases call real production service functions
 * (not only evaluate* helpers) and assert DB unchanged on deny.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PaymentStatus } from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  __setAdminPreviewMutationAuditWriterForTests,
  createBranch,
  createRestaurant,
  updatePayment,
  type WexPayMutationContext,
} from "@/lib/wexpay-service";
import { WexPayAccessError } from "@/lib/wexpay-tenant";
import {
  buildAdminPreviewWriteCapability,
  evaluateAdminPreviewDisableRequest,
  evaluateAdminPreviewWriteGate,
  hashPreviewWriteReason,
  validatePreviewWriteEnableInput,
  writeAdminPreviewMutationAuditInTransaction,
} from "@/lib/wexon-admin-preview-write";
import { writeAuditLog } from "@/lib/wexon-audit";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);
const createdOrgIds: string[] = [];
const createdRestaurantIds: string[] = [];

const ADMIN_ID = "admin_1";
const ADMIN_SUBJECT = "cf-1";
const ADMIN_EMAIL = `preview+${suffix}@wexon.test`;

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

function adminContext(
  organizationId: string,
  canManage: boolean,
  adminPreviewWrite?: WexPayMutationContext["adminPreviewWrite"],
  actorOverrides: Partial<{
    adminId: string;
    email: string;
    cloudflareSubject: string;
  }> = {},
): WexPayMutationContext {
  return {
    organizationId,
    canManage,
    entitlementMap: {
      table_limit: 50,
      branch_limit: 10,
      product_limit: 500,
      feature_multi_location: true,
    },
    actor: {
      type: "admin_session",
      email: actorOverrides.email ?? ADMIN_EMAIL,
      role: "ADMIN",
      adminId: actorOverrides.adminId ?? ADMIN_ID,
      cloudflareSubject: actorOverrides.cloudflareSubject ?? ADMIN_SUBJECT,
    },
    ipAddress: "127.0.0.1",
    adminPreviewWrite: adminPreviewWrite ?? null,
  };
}

function customerContext(
  organizationId: string,
  userId: string,
  role: "OWNER" | "ADMIN" | "MANAGER" | "STAFF" = "OWNER",
): WexPayMutationContext {
  return {
    organizationId,
    canManage: role === "STAFF" ? false : true,
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
      role,
    },
    ipAddress: "127.0.0.1",
  };
}

function previewBinding(
  organizationId: string,
  actionKey: string,
  reason = "db regression support reason",
  extras: Partial<NonNullable<WexPayMutationContext["adminPreviewWrite"]>> = {},
) {
  return withSecret(() => {
    const capability = buildAdminPreviewWriteCapability({
      adminId: ADMIN_ID,
      cloudflareSubject: ADMIN_SUBJECT,
      organizationId,
      reason,
    });
    return {
      actionKey,
      organizationId,
      adminId: ADMIN_ID,
      email: ADMIN_EMAIL,
      cloudflareSubject: ADMIN_SUBJECT,
      reasonHash: capability.reasonHash,
      writeSessionId: capability.writeSessionId,
      writeModeExpiry: capability.expiresAt,
      ...extras,
    };
  });
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
    __setAdminPreviewMutationAuditWriterForTests(null);
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

  it("service hard-deny: admin_session canManage=true without binding is denied and DB unchanged", async () => {
    const before = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    await assert.rejects(
      () =>
        createRestaurant(adminContext(orgA.id, true, null), {
          name: `NoBind ${suffix}`,
          slug: `no-bind-${suffix}`,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    const after = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    assert.equal(after, before);
    const leaked = await prisma.restaurant.findFirst({
      where: { organizationId: orgA.id, slug: `no-bind-${suffix}` },
    });
    assert.equal(leaked, null);
  });

  it("service hard-deny: Org A binding + Org B context is denied and DB unchanged", async () => {
    const beforeB = await prisma.restaurant.count({ where: { organizationId: orgB.id } });
    const binding = previewBinding(orgA.id, "create_restaurant");
    await assert.rejects(
      () =>
        createRestaurant(adminContext(orgB.id, true, binding), {
          name: `CrossOrg ${suffix}`,
          slug: `cross-org-${suffix}`,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    const afterB = await prisma.restaurant.count({ where: { organizationId: orgB.id } });
    assert.equal(afterB, beforeB);
    const leaked = await prisma.restaurant.findFirst({
      where: { organizationId: orgB.id, slug: `cross-org-${suffix}` },
    });
    assert.equal(leaked, null);
  });

  it("service hard-deny: create_restaurant binding cannot call create_branch (action mismatch)", async () => {
    const restaurant = await createRestaurant(
      adminContext(orgA.id, true, previewBinding(orgA.id, "create_restaurant")),
      {
        name: `Mismatch Host ${suffix}`,
        slug: `mismatch-host-${suffix}`,
      },
    );
    createdRestaurantIds.push(restaurant.id);

    const beforeBranches = await prisma.branch.count({
      where: { restaurant: { organizationId: orgA.id } },
    });
    await assert.rejects(
      () =>
        createBranch(adminContext(orgA.id, true, previewBinding(orgA.id, "create_restaurant")), {
          restaurantId: restaurant.id,
          name: `Mismatch Branch ${suffix}`,
          slug: `mismatch-branch-${suffix}`,
          address: null,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    const afterBranches = await prisma.branch.count({
      where: { restaurant: { organizationId: orgA.id } },
    });
    assert.equal(afterBranches, beforeBranches);
  });

  it("service hard-deny: create_restaurant binding cannot call update_payment (action mismatch)", async () => {
    await assert.rejects(
      () =>
        updatePayment(adminContext(orgA.id, true, previewBinding(orgA.id, "create_restaurant")), {
          paymentId: randomUUID(),
          status: PaymentStatus.PAID,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
  });

  it("service hard-deny: expired binding is denied and DB unchanged", async () => {
    const before = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    const binding = previewBinding(orgA.id, "create_restaurant", "expired binding reason", {
      writeModeExpiry: Date.now() - 1_000,
    });
    await assert.rejects(
      () =>
        createRestaurant(adminContext(orgA.id, true, binding), {
          name: `Expired ${suffix}`,
          slug: `expired-${suffix}`,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    const after = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    assert.equal(after, before);
  });

  it("service hard-deny: actor adminId mismatch is denied and DB unchanged", async () => {
    const before = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    const binding = previewBinding(orgA.id, "create_restaurant");
    await assert.rejects(
      () =>
        createRestaurant(adminContext(orgA.id, true, binding, { adminId: "other-admin" }), {
          name: `AdminIdMismatch ${suffix}`,
          slug: `adminid-mismatch-${suffix}`,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    assert.equal(await prisma.restaurant.count({ where: { organizationId: orgA.id } }), before);
  });

  it("service hard-deny: actor cloudflareSubject mismatch is denied and DB unchanged", async () => {
    const before = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    const binding = previewBinding(orgA.id, "create_restaurant");
    await assert.rejects(
      () =>
        createRestaurant(
          adminContext(orgA.id, true, binding, { cloudflareSubject: "other-subject" }),
          {
            name: `SubjectMismatch ${suffix}`,
            slug: `subject-mismatch-${suffix}`,
          },
        ),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    assert.equal(await prisma.restaurant.count({ where: { organizationId: orgA.id } }), before);
  });

  it("service hard-deny: actor email mismatch is denied and DB unchanged", async () => {
    const before = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    const binding = previewBinding(orgA.id, "create_restaurant");
    await assert.rejects(
      () =>
        createRestaurant(
          adminContext(orgA.id, true, binding, { email: `other+${suffix}@wexon.test` }),
          {
            name: `EmailMismatch ${suffix}`,
            slug: `email-mismatch-${suffix}`,
          },
        ),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    assert.equal(await prisma.restaurant.count({ where: { organizationId: orgA.id } }), before);
  });

  it("production-path createRestaurant audit failure rolls back domain mutation", async () => {
    const before = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    const binding = previewBinding(orgA.id, "create_restaurant", "rollback reason path");
    __setAdminPreviewMutationAuditWriterForTests(async () => {
      throw new Error("audit_failed");
    });

    try {
      await assert.rejects(
        () =>
          createRestaurant(adminContext(orgA.id, true, binding), {
            name: `AuditFail Real ${suffix}`,
            slug: `audit-fail-real-${suffix}`,
          }),
        (error: unknown) => error instanceof Error && error.message.includes("audit_failed"),
      );
    } finally {
      __setAdminPreviewMutationAuditWriterForTests(null);
    }

    const after = await prisma.restaurant.count({ where: { organizationId: orgA.id } });
    assert.equal(after, before);
    const leaked = await prisma.restaurant.findFirst({
      where: { organizationId: orgA.id, slug: `audit-fail-real-${suffix}` },
    });
    assert.equal(leaked, null);

    const previewAudits = await prisma.auditLog.findMany({
      where: { organizationId: orgA.id, action: "admin.preview.write" },
    });
    assert.equal(
      previewAudits.filter((row) => {
        const meta = (row.metadataJson ?? {}) as Record<string, unknown>;
        return meta.actionKey === "create_restaurant" && meta.writeSessionId === binding.writeSessionId;
      }).length,
      0,
    );
  });

  it("production-path createRestaurant + admin.preview.write succeed in same transaction", async () => {
    const reason = "successful atomic write reason";
    const binding = previewBinding(orgA.id, "create_restaurant", reason);
    const restaurant = await createRestaurant(adminContext(orgA.id, true, binding), {
      name: `Atomic Ok ${suffix}`,
      slug: `atomic-ok-${suffix}`,
    });
    createdRestaurantIds.push(restaurant.id);

    const found = await prisma.restaurant.findUnique({ where: { id: restaurant.id } });
    assert.ok(found);

    const row = await prisma.auditLog.findFirst({
      where: { organizationId: orgA.id, action: "admin.preview.write" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(row);
    const meta = (row!.metadataJson ?? {}) as Record<string, unknown>;
    assert.equal(meta.actionKey, "create_restaurant");
    assert.equal(meta.reasonHash, hashPreviewWriteReason(reason));
    assert.equal(meta.writeSessionId, binding.writeSessionId);
    assert.equal(meta.organizationId, orgA.id);
    assert.equal(meta.writeModeExpiry, binding.writeModeExpiry);
    assert.equal(meta.jwt, undefined);
    assert.equal(meta.cloudflareSubject, undefined);
  });

  it("Org A capability denies Org B mutation at gate", async () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
        organizationId: orgA.id,
        reason: "support write window",
      });
      const forB = evaluateAdminPreviewWriteGate({
        capability,
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
        organizationId: orgB.id,
        organization: { isActive: true, isDemo: false },
      });
      assert.equal(forB.ok, false);
      if (!forB.ok) assert.equal(forB.reason, "capability_mismatch");
    });
  });

  it("Org A capability + Org B disable request denied", async () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
        organizationId: orgA.id,
        reason: "support write window",
      });
      const decision = evaluateAdminPreviewDisableRequest({
        formOrganizationId: orgB.id,
        capability,
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
      });
      assert.equal(decision.ok, false);
      if (!decision.ok) {
        assert.equal(decision.reason, "capability_mismatch");
        assert.equal(decision.clearCookie, false);
        assert.equal(decision.auditOrganizationId, orgA.id);
      }
    });
  });

  it("demo write enable gate always denied", async () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
        organizationId: demoOrg.id,
        reason: "attempt demo write",
      });
      const gate = evaluateAdminPreviewWriteGate({
        capability,
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
        organizationId: demoOrg.id,
        organization: { isActive: true, isDemo: true },
      });
      assert.equal(gate.ok, false);
      if (!gate.ok) assert.equal(gate.reason, "organization_demo");
    });
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

  it("inactive organization denied", async () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
        organizationId: inactiveOrg.id,
        reason: "support write window",
      });
      const gate = evaluateAdminPreviewWriteGate({
        capability,
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
        organizationId: inactiveOrg.id,
        organization: { isActive: false, isDemo: false },
      });
      assert.equal(gate.ok, false);
      if (!gate.ok) assert.equal(gate.reason, "organization_inactive");
    });
  });

  it("customer OWNER/ADMIN/MANAGER mutations still work; STAFF manage denied", async () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER"] as const) {
      const restaurant = await createRestaurant(customerContext(orgA.id, customerUserId, role), {
        name: `Customer ${role} ${suffix}`,
        slug: `customer-${role.toLowerCase()}-${suffix}`,
      });
      createdRestaurantIds.push(restaurant.id);
    }

    await assert.rejects(
      () =>
        createRestaurant(customerContext(orgA.id, customerUserId, "STAFF"), {
          name: `Customer STAFF ${suffix}`,
          slug: `customer-staff-${suffix}`,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
  });

  it("write_enabled audit metadata carries sanitized reason + linkage fields", async () => {
    const reason = "db test enable reason";
    const capability = withSecret(() =>
      buildAdminPreviewWriteCapability({
        adminId: ADMIN_ID,
        cloudflareSubject: ADMIN_SUBJECT,
        organizationId: orgA.id,
        reason,
      }),
    );
    await writeAuditLog({
      action: "admin.preview.write_enabled",
      organizationId: orgA.id,
      entityType: "Organization",
      entityId: orgA.id,
      source: "admin_preview_write",
      metadata: {
        adminId: ADMIN_ID,
        emailMasked: "a***@wexon.dev",
        actionKey: "enable_write",
        reason,
        reasonHash: capability.reasonHash,
        writeSessionId: capability.writeSessionId,
        organizationId: orgA.id,
        writeModeExpiry: capability.expiresAt,
      },
    });
    const row = await prisma.auditLog.findFirst({
      where: { organizationId: orgA.id, action: "admin.preview.write_enabled" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(row);
    const meta = (row!.metadataJson ?? {}) as Record<string, unknown>;
    assert.equal(meta.reason, reason);
    assert.equal(meta.reasonHash, capability.reasonHash);
    assert.equal(meta.writeSessionId, capability.writeSessionId);
    assert.equal(meta.organizationId, orgA.id);
    assert.equal(meta.cloudflareSubject, undefined);
    assert.equal(meta.jwt, undefined);
    assert.equal(meta.password, undefined);
  });

  it("writeAdminPreviewMutationAuditInTransaction writes on provided client", async () => {
    const binding = previewBinding(orgA.id, "update_restaurant", "client tx linkage");
    await prisma.$transaction(async (tx) => {
      await writeAdminPreviewMutationAuditInTransaction(tx, {
        organizationId: orgA.id,
        binding,
      });
    });
    const row = await prisma.auditLog.findFirst({
      where: {
        organizationId: orgA.id,
        action: "admin.preview.write",
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(row);
    const meta = (row!.metadataJson ?? {}) as Record<string, unknown>;
    assert.equal(meta.writeSessionId, binding.writeSessionId);
    assert.equal(meta.reasonHash, binding.reasonHash);
    assert.equal(meta.actionKey, "update_restaurant");
  });
});
