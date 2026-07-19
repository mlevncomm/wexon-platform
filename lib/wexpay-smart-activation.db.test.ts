import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { ActivationJourneySource, ActivationJourneyStatus } from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  ActivationJourneyError,
  assertWexPayPublicLiveReady,
  ensureActivationJourneyStarted,
  getActivationJourneyForOrg,
} from "@/lib/wexpay-activation-journey";
import {
  findActiveTableQrTokenByPlaintext,
  generateSecureTableQrTokenMaterial,
  hashTableQrToken,
  issueTableQrToken,
  revokeTableQrToken,
  rotateTableQrToken,
} from "@/lib/wexpay-table-qr-token";
import { resolvePublicTableByOpaqueToken, resolvePublicTableByQr } from "@/lib/wexpay-read";
import { EXPECTED_PUBLIC_TABLE_COUNT } from "@/lib/wexon-db-backup-guards";

assertLocalDbTestGuard(process.env);

describe("smart activation foundation (db)", () => {
  const suffix = randomUUID().slice(0, 8);
  let productId = "";
  let planId = "";
  let orgId = "";
  let demoOrgId = "";
  let otherOrgId = "";
  let restaurantId = "";
  let branchId = "";
  let tableId = "";
  let legacyQr = "";

  before(async () => {
    const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
    const plan = await prisma.plan.findFirst({
      where: { isActive: true, OR: [{ tierKey: "essential" }, { key: "wexpay_essential" }] },
    });
    if (!product || !plan) throw new Error("Seed required: wexpay + essential plan");
    productId = product.id;
    planId = plan.id;

    const org = await prisma.organization.create({
      data: {
        name: `ActJourney ${suffix}`,
        slug: `act-journey-${suffix}`,
        email: `act-journey-${suffix}@example.com`,
        isDemo: false,
        isActive: true,
      },
    });
    orgId = org.id;

    const demo = await prisma.organization.create({
      data: {
        name: `ActDemo ${suffix}`,
        slug: `act-demo-${suffix}`,
        email: `act-demo-${suffix}@example.com`,
        isDemo: true,
        isActive: true,
      },
    });
    demoOrgId = demo.id;

    const other = await prisma.organization.create({
      data: {
        name: `ActOther ${suffix}`,
        slug: `act-other-${suffix}`,
        email: `act-other-${suffix}@example.com`,
        isDemo: false,
        isActive: true,
      },
    });
    otherOrgId = other.id;

    await prisma.license.create({
      data: {
        organizationId: orgId,
        productId,
        planId,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(),
      },
    });
    await prisma.appInstallation.create({
      data: {
        organizationId: orgId,
        productId,
        status: "ACTIVE",
        settingsJson: { onboardingStatus: "PENDING_SETUP" },
      },
    });
    await prisma.activationFeeLedger.create({
      data: {
        organizationId: orgId,
        productId,
        planId,
        status: "PAID",
        activationFeeMinor: 2_000_000,
        paidAt: new Date(),
      },
    });

    // Demo has install+license+fee but must still be rejected.
    await prisma.license.create({
      data: {
        organizationId: demoOrgId,
        productId,
        planId,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(),
      },
    });
    await prisma.appInstallation.create({
      data: { organizationId: demoOrgId, productId, status: "ACTIVE" },
    });
    await prisma.activationFeeLedger.create({
      data: {
        organizationId: demoOrgId,
        productId,
        status: "WAIVED",
        activationFeeMinor: 0,
      },
    });

    const restaurant = await prisma.restaurant.create({
      data: {
        organizationId: orgId,
        name: `R ${suffix}`,
        slug: `r-act-${suffix}`,
      },
    });
    restaurantId = restaurant.id;
    const branch = await prisma.branch.create({
      data: {
        restaurantId,
        name: "Ana",
        slug: `b-act-${suffix}`,
      },
    });
    branchId = branch.id;
    legacyQr = `WXP-LEGACY-${suffix}`;
    const table = await prisma.restaurantTable.create({
      data: {
        branchId,
        label: "M1",
        qrCode: legacyQr,
        seats: 4,
      },
    });
    tableId = table.id;
  });

  after(async () => {
    for (const oid of [orgId, demoOrgId, otherOrgId]) {
      if (!oid) continue;
      await prisma.activationJourney.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.appInstallation.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.license.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.restaurant.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.organization.delete({ where: { id: oid } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it("starts journey idempotently and rejects concurrent second row", async () => {
    const first = await ensureActivationJourneyStarted({
      organizationId: orgId,
      source: ActivationJourneySource.SELF_SERVE,
    });
    assert.equal(first.status, ActivationJourneyStatus.IN_PROGRESS);
    assert.equal(first.steps.length, 8);

    const second = await ensureActivationJourneyStarted({ organizationId: orgId });
    assert.equal(second.id, first.id);

    await assert.rejects(
      () =>
        prisma.activationJourney.create({
          data: {
            organizationId: orgId,
            productId,
            status: "IN_PROGRESS",
            source: "SELF_SERVE",
            currentStep: "BUSINESS_PROFILE",
          },
        }),
      (err: unknown) =>
        typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002",
    );
  });

  it("rejects unsettled fee, demo, and wrong-tenant missing preconditions", async () => {
    await assert.rejects(
      () => ensureActivationJourneyStarted({ organizationId: otherOrgId }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "LICENSE_INACTIVE",
    );

    await assert.rejects(
      () => ensureActivationJourneyStarted({ organizationId: demoOrgId }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "DEMO_FORBIDDEN",
    );

    // Unsettled: other org with license+install but PENDING fee
    await prisma.license.create({
      data: {
        organizationId: otherOrgId,
        productId,
        planId,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(),
      },
    });
    await prisma.appInstallation.create({
      data: { organizationId: otherOrgId, productId, status: "ACTIVE" },
    });
    await prisma.activationFeeLedger.create({
      data: {
        organizationId: otherOrgId,
        productId,
        status: "PENDING",
        activationFeeMinor: 2_000_000,
      },
    });
    await assert.rejects(
      () => ensureActivationJourneyStarted({ organizationId: otherOrgId }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "FEE_UNSETTLED",
    );
  });

  it("legacy ACTIVE install shape maps to ACTIVE public live; READY does not", async () => {
    const journey = await getActivationJourneyForOrg(orgId);
    assert.ok(journey);
    assert.equal(await assertWexPayPublicLiveReady(orgId), false);

    // Simulate READY
    await prisma.activationJourney.update({
      where: { id: journey!.id },
      data: { status: ActivationJourneyStatus.READY },
    });
    assert.equal(await assertWexPayPublicLiveReady(orgId), false);
    let resolution = await resolvePublicTableByQr(legacyQr);
    assert.ok(resolution);
    assert.equal(resolution.allowed, false);

    await prisma.activationJourney.update({
      where: { id: journey!.id },
      data: {
        status: ActivationJourneyStatus.ACTIVE,
        source: ActivationJourneySource.LEGACY_BACKFILL,
        completedAt: new Date(),
      },
    });
    assert.equal(await assertWexPayPublicLiveReady(orgId), true);
    resolution = await resolvePublicTableByQr(legacyQr);
    assert.ok(resolution);
    assert.equal(resolution.allowed, true);
    assert.equal(resolution.organizationId, orgId);
  });

  it("issues/rotates/revokes secure QR without storing raw token; opaque resolve works", async () => {
    const issued = await issueTableQrToken({ tableId, organizationId: orgId });
    assert.ok(issued.plaintext.length >= 43);
    assert.equal(issued.token.tokenHash, hashTableQrToken(issued.plaintext));
    assert.ok(!JSON.stringify(issued.token).includes(issued.plaintext));

    const dbRow = await prisma.tableQrToken.findUnique({ where: { id: issued.token.id } });
    assert.ok(dbRow);
    assert.equal(dbRow!.tokenHash, issued.token.tokenHash);
    assert.notEqual(dbRow!.tokenHash, issued.plaintext);

    const found = await findActiveTableQrTokenByPlaintext(issued.plaintext);
    assert.ok(found);
    assert.equal(found!.id, issued.token.id);

    let opaque = await resolvePublicTableByOpaqueToken(issued.plaintext);
    assert.ok(opaque);
    assert.equal(opaque!.allowed, true);
    assert.equal(opaque!.table.id, tableId);

    const rotated = await rotateTableQrToken({ tableId, organizationId: orgId });
    assert.notEqual(rotated.plaintext, issued.plaintext);
    const oldActive = await findActiveTableQrTokenByPlaintext(issued.plaintext);
    assert.equal(oldActive, null);
    opaque = await resolvePublicTableByOpaqueToken(issued.plaintext);
    assert.equal(opaque, null);
    opaque = await resolvePublicTableByOpaqueToken(rotated.plaintext);
    assert.ok(opaque?.allowed);

    const audits = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        action: { in: ["wexpay.qr.issued", "wexpay.qr.rotated", "wexpay.qr.revoked"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    for (const audit of audits) {
      const blob = JSON.stringify(audit.metadataJson ?? {});
      assert.ok(!blob.includes(issued.plaintext));
      assert.ok(!blob.includes(rotated.plaintext));
    }

    await revokeTableQrToken({ tableId, organizationId: orgId });
    opaque = await resolvePublicTableByOpaqueToken(rotated.plaintext);
    assert.equal(opaque, null);

    // Legacy /wexpay/t still works while journey ACTIVE
    const legacy = await resolvePublicTableByQr(legacyQr);
    assert.ok(legacy?.allowed);
  });

  it("public schema has 37 tables and new tables have RLS", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string; rls: boolean }>>`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;
    assert.equal(tables.length, EXPECTED_PUBLIC_TABLE_COUNT);
    assert.equal(EXPECTED_PUBLIC_TABLE_COUNT, 37);

    for (const name of ["ActivationJourney", "ActivationJourneyStep", "TableQrToken"]) {
      const row = tables.find((t) => t.table_name === name);
      assert.ok(row, `${name} must exist`);
      assert.equal(row!.rls, true);
    }

    // Partial unique: second ACTIVE token for same table must fail
    const materialA = generateSecureTableQrTokenMaterial();
    await prisma.tableQrToken.create({
      data: {
        tableId,
        tokenHash: materialA.tokenHash,
        tokenPrefix: materialA.tokenPrefix,
        status: "ACTIVE",
      },
    });
    const materialB = generateSecureTableQrTokenMaterial();
    await assert.rejects(
      () =>
        prisma.tableQrToken.create({
          data: {
            tableId,
            tokenHash: materialB.tokenHash,
            tokenPrefix: materialB.tokenPrefix,
            status: "ACTIVE",
          },
        }),
      (err: unknown) =>
        typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002",
    );
  });
});
