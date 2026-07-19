import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { ActivationJourneySource, ActivationJourneyStatus } from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  ActivationJourneyError,
  ACTIVATION_UI_NOT_STARTED,
  assertWexPayPublicLiveReady,
  getActivationJourneyForOrg,
  loadOrStartActivationJourneyView,
  startSelfServeActivationJourney,
} from "@/lib/wexpay-activation-journey";
import {
  findActiveTableQrTokenByPlaintext,
  generateSecureTableQrTokenMaterial,
  hashTableQrToken,
  issueTableQrToken,
  revokeTableQrToken,
  rotateTableQrToken,
  touchTableQrTokenLastUsed,
} from "@/lib/wexpay-table-qr-token";
import { hashPublicQrKey } from "@/lib/wexpay-public-qr-audit";
import { resolvePublicTableByOpaqueToken, resolvePublicTableByQr } from "@/lib/wexpay-read";
import { EXPECTED_PUBLIC_TABLE_COUNT } from "@/lib/wexon-db-backup-guards";
import { writeAuditFailure } from "@/lib/wexon-audit";

assertLocalDbTestGuard(process.env);

describe("smart activation foundation (db)", () => {
  const suffix = randomUUID().slice(0, 8);
  let productId = "";
  let planId = "";
  let orgA = "";
  let orgB = "";
  let userA = "";
  let userB = "";
  let restaurantId = "";
  let branchId = "";
  let tableId = "";
  let legacyQr = "";

  async function seedOrg(label: string) {
    const org = await prisma.organization.create({
      data: {
        name: `${label} ${suffix}`,
        slug: `${label.toLowerCase()}-${suffix}`,
        email: `${label.toLowerCase()}-${suffix}@example.com`,
        isDemo: false,
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `${label.toLowerCase()}-user-${suffix}@example.com`,
        name: label,
        isActive: true,
        passwordHash: "x",
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });
    await prisma.license.create({
      data: {
        organizationId: org.id,
        productId,
        planId,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.appInstallation.create({
      data: {
        organizationId: org.id,
        productId,
        status: "ACTIVE",
        settingsJson: { onboardingStatus: "PENDING_SETUP" },
      },
    });
    await prisma.activationFeeLedger.create({
      data: {
        organizationId: org.id,
        productId,
        planId,
        status: "PAID",
        activationFeeMinor: 2_000_000,
        paidAt: new Date(),
      },
    });
    return { orgId: org.id, userId: user.id };
  }

  before(async () => {
    const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
    const plan = await prisma.plan.findFirst({
      where: { isActive: true, OR: [{ tierKey: "essential" }, { key: "wexpay_essential" }] },
    });
    if (!product || !plan) throw new Error("Seed required: wexpay + essential plan");
    productId = product.id;
    planId = plan.id;

    const a = await seedOrg("ActA");
    orgA = a.orgId;
    userA = a.userId;
    const b = await seedOrg("ActB");
    orgB = b.orgId;
    userB = b.userId;

    const restaurant = await prisma.restaurant.create({
      data: { organizationId: orgA, name: `R ${suffix}`, slug: `r-act-${suffix}` },
    });
    restaurantId = restaurant.id;
    const branch = await prisma.branch.create({
      data: { restaurantId, name: "Ana", slug: `b-act-${suffix}` },
    });
    branchId = branch.id;
    legacyQr = `WXP-LEGACY-${suffix}`;
    const table = await prisma.restaurantTable.create({
      data: { branchId, label: "M1", qrCode: legacyQr, seats: 4 },
    });
    tableId = table.id;
  });

  after(async () => {
    for (const oid of [orgA, orgB]) {
      if (!oid) continue;
      await prisma.activationJourney.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.subscription.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.appInstallation.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.license.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.membership.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.restaurant.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.organization.delete({ where: { id: oid } }).catch(() => undefined);
    }
    for (const uid of [userA, userB]) {
      if (uid) await prisma.user.delete({ where: { id: uid } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it("starts journey atomically with membership and rejects cross-tenant", async () => {
    const first = await startSelfServeActivationJourney({
      organizationId: orgA,
      actorUserId: userA,
    });
    assert.equal(first.status, ActivationJourneyStatus.IN_PROGRESS);
    assert.equal(first.source, ActivationJourneySource.SELF_SERVE);
    assert.equal(first.steps.length, 8);

    const startedAudits = await prisma.auditLog.count({
      where: { organizationId: orgA, action: "activation.journey.started" },
    });
    assert.equal(startedAudits, 1);

    const second = await startSelfServeActivationJourney({
      organizationId: orgA,
      actorUserId: userA,
    });
    assert.equal(second.id, first.id);
    assert.equal(
      await prisma.auditLog.count({
        where: { organizationId: orgA, action: "activation.journey.started" },
      }),
      1,
    );

    await assert.rejects(
      () =>
        startSelfServeActivationJourney({
          organizationId: orgB,
          actorUserId: userA,
        }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "TENANT_FORBIDDEN",
    );
    assert.equal(await prisma.activationJourney.count({ where: { organizationId: orgB } }), 0);
  });

  it("does not disclose an existing Org B journey to a non-member before auth", async () => {
    await prisma.activationJourney.deleteMany({ where: { organizationId: orgB } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: orgB, action: "activation.journey.started" },
    });

    const owned = await startSelfServeActivationJourney({
      organizationId: orgB,
      actorUserId: userB,
    });
    assert.equal(owned.status, ActivationJourneyStatus.IN_PROGRESS);

    const auditsBefore = await prisma.auditLog.count({
      where: { organizationId: orgB, action: "activation.journey.started" },
    });
    const stepsBefore = await prisma.activationJourneyStep.count({
      where: { journeyId: owned.id },
    });
    const statusBefore = owned.status;
    const currentStepBefore = owned.currentStep;

    let leaked: unknown = null;
    await assert.rejects(
      async () => {
        try {
          leaked = await startSelfServeActivationJourney({
            organizationId: orgB,
            actorUserId: userA,
          });
        } catch (error) {
          if (error instanceof ActivationJourneyError) {
            assert.equal(error.code, "TENANT_FORBIDDEN");
            assert.ok(!error.message.includes(owned.id));
            assert.ok(!JSON.stringify(error).includes(owned.id));
          }
          throw error;
        }
      },
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "TENANT_FORBIDDEN",
    );
    assert.equal(leaked, null);

    const unauthorizedView = await loadOrStartActivationJourneyView({
      organizationId: orgB,
      actorUserId: userA,
    });
    assert.equal(unauthorizedView.uiStatus, ACTIVATION_UI_NOT_STARTED);
    assert.equal(unauthorizedView.journey, null);

    const afterForbidden = await getActivationJourneyForOrg(orgB);
    assert.ok(afterForbidden);
    assert.equal(afterForbidden!.id, owned.id);
    assert.equal(afterForbidden!.status, statusBefore);
    assert.equal(afterForbidden!.currentStep, currentStepBefore);
    assert.equal(
      await prisma.auditLog.count({
        where: { organizationId: orgB, action: "activation.journey.started" },
      }),
      auditsBefore,
    );
    assert.equal(
      await prisma.activationJourneyStep.count({ where: { journeyId: owned.id } }),
      stepsBefore,
    );

    const idempotent = await startSelfServeActivationJourney({
      organizationId: orgB,
      actorUserId: userB,
    });
    assert.equal(idempotent.id, owned.id);
    assert.equal(
      await prisma.auditLog.count({
        where: { organizationId: orgB, action: "activation.journey.started" },
      }),
      auditsBefore,
    );
  });

  it("rejects terminal/past subscription lifecycle and allows future cancelAt + manual license", async () => {
    await prisma.activationJourney.deleteMany({ where: { organizationId: orgB } });
    await prisma.subscription.deleteMany({ where: { organizationId: orgB } });

    const licenseB = await prisma.license.findFirst({ where: { organizationId: orgB } });
    assert.ok(licenseB);
    await prisma.license.update({
      where: { id: licenseB!.id },
      data: {
        status: "ACTIVE",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    await prisma.appInstallation.update({
      where: { organizationId_productId: { organizationId: orgB, productId } },
      data: { status: "ACTIVE" },
    });

    async function replaceSubscription(data: {
      status: "ACTIVE" | "CANCELLED" | "EXPIRED" | "TRIALING" | "PAST_DUE";
      cancelAt?: Date | null;
      currentPeriodEnd?: Date | null;
    }) {
      await prisma.subscription.deleteMany({ where: { organizationId: orgB } });
      await prisma.activationJourney.deleteMany({ where: { organizationId: orgB } });
      return prisma.subscription.create({
        data: {
          organizationId: orgB,
          licenseId: licenseB!.id,
          planId,
          status: data.status,
          interval: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 7 * 86_400_000),
          currentPeriodEnd: data.currentPeriodEnd ?? new Date(Date.now() + 23 * 86_400_000),
          cancelAt: data.cancelAt ?? null,
        },
      });
    }

    await replaceSubscription({ status: "CANCELLED" });
    await assert.rejects(
      () => startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "LICENSE_INACTIVE",
    );
    assert.equal(await prisma.activationJourney.count({ where: { organizationId: orgB } }), 0);

    await replaceSubscription({ status: "EXPIRED" });
    await assert.rejects(
      () => startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "LICENSE_INACTIVE",
    );
    assert.equal(await prisma.activationJourney.count({ where: { organizationId: orgB } }), 0);

    await replaceSubscription({
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() - 60_000),
    });
    await assert.rejects(
      () => startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "LICENSE_INACTIVE",
    );
    assert.equal(await prisma.activationJourney.count({ where: { organizationId: orgB } }), 0);

    await replaceSubscription({
      status: "ACTIVE",
      cancelAt: new Date(Date.now() - 1_000),
    });
    await assert.rejects(
      () => startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "LICENSE_INACTIVE",
    );
    assert.equal(await prisma.activationJourney.count({ where: { organizationId: orgB } }), 0);

    await replaceSubscription({
      status: "ACTIVE",
      cancelAt: new Date(),
    });
    await assert.rejects(
      () => startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "LICENSE_INACTIVE",
    );
    assert.equal(await prisma.activationJourney.count({ where: { organizationId: orgB } }), 0);

    await replaceSubscription({
      status: "ACTIVE",
      cancelAt: new Date(Date.now() + 7 * 86_400_000),
    });
    const withFutureCancel = await startSelfServeActivationJourney({
      organizationId: orgB,
      actorUserId: userB,
    });
    assert.equal(withFutureCancel.status, ActivationJourneyStatus.IN_PROGRESS);

    await prisma.activationJourney.deleteMany({ where: { organizationId: orgB } });
    await prisma.subscription.deleteMany({ where: { organizationId: orgB } });
    const manual = await startSelfServeActivationJourney({
      organizationId: orgB,
      actorUserId: userB,
    });
    assert.equal(manual.status, ActivationJourneyStatus.IN_PROGRESS);
    assert.equal(await prisma.subscription.count({ where: { organizationId: orgB } }), 0);
  });

  it("rejects future-start and expired licenses and disabled install", async () => {
    await prisma.activationJourney.deleteMany({ where: { organizationId: orgB } });

    const licenseB = await prisma.license.findFirst({ where: { organizationId: orgB } });
    assert.ok(licenseB);

    await prisma.license.update({
      where: { id: licenseB!.id },
      data: { startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 2 * 86_400_000) },
    });
    await assert.rejects(
      () => startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB }),
      (err: unknown) => err instanceof ActivationJourneyError,
    );
    assert.equal(await prisma.activationJourney.count({ where: { organizationId: orgB } }), 0);

    await prisma.license.update({
      where: { id: licenseB!.id },
      data: {
        startsAt: new Date(Date.now() - 2 * 86_400_000),
        endsAt: new Date(Date.now() - 86_400_000),
      },
    });
    await assert.rejects(
      () => startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB }),
      (err: unknown) => err instanceof ActivationJourneyError,
    );

    await prisma.license.update({
      where: { id: licenseB!.id },
      data: {
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    await prisma.appInstallation.update({
      where: { organizationId_productId: { organizationId: orgB, productId } },
      data: { status: "DISABLED" },
    });
    await assert.rejects(
      () => startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "INSTALL_INACTIVE",
    );

    await prisma.appInstallation.update({
      where: { organizationId_productId: { organizationId: orgB, productId } },
      data: { status: "ACTIVE" },
    });
    const ok = await startSelfServeActivationJourney({ organizationId: orgB, actorUserId: userB });
    assert.equal(ok.status, "IN_PROGRESS");
  });

  it("rolls back journey when started audit fails inside the transaction", async () => {
    await prisma.activationJourney.deleteMany({ where: { organizationId: orgB } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: orgB, action: "activation.journey.started" },
    });

    await assert.rejects(async () => {
      await prisma.$transaction(async (tx) => {
        const created = await tx.activationJourney.create({
          data: {
            organizationId: orgB,
            productId,
            status: "IN_PROGRESS",
            source: "SELF_SERVE",
            currentStep: "BUSINESS_PROFILE",
            steps: {
              create: [{ stepKey: "BUSINESS_PROFILE", status: "PENDING", attemptCount: 0 }],
            },
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: orgB,
            action: "activation.journey.started",
            entityType: "ActivationJourney",
            entityId: created.id,
            metadataJson: { source: "SELF_SERVE" },
          },
        });
        throw new Error("simulated_audit_failure");
      });
    });

    assert.equal(await prisma.activationJourney.count({ where: { organizationId: orgB } }), 0);
    assert.equal(await prisma.activationJourneyStep.count({ where: { journey: { organizationId: orgB } } }), 0);
  });

  it("READY closes public; ACTIVE opens legacy and opaque", async () => {
    const journey = await getActivationJourneyForOrg(orgA);
    assert.ok(journey);

    await prisma.activationJourney.update({
      where: { id: journey!.id },
      data: { status: ActivationJourneyStatus.READY },
    });
    assert.equal(await assertWexPayPublicLiveReady(orgA), false);
    let resolution = await resolvePublicTableByQr(legacyQr);
    assert.ok(resolution);
    assert.equal(resolution.allowed, false);
    assert.equal(resolution.keyKind, "legacy");
    assert.match(resolution.publicPath, /^\/wexpay\/t\//);

    await prisma.activationJourney.update({
      where: { id: journey!.id },
      data: {
        status: ActivationJourneyStatus.ACTIVE,
        source: ActivationJourneySource.LEGACY_BACKFILL,
        completedAt: new Date(),
      },
    });
    assert.equal(await assertWexPayPublicLiveReady(orgA), true);
    resolution = await resolvePublicTableByQr(legacyQr);
    assert.ok(resolution?.allowed);
  });

  it("secure QR issue/rotate/revoke never stores or audits plaintext", async () => {
    const issued = await issueTableQrToken({ tableId, organizationId: orgA });
    assert.equal(Buffer.from(issued.plaintext, "base64url").length, 32);
    assert.equal(issued.token.tokenHash, hashTableQrToken(issued.plaintext));

    const dbRow = await prisma.tableQrToken.findUnique({ where: { id: issued.token.id } });
    assert.ok(dbRow);
    assert.ok(!JSON.stringify(dbRow).includes(issued.plaintext));

    let opaque = await resolvePublicTableByOpaqueToken(issued.plaintext);
    assert.ok(opaque?.allowed);
    assert.equal(opaque!.keyKind, "opaque");
    assert.match(opaque!.publicPath, /^\/q\//);

    // Throttle: second immediate touch should not rewrite lastUsedAt if already set recently.
    const before = (await prisma.tableQrToken.findUnique({ where: { id: issued.token.id } }))!.lastUsedAt;
    await touchTableQrTokenLastUsed(issued.token.id);
    await touchTableQrTokenLastUsed(issued.token.id);
    const after = (await prisma.tableQrToken.findUnique({ where: { id: issued.token.id } }))!.lastUsedAt;
    assert.deepEqual(after, before);

    // Synthetic failure audits via the same allowlist helper path used by routes.
    writeAuditFailure({
      action: "wexpay.public.rate_limited",
      message: "test",
      source: "public_qr",
      metadata: {
        keyKind: "opaque",
        publicKeyHash: hashPublicQrKey(issued.plaintext),
        kind: "menu",
      },
    });
    writeAuditFailure({
      action: "wexpay.public.access_closed",
      message: "test",
      organizationId: orgA,
      source: "public_qr",
      metadata: {
        keyKind: "opaque",
        publicKeyHash: hashPublicQrKey(issued.plaintext),
        tableId,
        tokenId: issued.token.id,
        tokenPrefix: issued.token.tokenPrefix,
      },
    });

    const rotated = await rotateTableQrToken({ tableId, organizationId: orgA });
    assert.equal(await findActiveTableQrTokenByPlaintext(issued.plaintext), null);
    assert.ok(await findActiveTableQrTokenByPlaintext(rotated.plaintext));

    await revokeTableQrToken({ tableId, organizationId: orgA });
    opaque = await resolvePublicTableByOpaqueToken(rotated.plaintext);
    assert.equal(opaque, null);

    const audits = await prisma.auditLog.findMany({
      where: {
        organizationId: orgA,
        action: {
          in: [
            "wexpay.qr.issued",
            "wexpay.qr.rotated",
            "wexpay.qr.revoked",
            "wexpay.public.rate_limited",
            "wexpay.public.access_closed",
          ],
        },
      },
      take: 50,
    });
    assert.ok(audits.length >= 3);
    for (const audit of audits) {
      const blob = JSON.stringify(audit);
      assert.ok(!blob.includes(issued.plaintext), `leak in ${audit.action}`);
      assert.ok(!blob.includes(rotated.plaintext), `leak in ${audit.action}`);
    }

    // legacy still works while journey ACTIVE
    assert.ok((await resolvePublicTableByQr(legacyQr))?.allowed);
  });

  it("public schema has 38 tables and full RLS/grants on new tables", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string; rls: boolean }>>`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;
    assert.equal(tables.length, EXPECTED_PUBLIC_TABLE_COUNT);
    assert.equal(EXPECTED_PUBLIC_TABLE_COUNT, 38);
    for (const name of ["ActivationJourney", "ActivationJourneyStep", "TableQrToken", "StaffInvite"]) {
      const row = tables.find((t) => t.table_name === name);
      assert.ok(row, `missing table ${name}`);
      assert.equal(row!.rls, true);
    }

    // Read-only catalog check — never CREATE ROLE / REVOKE / GRANT here.
    // CI creates anon/authenticated before migrate so migration revoke is real.
    const roles = await prisma.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'wexon_app')
      ORDER BY rolname
    `;
    const roleNames = new Set(roles.map((r) => r.rolname));
    assert.ok(roleNames.has("anon"), "anon role must exist (create before migrate in CI)");
    assert.ok(roleNames.has("authenticated"), "authenticated role must exist (create before migrate in CI)");
    assert.ok(roleNames.has("wexon_app"), "wexon_app role must exist");

    for (const name of ["ActivationJourney", "ActivationJourneyStep", "TableQrToken", "StaffInvite"]) {
      const row = tables.find((t) => t.table_name === name);
      assert.ok(row, `${name} must exist`);
      assert.equal(row!.rls, true);

      const priv = await prisma.$queryRawUnsafe<
        Array<{
          anon_select: boolean;
          anon_insert: boolean;
          anon_update: boolean;
          anon_delete: boolean;
          auth_select: boolean;
          auth_insert: boolean;
          auth_update: boolean;
          auth_delete: boolean;
        }>
      >(
        `SELECT
          has_table_privilege('anon', 'public."${name}"', 'SELECT') AS anon_select,
          has_table_privilege('anon', 'public."${name}"', 'INSERT') AS anon_insert,
          has_table_privilege('anon', 'public."${name}"', 'UPDATE') AS anon_update,
          has_table_privilege('anon', 'public."${name}"', 'DELETE') AS anon_delete,
          has_table_privilege('authenticated', 'public."${name}"', 'SELECT') AS auth_select,
          has_table_privilege('authenticated', 'public."${name}"', 'INSERT') AS auth_insert,
          has_table_privilege('authenticated', 'public."${name}"', 'UPDATE') AS auth_update,
          has_table_privilege('authenticated', 'public."${name}"', 'DELETE') AS auth_delete`,
      );
      const p = priv[0];
      assert.equal(p.anon_select, false, name);
      assert.equal(p.anon_insert, false, name);
      assert.equal(p.anon_update, false, name);
      assert.equal(p.anon_delete, false, name);
      assert.equal(p.auth_select, false, name);
      assert.equal(p.auth_insert, false, name);
      assert.equal(p.auth_update, false, name);
      assert.equal(p.auth_delete, false, name);

      const policy = await prisma.$queryRawUnsafe<Array<{ polname: string }>>(
        `SELECT pol.polname
         FROM pg_policy pol
         JOIN pg_class c ON c.oid = pol.polrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = '${name}' AND pol.polname = 'wexon_app_all'`,
      );
      assert.equal(policy.length, 1, name);
    }

    const role = await prisma.$queryRaw<Array<{ rolcanlogin: boolean; rolbypassrls: boolean }>>`
      SELECT rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = 'wexon_app'
    `;
    assert.equal(role.length, 1);
    assert.equal(role[0].rolcanlogin, false);
    assert.equal(role[0].rolbypassrls, false);

    assert.ok(Number.isFinite(await prisma.activationJourney.count()));
    assert.ok(Number.isFinite(await prisma.activationJourneyStep.count()));
    assert.ok(Number.isFinite(await prisma.tableQrToken.count()));

    await prisma.tableQrToken.updateMany({
      where: { tableId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

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
