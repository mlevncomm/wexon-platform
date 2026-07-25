import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  __setCommercialAuditWriterForTests,
  changeLicensePlanWithSubscriptionSync,
  waiveActivationFeeAsAdmin,
} from "@/lib/wexon-admin-commercial-consistency";
import type { AdminSession } from "@/lib/wexon-admin-auth";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import { syncSubscriptionAccessState } from "@/lib/wexon-subscription-lifecycle";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);
const actor: AdminSession = {
  adminId: `padmin_${suffix}`,
  email: `padmin-${suffix}@wexon.dev`,
  cloudflareSubject: `cf-sub-${suffix}`,
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3_600_000,
};

const ids: {
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
} = {};

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

describe("admin commercial consistency (DB-backed)", () => {
  before(async () => {
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

  after(async () => {
    __setCommercialAuditWriterForTests(null);
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
    await prisma.$disconnect();
  });

  it("syncs License and Subscription planIds in one transaction on upgrade", async () => {
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
    __setCommercialAuditWriterForTests(null);
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
    assert.equal(license.planId, subscription.planId);
    assert.equal(license.planId, ids.essential);
  });

  it("keeps License and Subscription equal under concurrent plan changes", async () => {
    const [a, b] = await Promise.allSettled([
      changeLicensePlanWithSubscriptionSync({
        organizationId: ids.orgA!,
        licenseId: ids.licenseA!,
        targetPlanId: ids.growth!,
        reason: "Concurrent plan change A",
        confirmed: true,
        actor,
      }),
      changeLicensePlanWithSubscriptionSync({
        organizationId: ids.orgA!,
        licenseId: ids.licenseA!,
        targetPlanId: ids.essential!,
        reason: "Concurrent plan change B",
        confirmed: true,
        actor,
      }),
    ]);
    assert.ok(a.status === "fulfilled" || b.status === "fulfilled");
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.licenseA! } });
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscriptionA! } });
    assert.equal(license.planId, subscription.planId);
  });

  it("fresh PENDING reservation blocks plan change and waive", async () => {
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
    await prisma.activationFeeLedger.create({
      data: {
        organizationId: ids.orgA!,
        productId: ids.product!,
        planId: ids.essential!,
        status: "PENDING",
        activationFeeMinor: 2000000,
        reservedUntil: new Date(Date.now() + 20 * 60 * 1000),
        subscriptionPaymentId: payment.id,
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

    await assert.rejects(
      () =>
        waiveActivationFeeAsAdmin({
          organizationId: ids.orgA!,
          productId: ids.product!,
          reason: "Fresh reservation waive block",
          confirmed: true,
          actor,
        }),
      /rezervasyon/,
    );
  });

  it("waives suitable PENDING ledger and rejects settled repeats", async () => {
    await prisma.activationFeeLedger.update({
      where: {
        organizationId_productId: { organizationId: ids.orgA!, productId: ids.product! },
      },
      data: {
        reservedUntil: null,
        subscriptionPaymentId: null,
        status: "PENDING",
      },
    });

    const waived = await waiveActivationFeeAsAdmin({
      organizationId: ids.orgA!,
      productId: ids.product!,
      reason: "Operasyonel aktivasyon ücreti muafiyeti",
      confirmed: true,
      actor,
    });
    assert.equal(waived.status, "WAIVED");
    assert.equal(waived.waivedByUserId, null);
    assert.equal(waived.reservedUntil, null);

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
      data: { status: "PAID", paidAt: new Date(), waivedReason: null },
    });
    await assert.rejects(
      () =>
        waiveActivationFeeAsAdmin({
          organizationId: ids.orgA!,
          productId: ids.product!,
          reason: "PAID ledger waive edilemez",
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

  it("rolls back waive when audit fails", async () => {
    await prisma.activationFeeLedger.update({
      where: {
        organizationId_productId: { organizationId: ids.orgA!, productId: ids.product! },
      },
      data: {
        status: "PENDING",
        waivedReason: null,
        reservedUntil: null,
        subscriptionPaymentId: null,
        paidAt: null,
      },
    });
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
    __setCommercialAuditWriterForTests(null);
    const ledger = await prisma.activationFeeLedger.findUniqueOrThrow({
      where: {
        organizationId_productId: { organizationId: ids.orgA!, productId: ids.product! },
      },
    });
    assert.equal(ledger.status, "PENDING");
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
