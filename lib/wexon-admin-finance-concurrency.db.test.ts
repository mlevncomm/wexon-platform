import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/lib/wexon-admin-auth";
import { normalizePlatformAdminEmail } from "@/lib/wexon-platform-admin";
import { runAdminMutation } from "@/lib/wexon-admin-mutation-guard";
import { AdminMutationGuardError } from "@/lib/wexon-admin-mutation-errors";
import { generateAdminMutationKey } from "@/lib/wexon-admin-mutation-idempotency";
import {
  executeCreateBillingPayment,
  executeCreateLicense,
  executeCreateSubscription,
  executeUpdateBillingPaymentStatus,
  executeUpdateInvoiceStatus,
} from "@/lib/wexon-admin-finance-operations";
import { toMinorUnits } from "@/lib/wexon-admin-finance-policy";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);

const ids: {
  product?: string;
  essentialPlan?: string;
  growthPlan?: string;
  orgPay?: string;
  orgSub?: string;
  orgLic?: string;
} = {};

const mintedAdminIds: string[] = [];

async function mintActor(tag: string): Promise<AdminSession> {
  const email = `padmin-pr5c-${tag}-${suffix}@wexon.dev`;
  const subject = `cf-sub-pr5c-${tag}-${suffix}`;
  const admin = await prisma.platformAdmin.create({
    data: {
      email,
      emailNormalized: normalizePlatformAdminEmail(email),
      displayName: `PR5C ${tag}`,
      isActive: true,
      cloudflareSubject: subject,
    },
  });
  mintedAdminIds.push(admin.id);
  return {
    adminId: admin.id,
    email: normalizePlatformAdminEmail(email),
    cloudflareSubject: subject,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
}

async function createInvoice(organizationId: string, total: number, tag: string) {
  return prisma.invoice.create({
    data: {
      organizationId,
      invoiceNo: `INV-PR5C-${tag}-${suffix}`,
      status: "ISSUED",
      subtotal: total,
      tax: 0,
      total,
      currency: "TRY",
      issuedAt: new Date(),
    },
  });
}

async function paidCoverageMinor(invoiceId: string) {
  const agg = await prisma.billingPayment.aggregate({
    where: { invoiceId, status: "PAID" },
    _sum: { amount: true },
  });
  return toMinorUnits(Number(agg._sum.amount ?? 0));
}

before(async () => {
  const product =
    (await prisma.product.findFirst({ where: { key: "wexpay" } })) ??
    (await prisma.product.create({
      data: { key: `wexpay-pr5c-${suffix}`, name: "WexPay PR5C", status: "ACTIVE", isActive: true },
    }));
  ids.product = product.id;

  const essential = await prisma.plan.create({
    data: {
      productId: product.id,
      key: `essential-pr5c-${suffix}`,
      name: "Essential PR5C",
      tierKey: "essential",
      sortOrder: 1,
      isActive: true,
      priceMonthly: 100,
      currency: "TRY",
      billingInterval: "MONTHLY",
    },
  });
  ids.essentialPlan = essential.id;

  const growth = await prisma.plan.create({
    data: {
      productId: product.id,
      key: `growth-pr5c-${suffix}`,
      name: "Growth PR5C",
      tierKey: "growth",
      sortOrder: 2,
      isActive: true,
      priceMonthly: 200,
      currency: "TRY",
      billingInterval: "MONTHLY",
    },
  });
  ids.growthPlan = growth.id;

  const orgPay = await prisma.organization.create({
    data: {
      name: `PR5C Pay ${suffix}`,
      slug: `pr5c-pay-${suffix}`,
      isActive: true,
      isDemo: true,
    },
  });
  ids.orgPay = orgPay.id;

  const orgSub = await prisma.organization.create({
    data: {
      name: `PR5C Sub ${suffix}`,
      slug: `pr5c-sub-${suffix}`,
      isActive: true,
      isDemo: true,
    },
  });
  ids.orgSub = orgSub.id;

  const orgLic = await prisma.organization.create({
    data: {
      name: `PR5C Lic ${suffix}`,
      slug: `pr5c-lic-${suffix}`,
      isActive: true,
      isDemo: true,
    },
  });
  ids.orgLic = orgLic.id;
});

after(async () => {
  for (const orgId of [ids.orgPay, ids.orgSub, ids.orgLic]) {
    if (!orgId) continue;
    await prisma.billingPayment.deleteMany({ where: { organizationId: orgId } });
    await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
    await prisma.subscription.deleteMany({ where: { organizationId: orgId } });
    await prisma.appInstallation.deleteMany({ where: { organizationId: orgId } });
    await prisma.license.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
  }
  if (ids.essentialPlan) await prisma.plan.delete({ where: { id: ids.essentialPlan } }).catch(() => undefined);
  if (ids.growthPlan) await prisma.plan.delete({ where: { id: ids.growthPlan } }).catch(() => undefined);
  for (const adminId of mintedAdminIds) {
    await prisma.adminMutationIdempotency.deleteMany({ where: { adminId } });
    await prisma.adminMutationRateLimit.deleteMany({ where: { bucketKey: { contains: adminId } } });
    await prisma.platformAdmin.delete({ where: { id: adminId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe("PR5C finance concurrency (two-admin)", () => {
  it("rejects concurrent 60+60 overpayment on invoice 100", async () => {
    const [adminA, adminB] = await Promise.all([mintActor("a60"), mintActor("b60")]);
    const invoice = await createInvoice(ids.orgPay!, 100, "race60");

    const results = await Promise.allSettled([
      runAdminMutation({
        action: "billing_payment.create",
        actor: adminA,
        organizationId: ids.orgPay!,
        entityType: "BillingPayment",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "admin A concurrent 60",
        requestHashPayload: { invoiceId: invoice.id, amount: 60, admin: "A" },
        execute: ({ tx }) =>
          executeCreateBillingPayment(tx, {
            organizationId: ids.orgPay!,
            invoiceId: invoice.id,
            subscriptionId: null,
            amount: 60,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            providerRef: null,
          }),
      }),
      runAdminMutation({
        action: "billing_payment.create",
        actor: adminB,
        organizationId: ids.orgPay!,
        entityType: "BillingPayment",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "admin B concurrent 60",
        requestHashPayload: { invoiceId: invoice.id, amount: 60, admin: "B" },
        execute: ({ tx }) =>
          executeCreateBillingPayment(tx, {
            organizationId: ids.orgPay!,
            invoiceId: invoice.id,
            subscriptionId: null,
            amount: 60,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            providerRef: null,
          }),
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const err = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(err instanceof AdminMutationGuardError);
    assert.equal(err.code, "finance_invariant_failed");

    const coverage = await paidCoverageMinor(invoice.id);
    assert.ok(coverage <= toMinorUnits(100));
    assert.equal(coverage, toMinorUnits(60));
    const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.notEqual(fresh.status, "PAID");
  });

  it("settles invoice once for concurrent complementary 40+60", async () => {
    const [adminA, adminB] = await Promise.all([mintActor("a40"), mintActor("b60b")]);
    const invoice = await createInvoice(ids.orgPay!, 100, "race4060");

    const results = await Promise.allSettled([
      runAdminMutation({
        action: "billing_payment.create",
        actor: adminA,
        organizationId: ids.orgPay!,
        entityType: "BillingPayment",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "admin A concurrent 40",
        requestHashPayload: { invoiceId: invoice.id, amount: 40 },
        execute: ({ tx }) =>
          executeCreateBillingPayment(tx, {
            organizationId: ids.orgPay!,
            invoiceId: invoice.id,
            subscriptionId: null,
            amount: 40,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            providerRef: null,
          }),
      }),
      runAdminMutation({
        action: "billing_payment.create",
        actor: adminB,
        organizationId: ids.orgPay!,
        entityType: "BillingPayment",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "admin B concurrent 60",
        requestHashPayload: { invoiceId: invoice.id, amount: 60 },
        execute: ({ tx }) =>
          executeCreateBillingPayment(tx, {
            organizationId: ids.orgPay!,
            invoiceId: invoice.id,
            subscriptionId: null,
            amount: 60,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            providerRef: null,
          }),
      }),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    assert.equal(await paidCoverageMinor(invoice.id), toMinorUnits(100));
    const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(fresh.status, "PAID");

    // Settlement is applied once under the invoice lock (idempotent updateMany on ISSUED→PAID).
    const paidPayments = await prisma.billingPayment.count({
      where: { invoiceId: invoice.id, status: "PAID" },
    });
    assert.equal(paidPayments, 2);
  });

  it("allows only one of concurrent full 100+100 payments", async () => {
    const [adminA, adminB] = await Promise.all([mintActor("a100"), mintActor("b100")]);
    const invoice = await createInvoice(ids.orgPay!, 100, "race100");

    const results = await Promise.allSettled([
      runAdminMutation({
        action: "billing_payment.create",
        actor: adminA,
        organizationId: ids.orgPay!,
        entityType: "BillingPayment",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "admin A full 100",
        requestHashPayload: { invoiceId: invoice.id, amount: 100, who: "A" },
        execute: ({ tx }) =>
          executeCreateBillingPayment(tx, {
            organizationId: ids.orgPay!,
            invoiceId: invoice.id,
            subscriptionId: null,
            amount: 100,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            providerRef: null,
          }),
      }),
      runAdminMutation({
        action: "billing_payment.create",
        actor: adminB,
        organizationId: ids.orgPay!,
        entityType: "BillingPayment",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "admin B full 100",
        requestHashPayload: { invoiceId: invoice.id, amount: 100, who: "B" },
        execute: ({ tx }) =>
          executeCreateBillingPayment(tx, {
            organizationId: ids.orgPay!,
            invoiceId: invoice.id,
            subscriptionId: null,
            amount: 100,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            providerRef: null,
          }),
      }),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.equal(await paidCoverageMinor(invoice.id), toMinorUnits(100));
    const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(fresh.status, "PAID");
  });

  it("PENDING→PAID settles invoice when coverage completes", async () => {
    const actor = await mintActor("pending");
    const invoice = await createInvoice(ids.orgPay!, 100, "pending");
    const pending = await prisma.billingPayment.create({
      data: {
        organizationId: ids.orgPay!,
        invoiceId: invoice.id,
        amount: 100,
        currency: "TRY",
        status: "PENDING",
        provider: "admin_manual",
      },
    });

    await runAdminMutation({
      action: "billing_payment.status_change",
      actor,
      organizationId: ids.orgPay!,
      entityType: "BillingPayment",
      entityId: pending.id,
      confirmed: true,
      reason: "pending to paid settlement",
      requestHashPayload: { paymentId: pending.id, status: "PAID" },
      execute: ({ tx }) => executeUpdateBillingPaymentStatus(tx, pending.id, "PAID"),
    });

    const payment = await prisma.billingPayment.findUniqueOrThrow({ where: { id: pending.id } });
    assert.equal(payment.status, "PAID");
    const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(fresh.status, "PAID");
  });

  it("rejects refund of sole PAID coverage on PAID invoice", async () => {
    const actor = await mintActor("refund-deny");
    const invoice = await createInvoice(ids.orgPay!, 100, "refund-deny");
    const payment = await prisma.billingPayment.create({
      data: {
        organizationId: ids.orgPay!,
        invoiceId: invoice.id,
        amount: 100,
        currency: "TRY",
        status: "PAID",
        provider: "admin_manual",
        paidAt: new Date(),
      },
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    await assert.rejects(
      () =>
        runAdminMutation({
          action: "billing_payment.status_change",
          actor,
          organizationId: ids.orgPay!,
          entityType: "BillingPayment",
          entityId: payment.id,
          confirmed: true,
          reason: "attempt sole coverage refund",
          requestHashPayload: { paymentId: payment.id, status: "REFUNDED" },
          execute: ({ tx }) => executeUpdateBillingPaymentStatus(tx, payment.id, "REFUNDED"),
        }),
      (error: unknown) =>
        error instanceof AdminMutationGuardError &&
        error.code === "finance_invariant_failed" &&
        /reconciliation|credit-note/i.test(error.message),
    );

    const freshPayment = await prisma.billingPayment.findUniqueOrThrow({ where: { id: payment.id } });
    const freshInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(freshPayment.status, "PAID");
    assert.equal(freshInvoice.status, "PAID");
  });

  it("allows refund when remaining PAID coverage still meets invoice total", async () => {
    const actor = await mintActor("refund-ok");
    const invoice = await createInvoice(ids.orgPay!, 100, "refund-ok");
    const keep = await prisma.billingPayment.create({
      data: {
        organizationId: ids.orgPay!,
        invoiceId: invoice.id,
        amount: 100,
        currency: "TRY",
        status: "PAID",
        provider: "admin_manual",
        paidAt: new Date(),
      },
    });
    const extra = await prisma.billingPayment.create({
      data: {
        organizationId: ids.orgPay!,
        invoiceId: invoice.id,
        amount: 50,
        currency: "TRY",
        status: "PAID",
        provider: "admin_manual",
        paidAt: new Date(),
      },
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    await runAdminMutation({
      action: "billing_payment.status_change",
      actor,
      organizationId: ids.orgPay!,
      entityType: "BillingPayment",
      entityId: extra.id,
      confirmed: true,
      reason: "refund surplus coverage payment",
      requestHashPayload: { paymentId: extra.id, status: "REFUNDED" },
      execute: ({ tx }) => executeUpdateBillingPaymentStatus(tx, extra.id, "REFUNDED"),
    });

    const refunded = await prisma.billingPayment.findUniqueOrThrow({ where: { id: extra.id } });
    const kept = await prisma.billingPayment.findUniqueOrThrow({ where: { id: keep.id } });
    const freshInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(refunded.status, "REFUNDED");
    assert.equal(kept.status, "PAID");
    assert.equal(freshInvoice.status, "PAID");
    assert.equal(await paidCoverageMinor(invoice.id), toMinorUnits(100));
  });

  it("serializes concurrent invoice PAID status with payment create", async () => {
    const [adminPay, adminStatus] = await Promise.all([mintActor("pay-race"), mintActor("status-race")]);
    const invoice = await createInvoice(ids.orgPay!, 100, "status-race");
    await prisma.billingPayment.create({
      data: {
        organizationId: ids.orgPay!,
        invoiceId: invoice.id,
        amount: 100,
        currency: "TRY",
        status: "PAID",
        provider: "admin_manual",
        paidAt: new Date(),
      },
    });

    const results = await Promise.allSettled([
      runAdminMutation({
        action: "invoice.status_change",
        actor: adminStatus,
        organizationId: ids.orgPay!,
        entityType: "Invoice",
        entityId: invoice.id,
        confirmed: true,
        reason: "manual invoice paid transition",
        requestHashPayload: { invoiceId: invoice.id, status: "PAID" },
        execute: ({ tx }) => executeUpdateInvoiceStatus(tx, invoice.id, "PAID"),
      }),
      runAdminMutation({
        action: "billing_payment.create",
        actor: adminPay,
        organizationId: ids.orgPay!,
        entityType: "BillingPayment",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "racing payment create",
        requestHashPayload: { invoiceId: invoice.id, amount: 1 },
        execute: ({ tx }) =>
          executeCreateBillingPayment(tx, {
            organizationId: ids.orgPay!,
            invoiceId: invoice.id,
            subscriptionId: null,
            amount: 1,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            providerRef: null,
          }),
      }),
    ]);

    // Status→PAID should succeed; extra 1 TRY payment must fail closed as overpayment.
    const statusResult = results[0];
    const payResult = results[1];
    assert.equal(statusResult.status, "fulfilled");
    assert.equal(payResult.status, "rejected");
    const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(fresh.status, "PAID");
    assert.equal(await paidCoverageMinor(invoice.id), toMinorUnits(100));
  });
});

describe("PR5C commercial create concurrency", () => {
  it("fail-closes Growth subscription when Essential license exists", async () => {
    const actor = await mintActor("plan-mismatch");
    await prisma.license.create({
      data: {
        organizationId: ids.orgSub!,
        productId: ids.product!,
        planId: ids.essentialPlan!,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(),
      },
    });

    await assert.rejects(
      () =>
        runAdminMutation({
          action: "subscription.create",
          actor,
          organizationId: ids.orgSub!,
          entityType: "Subscription",
          mutationId: generateAdminMutationKey(),
          confirmed: true,
          reason: "growth against essential license",
          requestHashPayload: { planId: ids.growthPlan! },
          execute: ({ tx }) =>
            executeCreateSubscription(tx, {
              organizationId: ids.orgSub!,
              planId: ids.growthPlan!,
              status: "ACTIVE",
              interval: "MONTHLY",
              currentPeriodStart: new Date(),
              currentPeriodEnd: null,
              provider: "admin_manual",
              providerRef: null,
            }),
        }),
      (error: unknown) =>
        error instanceof AdminMutationGuardError &&
        error.code === "finance_invariant_failed" &&
        /pakete bağlı/i.test(error.message),
    );

    assert.equal(await prisma.subscription.count({ where: { organizationId: ids.orgSub! } }), 0);
    const licenses = await prisma.license.findMany({ where: { organizationId: ids.orgSub! } });
    assert.equal(licenses.length, 1);
    assert.equal(licenses[0]?.planId, ids.essentialPlan);
  });

  it("rejects terminal initial subscription status", async () => {
    const actor = await mintActor("term-status");
    const org = await prisma.organization.create({
      data: {
        name: `PR5C Term ${suffix}`,
        slug: `pr5c-term-${suffix}`,
        isActive: true,
        isDemo: true,
      },
    });
    try {
      await assert.rejects(
        () =>
          runAdminMutation({
            action: "subscription.create",
            actor,
            organizationId: org.id,
            entityType: "Subscription",
            mutationId: generateAdminMutationKey(),
            confirmed: true,
            reason: "terminal status tamper",
            requestHashPayload: { status: "CANCELLED" },
            execute: ({ tx }) =>
              executeCreateSubscription(tx, {
                organizationId: org.id,
                planId: ids.essentialPlan!,
                status: "CANCELLED",
                interval: "MONTHLY",
                currentPeriodStart: new Date(),
                currentPeriodEnd: null,
                provider: "admin_manual",
                providerRef: null,
              }),
          }),
        /TRIALING|ACTIVE|Deneme|Aktif/i,
      );
    } finally {
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });

  it("allows only one concurrent subscription create across two admins", async () => {
    const [adminA, adminB] = await Promise.all([mintActor("sub-a"), mintActor("sub-b")]);
    const org = await prisma.organization.create({
      data: {
        name: `PR5C SubRace ${suffix}`,
        slug: `pr5c-subrace-${suffix}`,
        isActive: true,
        isDemo: true,
      },
    });

    try {
      const results = await Promise.allSettled([
        runAdminMutation({
          action: "subscription.create",
          actor: adminA,
          organizationId: org.id,
          entityType: "Subscription",
          mutationId: generateAdminMutationKey(),
          confirmed: true,
          reason: "concurrent subscription A",
          requestHashPayload: { org: org.id, who: "A" },
          execute: ({ tx }) =>
            executeCreateSubscription(tx, {
              organizationId: org.id,
              planId: ids.growthPlan!,
              status: "ACTIVE",
              interval: "MONTHLY",
              currentPeriodStart: new Date(),
              currentPeriodEnd: null,
              provider: "admin_manual",
              providerRef: null,
            }),
        }),
        runAdminMutation({
          action: "subscription.create",
          actor: adminB,
          organizationId: org.id,
          entityType: "Subscription",
          mutationId: generateAdminMutationKey(),
          confirmed: true,
          reason: "concurrent subscription B",
          requestHashPayload: { org: org.id, who: "B" },
          execute: ({ tx }) =>
            executeCreateSubscription(tx, {
              organizationId: org.id,
              planId: ids.growthPlan!,
              status: "ACTIVE",
              interval: "MONTHLY",
              currentPeriodStart: new Date(),
              currentPeriodEnd: null,
              provider: "admin_manual",
              providerRef: null,
            }),
        }),
      ]);

      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(results.filter((r) => r.status === "rejected").length, 1);
      assert.equal(await prisma.subscription.count({ where: { organizationId: org.id } }), 1);
      assert.equal(
        await prisma.license.count({
          where: { organizationId: org.id, status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] } },
        }),
        1,
      );
      const install = await prisma.appInstallation.findUnique({
        where: { organizationId_productId: { organizationId: org.id, productId: ids.product! } },
      });
      assert.equal(install?.status, "ACTIVE");
      const sub = await prisma.subscription.findFirstOrThrow({ where: { organizationId: org.id } });
      const license = await prisma.license.findUniqueOrThrow({ where: { id: sub.licenseId } });
      assert.equal(sub.planId, ids.growthPlan);
      assert.equal(license.planId, ids.growthPlan);
      assert.equal(sub.status, "ACTIVE");
      assert.equal(license.status, "ACTIVE");
    } finally {
      await prisma.subscription.deleteMany({ where: { organizationId: org.id } });
      await prisma.appInstallation.deleteMany({ where: { organizationId: org.id } });
      await prisma.license.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });

  it("allows only one concurrent license create across two admins", async () => {
    const [adminA, adminB] = await Promise.all([mintActor("lic-a"), mintActor("lic-b")]);
    const results = await Promise.allSettled([
      runAdminMutation({
        action: "license.create",
        actor: adminA,
        organizationId: ids.orgLic!,
        entityType: "License",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "concurrent license A",
        requestHashPayload: { who: "A" },
        execute: ({ tx }) =>
          executeCreateLicense(tx, {
            organizationId: ids.orgLic!,
            productId: ids.product!,
            productKey: "wexpay",
            planId: ids.essentialPlan!,
            licenseType: "MONTHLY",
            startsAt: new Date(),
            endsAt: null,
            status: "ACTIVE",
          }),
      }),
      runAdminMutation({
        action: "license.create",
        actor: adminB,
        organizationId: ids.orgLic!,
        entityType: "License",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "concurrent license B",
        requestHashPayload: { who: "B" },
        execute: ({ tx }) =>
          executeCreateLicense(tx, {
            organizationId: ids.orgLic!,
            productId: ids.product!,
            productKey: "wexpay",
            planId: ids.essentialPlan!,
            licenseType: "MONTHLY",
            startsAt: new Date(),
            endsAt: null,
            status: "ACTIVE",
          }),
      }),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.equal(
      await prisma.license.count({
        where: { organizationId: ids.orgLic!, status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] } },
      }),
      1,
    );
  });

  it("TRIALING create maps license TRIAL and opens installation via lifecycle", async () => {
    const actor = await mintActor("trialing");
    const org = await prisma.organization.create({
      data: {
        name: `PR5C Trial ${suffix}`,
        slug: `pr5c-trial-${suffix}`,
        isActive: true,
        isDemo: true,
      },
    });
    try {
      const result = await runAdminMutation({
        action: "subscription.create",
        actor,
        organizationId: org.id,
        entityType: "Subscription",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "trialing subscription create",
        requestHashPayload: { status: "TRIALING" },
        execute: ({ tx }) =>
          executeCreateSubscription(tx, {
            organizationId: org.id,
            planId: ids.essentialPlan!,
            status: "TRIALING",
            interval: "MONTHLY",
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
            provider: "admin_manual",
            providerRef: null,
          }),
      });
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: result.entityId! } });
      const license = await prisma.license.findUniqueOrThrow({ where: { id: sub.licenseId } });
      const install = await prisma.appInstallation.findUniqueOrThrow({
        where: { organizationId_productId: { organizationId: org.id, productId: ids.product! } },
      });
      assert.equal(sub.status, "TRIALING");
      assert.equal(license.status, "TRIAL");
      assert.equal(install.status, "ACTIVE");
      assert.equal(install.licenseId, license.id);
    } finally {
      await prisma.subscription.deleteMany({ where: { organizationId: org.id } });
      await prisma.appInstallation.deleteMany({ where: { organizationId: org.id } });
      await prisma.license.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });

  it("ACTIVE create maps license ACTIVE and opens installation via lifecycle", async () => {
    const actor = await mintActor("active-create");
    const org = await prisma.organization.create({
      data: {
        name: `PR5C Active ${suffix}`,
        slug: `pr5c-active-${suffix}`,
        isActive: true,
        isDemo: true,
      },
    });
    try {
      const result = await runAdminMutation({
        action: "subscription.create",
        actor,
        organizationId: org.id,
        entityType: "Subscription",
        mutationId: generateAdminMutationKey(),
        confirmed: true,
        reason: "active subscription create",
        requestHashPayload: { status: "ACTIVE" },
        execute: ({ tx }) =>
          executeCreateSubscription(tx, {
            organizationId: org.id,
            planId: ids.essentialPlan!,
            status: "ACTIVE",
            interval: "MONTHLY",
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
            provider: "admin_manual",
            providerRef: null,
          }),
      });
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: result.entityId! } });
      const license = await prisma.license.findUniqueOrThrow({ where: { id: sub.licenseId } });
      const install = await prisma.appInstallation.findUniqueOrThrow({
        where: { organizationId_productId: { organizationId: org.id, productId: ids.product! } },
      });
      assert.equal(sub.status, "ACTIVE");
      assert.equal(license.status, "ACTIVE");
      assert.equal(install.status, "ACTIVE");
    } finally {
      await prisma.subscription.deleteMany({ where: { organizationId: org.id } });
      await prisma.appInstallation.deleteMany({ where: { organizationId: org.id } });
      await prisma.license.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });
});
