import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, describe, it } from "node:test";
import pg from "pg";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  __clearCommercialAuditWriterForTests,
  __setCommercialAuditWriterForTests,
  changeLicensePlanWithSubscriptionSync,
  commercialLicensePlanLockEntity,
  COMMERCIAL_LICENSE_PLAN_LOCK_NAMESPACE,
  waiveActivationFeeAsAdmin,
} from "@/lib/wexon-admin-commercial-consistency";
import type { AdminSession } from "@/lib/wexon-admin-auth";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import { syncSubscriptionAccessState } from "@/lib/wexon-subscription-lifecycle";
import { normalizePlatformAdminEmail } from "@/lib/wexon-platform-admin";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);
const actorEmail = `padmin-${suffix}@wexon.dev`;
const actorSubject = `cf-sub-${suffix}`;

const ids: {
  platformAdmin?: string;
  orgA?: string;
  orgB?: string;
  product?: string;
  otherProduct?: string;
  essential?: string;
  growth?: string;
  otherPlan?: string;
  licenseA?: string;
  licenseB?: string;
  subscriptionA?: string;
  installationA?: string;
  payment?: string;
  raceRestaurant?: string;
} = {};

let actor: AdminSession;

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

async function seedEntitlements(planId: string, limits: Record<string, number | boolean>) {
  for (const [key, value] of Object.entries(limits)) {
    if (typeof value === "boolean") {
      await prisma.entitlement.create({
        data: { planId, key, valueType: "BOOLEAN", valueBool: value },
      });
    } else {
      await prisma.entitlement.create({
        data: { planId, key, valueType: "INTEGER", valueInt: value },
      });
    }
  }
}

