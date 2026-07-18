import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildPaytrCallbackHash } from "@/lib/paytr/paytr-hash";
import { handlePaytrSubscriptionCallback } from "@/lib/paytr/paytr-callback";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";

/**
 * DB-backed PayTR subscription callback. Guard MUST run before any Prisma query.
 * Run via: WEXON_ALLOW_LOCAL_DB_TESTS=1 npm run test:unit:db
 */
assertLocalDbTestGuard(process.env);

const MERCHANT = {
  id: process.env.PAYTR_MERCHANT_ID || "test-merchant-id",
  key: process.env.PAYTR_MERCHANT_KEY || "test-merchant-key",
  salt: process.env.PAYTR_MERCHANT_SALT || "test-merchant-salt",
};

describe("paytr subscription callback service", () => {
  let organizationId = "";
  let planId = "";
  let paymentId = "";
  let merchantOid = "";

  before(async () => {
    process.env.PAYTR_MERCHANT_ID = MERCHANT.id;
    process.env.PAYTR_MERCHANT_KEY = MERCHANT.key;
    process.env.PAYTR_MERCHANT_SALT = MERCHANT.salt;

    const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
    const plan = await prisma.plan.findFirst({
      where: {
        isActive: true,
        OR: [{ key: "wexpay_growth" }, { tierKey: "growth" }, { key: "wexpay_standard" }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!product || !plan) {
      throw new Error("Seed required: wexpay product + active Growth (or legacy Standard) plan");
    }
    planId = plan.id;

    const org = await prisma.organization.create({
      data: {
        name: `PayTR Test Org ${Date.now()}`,
        slug: `paytr-test-${Date.now()}`,
        email: `paytr-test-${Date.now()}@example.com`,
        isDemo: false,
        isActive: true,
      },
    });
    organizationId = org.id;

    merchantOid = `wxsubtest${Date.now()}`;
    const payment = await prisma.subscriptionPayment.create({
      data: {
        organizationId,
        planId,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid,
        amount: 1788,
        amountMinor: 178800,
        currency: "TRY",
        taxRatePct: 20,
        billingInterval: "MONTHLY",
        status: "PENDING_CALLBACK",
      },
    });
    paymentId = payment.id;
  });

  after(async () => {
    if (paymentId) {
      await prisma.subscriptionPayment.deleteMany({ where: { id: paymentId } }).catch(() => undefined);
    }
    if (organizationId) {
      await prisma.billingPayment.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.invoice.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.subscription.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.license.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.appInstallation.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
    }
  });

  it("rejects invalid hash", async () => {
    const result = await handlePaytrSubscriptionCallback({
      rawBody: `merchant_oid=${merchantOid}&status=success&total_amount=178800&hash=invalid`,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "hash_invalid");
  });

  it("activates subscription once on success and is idempotent", async () => {
    const hash = buildPaytrCallbackHash({
      merchantOid,
      merchantSalt: MERCHANT.salt,
      status: "success",
      totalAmount: "178800",
      merchantKey: MERCHANT.key,
    });
    const body = `merchant_oid=${merchantOid}&status=success&total_amount=178800&hash=${encodeURIComponent(hash)}`;

    const first = await handlePaytrSubscriptionCallback({ rawBody: body });
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.activated, true);

    const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    assert.equal(payment?.status, "PAID");
    assert.ok(payment?.subscriptionId);

    const second = await handlePaytrSubscriptionCallback({ rawBody: body });
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.duplicate, true);

    const subs = await prisma.subscription.count({ where: { organizationId, status: "ACTIVE" } });
    assert.equal(subs, 1);
  });

  it("failed callback does not activate", async () => {
    const oid = `wxsubfail${Date.now()}`;
    const failedPayment = await prisma.subscriptionPayment.create({
      data: {
        organizationId,
        planId,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid: oid,
        amount: 1788,
        amountMinor: 178800,
        currency: "TRY",
        taxRatePct: 20,
        billingInterval: "MONTHLY",
        status: "PENDING_CALLBACK",
      },
    });

    const hash = buildPaytrCallbackHash({
      merchantOid: oid,
      merchantSalt: MERCHANT.salt,
      status: "failed",
      totalAmount: "178800",
      merchantKey: MERCHANT.key,
    });
    const result = await handlePaytrSubscriptionCallback({
      rawBody: `merchant_oid=${oid}&status=failed&total_amount=178800&hash=${encodeURIComponent(hash)}&failed_reason_msg=card`,
    });
    assert.equal(result.ok, true);

    const payment = await prisma.subscriptionPayment.findUnique({ where: { id: failedPayment.id } });
    assert.equal(payment?.status, "FAILED");
    assert.equal(payment?.subscriptionId, null);

    await prisma.subscriptionPayment.delete({ where: { id: failedPayment.id } });
  });

  it("amount mismatch marks failed and does not activate new subscription", async () => {
    const oid = `wxsubamt${Date.now()}`;
    const payment = await prisma.subscriptionPayment.create({
      data: {
        organizationId,
        planId,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid: oid,
        amount: 1788,
        amountMinor: 178800,
        currency: "TRY",
        taxRatePct: 20,
        billingInterval: "MONTHLY",
        status: "PENDING_CALLBACK",
      },
    });

    const hash = buildPaytrCallbackHash({
      merchantOid: oid,
      merchantSalt: MERCHANT.salt,
      status: "success",
      totalAmount: "1",
      merchantKey: MERCHANT.key,
    });
    const result = await handlePaytrSubscriptionCallback({
      rawBody: `merchant_oid=${oid}&status=success&total_amount=1&hash=${encodeURIComponent(hash)}`,
    });
    assert.equal(result.ok, true);

    const updated = await prisma.subscriptionPayment.findUnique({ where: { id: payment.id } });
    assert.equal(updated?.status, "FAILED");
    assert.equal(updated?.failedReasonCode, "amount_mismatch");

    await prisma.subscriptionPayment.delete({ where: { id: payment.id } });
  });
});