async function waitForAdvisoryWaiters(minWaiters: number, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rows = await prisma.$queryRaw<Array<{ c: number }>>`
      SELECT COUNT(*)::int AS c
      FROM pg_locks
      WHERE locktype = 'advisory'
        AND NOT granted
    `;
    if ((rows[0]?.c ?? 0) >= minWaiters) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${minWaiters} advisory lock waiter(s)`);
}

async function ensurePendingLedger(opts?: {
  paymentStatus?: "INITIATED" | "TOKEN_CREATED" | "PENDING_CALLBACK" | "PAID" | "FAILED" | "CANCELED" | "EXPIRED" | null;
  reservedUntil?: Date | null;
  merchantOid?: string;
}) {
  const paymentStatus = opts?.paymentStatus === undefined ? null : opts.paymentStatus;
  let paymentId: string | null = null;
  if (paymentStatus) {
    const payment = await prisma.subscriptionPayment.create({
      data: {
        organizationId: ids.orgA!,
        planId: ids.essential!,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid: opts?.merchantOid ?? `pr4pay${randomUUID().slice(0, 8)}`,
        amount: 100,
        amountMinor: 10000,
        currency: "TRY",
        taxRatePct: 20,
        billingInterval: "MONTHLY",
        status: paymentStatus,
      },
    });
    paymentId = payment.id;
  }

  return prisma.activationFeeLedger.upsert({
    where: {
      organizationId_productId: { organizationId: ids.orgA!, productId: ids.product! },
    },
    create: {
      organizationId: ids.orgA!,
      productId: ids.product!,
      planId: ids.essential!,
      status: "PENDING",
      activationFeeMinor: 2000000,
      taxAmountMinor: 0,
      grossAmountMinor: 2000000,
      reservedUntil: opts?.reservedUntil ?? null,
      subscriptionPaymentId: paymentId,
      waivedReason: null,
      paidAt: null,
    },
    update: {
      status: "PENDING",
      waivedReason: null,
      reservedUntil: opts?.reservedUntil ?? null,
      subscriptionPaymentId: paymentId,
      paidAt: null,
    },
  });
}

describe("admin commercial consistency (DB-backed)", () => {
  before(async () => {
    const platformAdmin = await prisma.platformAdmin.create({
      data: {
        email: actorEmail,
        emailNormalized: normalizePlatformAdminEmail(actorEmail),
        displayName: `PR4 Admin ${suffix}`,
        isActive: true,
        cloudflareSubject: actorSubject,
      },
    });
    ids.platformAdmin = platformAdmin.id;
    actor = {
      adminId: platformAdmin.id,
      email: actorEmail,
      cloudflareSubject: actorSubject,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
    };

    const product = await prisma.product.create({
      data: { key: `wexpay-pr4-${suffix}`, name: `PR4 WexPay ${suffix}`, status: "ACTIVE", isActive: true },
    });
    ids.product = product.id;

    const otherProduct = await prisma.product.create({
      data: { key: `other-pr4-${suffix}`, name: `Other ${suffix}`, status: "ACTIVE", isActive: true },
    });
    ids.otherProduct = otherProduct.id;

    const essential = await prisma.plan.create({
      data: {
        productId: product.id,
        key: `essential-${suffix}`,
        name: "Essential",
        billingInterval: "MONTHLY",
        tierKey: "essential",
        sortOrder: 1,
        isActive: true,
      },
    });
    ids.essential = essential.id;
    await seedEntitlements(essential.id, {
      branch_limit: 1,
      table_limit: 10,
      product_limit: 50,
      staff_limit: 5,
      feature_multi_location: false,
    });

    const growth = await prisma.plan.create({
      data: {
        productId: product.id,
        key: `growth-${suffix}`,
        name: "Growth",
        billingInterval: "MONTHLY",
        tierKey: "growth",
        sortOrder: 2,
        isActive: true,
      },
    });
    ids.growth = growth.id;
    await seedEntitlements(growth.id, {
      branch_limit: 5,
      table_limit: 100,
      product_limit: 500,
      staff_limit: 40,
      feature_multi_location: true,
    });

    const otherPlan = await prisma.plan.create({
      data: {
        productId: otherProduct.id,
        key: `other-plan-${suffix}`,
        name: "Other Plan",
        billingInterval: "MONTHLY",
        isActive: true,
      },
    });
    ids.otherPlan = otherPlan.id;

    const orgA = await prisma.organization.create({
      data: { name: `PR4 OrgA ${suffix}`, slug: `pr4-orga-${suffix}`, isActive: true, isDemo: false },
    });
    ids.orgA = orgA.id;
    const orgB = await prisma.organization.create({
      data: { name: `PR4 OrgB ${suffix}`, slug: `pr4-orgb-${suffix}`, isActive: true, isDemo: false },
    });
    ids.orgB = orgB.id;

    const licenseA = await prisma.license.create({
      data: {
        organizationId: orgA.id,
        productId: product.id,
        planId: essential.id,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        endsAt: FUTURE,
      },
    });
    ids.licenseA = licenseA.id;

    const subscriptionA = await prisma.subscription.create({
      data: {
        organizationId: orgA.id,
        licenseId: licenseA.id,
        planId: essential.id,
        status: "ACTIVE",
        interval: "MONTHLY",
        currentPeriodEnd: FUTURE,
        provider: "admin_manual",
      },
    });
    ids.subscriptionA = subscriptionA.id;

    const installationA = await prisma.appInstallation.create({
      data: {
        organizationId: orgA.id,
        productId: product.id,
        licenseId: licenseA.id,
        status: "ACTIVE",
      },
    });
    ids.installationA = installationA.id;

    const licenseB = await prisma.license.create({
      data: {
        organizationId: orgB.id,
        productId: product.id,
        planId: essential.id,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        endsAt: FUTURE,
      },
    });
    ids.licenseB = licenseB.id;
  });

  afterEach(() => {
    __clearCommercialAuditWriterForTests();
  });

  after(async () => {
    __clearCommercialAuditWriterForTests();
    const orgIds = [ids.orgA, ids.orgB].filter(Boolean) as string[];
    for (const organizationId of orgIds) {
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.subscriptionPayment.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.restaurant.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.membership.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.appInstallation.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.subscription.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.license.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
    }
    for (const planId of [ids.essential, ids.growth, ids.otherPlan]) {
      if (!planId) continue;
      await prisma.entitlement.deleteMany({ where: { planId } }).catch(() => undefined);
      await prisma.plan.deleteMany({ where: { id: planId } }).catch(() => undefined);
    }
    for (const productId of [ids.product, ids.otherProduct]) {
      if (!productId) continue;
      await prisma.product.deleteMany({ where: { id: productId } }).catch(() => undefined);
    }
    if (ids.platformAdmin) {
      await prisma.platformAdmin.deleteMany({ where: { id: ids.platformAdmin } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("ACTIVE matching PlatformAdmin can change plan", async () => {
    const result = await changeLicensePlanWithSubscriptionSync({
      organizationId: ids.orgA!,
      licenseId: ids.licenseA!,
      targetPlanId: ids.growth!,
      reason: "Müşteri Growth paketine yükseltildi",
      confirmed: true,
      actor,
    });
    assert.equal(result.changeType, "upgrade");
    assert.equal(result.subscriptionSync, "synced");
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
    assert.equal(license.planId, ids.growth);
    assert.equal(subscription.planId, ids.growth);
    assert.equal(license.planId, subscription.planId);
  });

  it("updates only License when no subscription and audits not_applicable", async () => {
    const result = await changeLicensePlanWithSubscriptionSync({
      organizationId: ids.orgB!,
      licenseId: ids.licenseB!,
      targetPlanId: ids.growth!,
      reason: "Aboneliksiz lisans paket güncellemesi",
      confirmed: true,
      actor,
    });
    assert.equal(result.subscriptionSync, "not_applicable");
    assert.equal(result.subscriptionPlanId, null);
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseB! } });
    assert.equal(license.planId, ids.growth);
    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: ids.orgB!, action: "admin.license.plan_changed" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(audit);
    const meta = audit!.metadataJson as Record<string, unknown>;
    assert.equal(meta.subscriptionSync, "not_applicable");
  });

  it("rejects cross-organization license usage", async () => {
    await assert.rejects(
      () =>
        changeLicensePlanWithSubscriptionSync({
          organizationId: ids.orgB!,
          licenseId: ids.licenseA!,
          targetPlanId: ids.essential!,
          reason: "Cross tenant denemesi reddedilmeli",
          confirmed: true,
          actor,
        }),
      AdminValidationError,
    );
  });

  it("rejects plan from another product", async () => {
    await assert.rejects(
      () =>
        changeLicensePlanWithSubscriptionSync({
          organizationId: ids.orgA!,
          licenseId: ids.licenseA!,
          targetPlanId: ids.otherPlan!,
          reason: "Yanlış ürün planı reddedilmeli",
          confirmed: true,
          actor,
        }),
      /ürününe ait değil/,
    );
  });

  it("rejects over-limit downgrade without mutating rows", async () => {
    await prisma.license.update({ where: { id: ids.licenseA! }, data: { planId: ids.growth! } });
    await prisma.subscription.update({ where: { id: ids.subscriptionA! }, data: { planId: ids.growth! } });

    const restaurant = await prisma.restaurant.create({
      data: {
        organizationId: ids.orgA!,
        name: `R1 ${suffix}`,
        slug: `r1-${suffix}`,
        isActive: true,
      },
    });
    await prisma.branch.create({
      data: { restaurantId: restaurant.id, name: "B1", slug: `b1-${suffix}`, isActive: true },
    });
    await prisma.branch.create({
      data: { restaurantId: restaurant.id, name: "B2", slug: `b2-${suffix}`, isActive: true },
    });

    await assert.rejects(
      () =>
        changeLicensePlanWithSubscriptionSync({
          organizationId: ids.orgA!,
          licenseId: ids.licenseA!,
          targetPlanId: ids.essential!,
          reason: "Limit aşan downgrade reddedilmeli",
          confirmed: true,
          actor,
        }),
      /Paket düşürme reddedildi/,
    );

    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
    assert.equal(license.planId, ids.growth);
    assert.equal(subscription.planId, ids.growth);

    await prisma.branch.deleteMany({ where: { restaurantId: restaurant.id } });
    await prisma.restaurant.delete({ where: { id: restaurant.id } });
  });

  it("allows valid downgrade when usage fits", async () => {
    await prisma.license.update({ where: { id: ids.licenseA! }, data: { planId: ids.growth! } });
    await prisma.subscription.update({ where: { id: ids.subscriptionA! }, data: { planId: ids.growth! } });
    const result = await changeLicensePlanWithSubscriptionSync({
      organizationId: ids.orgA!,
      licenseId: ids.licenseA!,
      targetPlanId: ids.essential!,
      reason: "Kullanım uygun downgrade",
      confirmed: true,
      actor,
    });
    assert.equal(result.changeType, "downgrade");
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
    assert.equal(license.planId, ids.essential);
    assert.equal(subscription.planId, ids.essential);
  });

  it("rolls back plan change when audit fails", async () => {
    try {
      __setCommercialAuditWriterForTests(async () => {
        throw new Error("simulated_audit_failure");
      });
      await assert.rejects(
        () =>
          changeLicensePlanWithSubscriptionSync({
            organizationId: ids.orgA!,
            licenseId: ids.licenseA!,
            targetPlanId: ids.growth!,
            reason: "Audit failure rollback senaryosu",
            confirmed: true,
            actor,
          }),
        /simulated_audit_failure/,
      );
    } finally {
      __clearCommercialAuditWriterForTests();
    }
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
    assert.equal(license.planId, subscription.planId);
    assert.equal(license.planId, ids.essential);
  });

  it("deterministic concurrent upgrade-then-downgrade rejects stale Essential target", async () => {
    await prisma.license.update({ where: { id: ids.licenseA! }, data: { planId: ids.essential! } });
    await prisma.subscription.update({ where: { id: ids.subscriptionA! }, data: { planId: ids.essential! } });

    const restaurant = await prisma.restaurant.create({
      data: {
        organizationId: ids.orgA!,
        name: `Race R ${suffix}`,
        slug: `race-r-${suffix}`,
        isActive: true,
      },
    });
    ids.raceRestaurant = restaurant.id;
    await prisma.branch.create({
      data: { restaurantId: restaurant.id, name: "RB1", slug: `rb1-${suffix}`, isActive: true },
    });
    await prisma.branch.create({
      data: { restaurantId: restaurant.id, name: "RB2", slug: `rb2-${suffix}`, isActive: true },
    });

    const beforeAudits = await prisma.auditLog.count({
      where: { organizationId: ids.orgA!, action: "admin.license.plan_changed" },
    });

    const databaseUrl = process.env.DATABASE_URL!;
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const holder = await pool.connect();
    const lockEntity = commercialLicensePlanLockEntity(ids.orgA!, ids.licenseA!);

    try {
      await holder.query("BEGIN");
      await holder.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
        COMMERCIAL_LICENSE_PLAN_LOCK_NAMESPACE,
        lockEntity,
      ]);

      const upgradePromise = changeLicensePlanWithSubscriptionSync({
        organizationId: ids.orgA!,
        licenseId: ids.licenseA!,
        targetPlanId: ids.growth!,
        reason: "Concurrent upgrade under advisory barrier",
        confirmed: true,
        actor,
      });
      await waitForAdvisoryWaiters(1);

      const downgradePromise = changeLicensePlanWithSubscriptionSync({
        organizationId: ids.orgA!,
        licenseId: ids.licenseA!,
        targetPlanId: ids.essential!,
        reason: "Concurrent stale downgrade under advisory barrier",
        confirmed: true,
        actor,
      });
      await waitForAdvisoryWaiters(2);

      await holder.query("COMMIT");

      const upgrade = await upgradePromise;
      assert.equal(upgrade.changeType, "upgrade");
      await assert.rejects(() => downgradePromise, /Paket düşürme reddedildi/);

      const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
      const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
      assert.equal(license.planId, ids.growth);
      assert.equal(subscription.planId, ids.growth);

      const audits = await prisma.auditLog.findMany({
        where: { organizationId: ids.orgA!, action: "admin.license.plan_changed" },
        orderBy: { createdAt: "asc" },
      });
      assert.equal(audits.length, beforeAudits + 1);
      const latest = audits[audits.length - 1]!.metadataJson as Record<string, unknown>;
      assert.equal(latest.changeType, "upgrade");
      assert.equal(latest.beforeLicensePlanId, ids.essential);
      assert.equal(latest.afterLicensePlanId, ids.growth);
      assert.equal(latest.beforePlanName, "Essential");
    } finally {
      try {
        await holder.query("ROLLBACK");
      } catch {
        /* already committed */
      }
      holder.release();
      await pool.end();
      await prisma.branch.deleteMany({ where: { restaurantId: restaurant.id } }).catch(() => undefined);
      await prisma.restaurant.delete({ where: { id: restaurant.id } }).catch(() => undefined);
    }
  });

  it("rejects nonexistent / inactive / mismatched PlatformAdmin without domain mutation", async () => {
    await prisma.license.update({ where: { id: ids.licenseA! }, data: { planId: ids.essential! } });
    await prisma.subscription.update({ where: { id: ids.subscriptionA! }, data: { planId: ids.essential! } });
    const beforeLicense = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const beforeSub = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
    const beforeAudits = await prisma.auditLog.count({ where: { organizationId: ids.orgA! } });

    await assert.rejects(
      () =>
        changeLicensePlanWithSubscriptionSync({
          organizationId: ids.orgA!,
          licenseId: ids.licenseA!,
          targetPlanId: ids.growth!,
          reason: "Nonexistent admin must be denied",
          confirmed: true,
          actor: { ...actor, adminId: `missing_${suffix}` },
        }),
      (error: unknown) => error instanceof AdminValidationError && /yetkiniz yok/i.test(error.message),
    );

    await prisma.platformAdmin.update({ where: { id: ids.platformAdmin! }, data: { isActive: false } });
    await assert.rejects(
      () =>
        changeLicensePlanWithSubscriptionSync({
          organizationId: ids.orgA!,
          licenseId: ids.licenseA!,
          targetPlanId: ids.growth!,
          reason: "Inactive admin must be denied",
          confirmed: true,
          actor,
        }),
      /yetkiniz yok/i,
    );
    await prisma.platformAdmin.update({ where: { id: ids.platformAdmin! }, data: { isActive: true } });

    await assert.rejects(
      () =>
        changeLicensePlanWithSubscriptionSync({
          organizationId: ids.orgA!,
          licenseId: ids.licenseA!,
          targetPlanId: ids.growth!,
          reason: "Email mismatch must be denied",
          confirmed: true,
          actor: { ...actor, email: `other-${suffix}@wexon.dev` },
        }),
      /yetkiniz yok/i,
    );

    await assert.rejects(
      () =>
        changeLicensePlanWithSubscriptionSync({
          organizationId: ids.orgA!,
          licenseId: ids.licenseA!,
          targetPlanId: ids.growth!,
          reason: "Subject mismatch must be denied",
          confirmed: true,
          actor: { ...actor, cloudflareSubject: `other-cf-${suffix}` },
        }),
      /yetkiniz yok/i,
    );

    const afterLicense = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const afterSub = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
    const afterAudits = await prisma.auditLog.count({ where: { organizationId: ids.orgA! } });
    assert.equal(afterLicense.planId, beforeLicense.planId);
    assert.equal(afterSub.planId, beforeSub.planId);
    assert.equal(afterAudits, beforeAudits);
  });

  it("fresh PENDING reservation blocks plan change", async () => {
    const payment = await prisma.subscriptionPayment.create({
      data: {
        organizationId: ids.orgA!,
        planId: ids.essential!,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid: `pr4oid${suffix}`,
        amount: 100,
        amountMinor: 10000,
        currency: "TRY",
        taxRatePct: 20,
        billingInterval: "MONTHLY",
        status: "PENDING_CALLBACK",
      },
    });
    ids.payment = payment.id;
    await prisma.activationFeeLedger.upsert({
      where: {
        organizationId_productId: { organizationId: ids.orgA!, productId: ids.product! },
      },
      create: {
        organizationId: ids.orgA!,
        productId: ids.product!,
        planId: ids.essential!,
        status: "PENDING",
        activationFeeMinor: 2000000,
        reservedUntil: new Date(Date.now() + 20 * 60 * 1000),
        subscriptionPaymentId: payment.id,
      },
      update: {
        status: "PENDING",
        reservedUntil: new Date(Date.now() + 20 * 60 * 1000),
        subscriptionPaymentId: payment.id,
        waivedReason: null,
        paidAt: null,
      },
    });

    await assert.rejects(
      () =>
        changeLicensePlanWithSubscriptionSync({
          organizationId: ids.orgA!,
          licenseId: ids.licenseA!,
          targetPlanId: ids.growth!,
          reason: "Fresh reservation plan change block",
          confirmed: true,
          actor,
        }),
      /rezervasyon/,
    );
  });

  it("waive payment-status matrix: allow null/FAILED/CANCELED/EXPIRED; deny open/PAID", async () => {
    for (const paymentStatus of [null, "FAILED", "CANCELED", "EXPIRED"] as const) {
      await ensurePendingLedger({ paymentStatus, reservedUntil: null });
      const waived = await waiveActivationFeeAsAdmin({
        organizationId: ids.orgA!,
        productId: ids.product!,
        reason: `Waive allowed for payment ${paymentStatus ?? "null"}`,
        confirmed: true,
        actor,
      });
      assert.equal(waived.status, "WAIVED");
      assert.equal(waived.subscriptionPaymentId, null);
    }

    for (const paymentStatus of ["INITIATED", "TOKEN_CREATED", "PENDING_CALLBACK", "PAID"] as const) {
      const ledger = await ensurePendingLedger({
        paymentStatus,
        reservedUntil: new Date(Date.now() - 60_000),
      });
      const before = await prisma.activationFeeLedger.findUniqueOrThrow({ where: { id: ledger.id } });
      await assert.rejects(
        () =>
          waiveActivationFeeAsAdmin({
            organizationId: ids.orgA!,
            productId: ids.product!,
            reason: `Waive denied for payment ${paymentStatus}`,
            confirmed: true,
            actor,
          }),
        AdminValidationError,
      );
      const after = await prisma.activationFeeLedger.findUniqueOrThrow({ where: { id: ledger.id } });
      assert.equal(after.status, "PENDING");
      assert.equal(after.subscriptionPaymentId, before.subscriptionPaymentId);
    }

    const paidExpired = await ensurePendingLedger({
      paymentStatus: "PAID",
      reservedUntil: new Date(Date.now() - 120_000),
    });
    await assert.rejects(
      () =>
        waiveActivationFeeAsAdmin({
          organizationId: ids.orgA!,
          productId: ids.product!,
          reason: "PAID with expired reservation still denied",
          confirmed: true,
          actor,
        }),
      /tahsilat|uzlaştırma/i,
    );
    const stillPaidLink = await prisma.activationFeeLedger.findUniqueOrThrow({ where: { id: paidExpired.id } });
    assert.equal(stillPaidLink.status, "PENDING");
    assert.ok(stillPaidLink.subscriptionPaymentId);
  });

  it("rejects settled ledger repeats and WAIVED_LEGACY", async () => {
    await ensurePendingLedger({ paymentStatus: null, reservedUntil: null });
    const waived = await waiveActivationFeeAsAdmin({
      organizationId: ids.orgA!,
      productId: ids.product!,
      reason: "Operasyonel aktivasyon ücreti muafiyeti",
      confirmed: true,
      actor,
    });
    assert.equal(waived.status, "WAIVED");

    await assert.rejects(
      () =>
        waiveActivationFeeAsAdmin({
          organizationId: ids.orgA!,
          productId: ids.product!,
          reason: "Tekrar waive denemesi reddedilmeli",
          confirmed: true,
          actor,
        }),
      /değiştirilemez/,
    );

    await prisma.activationFeeLedger.update({
      where: { id: waived.id },
      data: { status: "WAIVED_LEGACY" },
    });
    await assert.rejects(
      () =>
        waiveActivationFeeAsAdmin({
          organizationId: ids.orgA!,
          productId: ids.product!,
          reason: "WAIVED_LEGACY ledger değiştirilemez",
          confirmed: true,
          actor,
        }),
      /değiştirilemez/,
    );
  });

  it("rolls back waive when audit fails and override does not leak", async () => {
    await ensurePendingLedger({ paymentStatus: null, reservedUntil: null });
    try {
      __setCommercialAuditWriterForTests(async () => {
        throw new Error("simulated_waive_audit_failure");
      });
      await assert.rejects(
        () =>
          waiveActivationFeeAsAdmin({
            organizationId: ids.orgA!,
            productId: ids.product!,
            reason: "Waive audit failure rollback",
            confirmed: true,
            actor,
          }),
        /simulated_waive_audit_failure/,
      );
    } finally {
      __clearCommercialAuditWriterForTests();
    }
    const ledger = await prisma.activationFeeLedger.findUniqueOrThrow({
      where: {
        organizationId_productId: { organizationId: ids.orgA!, productId: ids.product! },
      },
    });
    assert.equal(ledger.status, "PENDING");

    // Override must not leak: a subsequent waive without override succeeds.
    const waived = await waiveActivationFeeAsAdmin({
      organizationId: ids.orgA!,
      productId: ids.product!,
      reason: "Post-override waive must succeed",
      confirmed: true,
      actor,
    });
    assert.equal(waived.status, "WAIVED");
  });

  it("rejects waive for inactive PlatformAdmin without ledger mutation", async () => {
    await ensurePendingLedger({ paymentStatus: null, reservedUntil: null });
    await prisma.platformAdmin.update({ where: { id: ids.platformAdmin! }, data: { isActive: false } });
    try {
      await assert.rejects(
        () =>
          waiveActivationFeeAsAdmin({
            organizationId: ids.orgA!,
            productId: ids.product!,
            reason: "Inactive actor waive denied",
            confirmed: true,
            actor,
          }),
        /yetkiniz yok/i,
      );
      const ledger = await prisma.activationFeeLedger.findUniqueOrThrow({
        where: {
          organizationId_productId: { organizationId: ids.orgA!, productId: ids.product! },
        },
      });
      assert.equal(ledger.status, "PENDING");
    } finally {
      await prisma.platformAdmin.update({ where: { id: ids.platformAdmin! }, data: { isActive: true } });
    }
  });

  it("preserves subscription lifecycle sync regressions", async () => {
    const cancelled = await prisma.subscription.update({
      where: { id: ids.subscriptionA! },
      data: { status: "CANCELLED", cancelAt: new Date() },
    });
    await prisma.$transaction(async (tx) => {
      await syncSubscriptionAccessState(tx, {
        previousStatus: "ACTIVE",
        subscription: {
          id: cancelled.id,
          organizationId: cancelled.organizationId,
          licenseId: cancelled.licenseId,
          status: cancelled.status,
          cancelAt: cancelled.cancelAt,
          currentPeriodEnd: cancelled.currentPeriodEnd,
        },
      });
    });
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const installation = await prisma.appInstallation.findUniqueOrThrow({ where: { id: ids.installationA! } });
    assert.equal(license.status, "CANCELLED");
    assert.equal(installation.status, "DISABLED");

    const reactivated = await prisma.subscription.update({
      where: { id: ids.subscriptionA! },
      data: { status: "ACTIVE", cancelAt: null, currentPeriodEnd: FUTURE },
    });
    await prisma.license.update({ where: { id: ids.licenseA! }, data: { status: "ACTIVE", endsAt: FUTURE } });
    await prisma.$transaction(async (tx) => {
      await syncSubscriptionAccessState(tx, {
        previousStatus: "CANCELLED",
        subscription: {
          id: reactivated.id,
          organizationId: reactivated.organizationId,
          licenseId: reactivated.licenseId,
          status: reactivated.status,
          cancelAt: reactivated.cancelAt,
          currentPeriodEnd: reactivated.currentPeriodEnd,
        },
      });
    });
    const reopened = await prisma.appInstallation.findUniqueOrThrow({ where: { id: ids.installationA! } });
    assert.equal(reopened.status, "ACTIVE");
  });

  it("does not mutate other organization or other product installation", async () => {
    const otherInstall = await prisma.appInstallation.create({
      data: {
        organizationId: ids.orgA!,
        productId: ids.otherProduct!,
        licenseId: null,
        status: "ACTIVE",
      },
    });
    const beforeB = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseB! } });
    await changeLicensePlanWithSubscriptionSync({
      organizationId: ids.orgA!,
      licenseId: ids.licenseA!,
      targetPlanId: ids.growth!,
      reason: "Tenant isolation plan change",
      confirmed: true,
      actor,
    });
    const afterB = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseB! } });
    const afterOtherInstall = await prisma.appInstallation.findUniqueOrThrow({ where: { id: otherInstall.id } });
    assert.equal(afterB.planId, beforeB.planId);
    assert.equal(afterOtherInstall.status, "ACTIVE");
    await prisma.appInstallation.delete({ where: { id: otherInstall.id } });
  });
});
