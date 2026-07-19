import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { POST as paytrCallbackPost } from "@/app/api/billing/paytr/callback/route";
import {
  __testOnlyForceActivationFailures,
  handlePaytrSubscriptionCallback,
} from "@/lib/paytr/paytr-callback";
import { buildPaytrCallbackHash } from "@/lib/paytr/paytr-hash";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { reserveActivationFeeForCheckout } from "@/lib/wexon-activation-fee";
import { buildCheckoutQuote } from "@/lib/wexon-billing-tax-policy";
import { getCanonicalTier } from "@/lib/wexpay-canonical-catalog";

assertLocalDbTestGuard(process.env);

const MERCHANT = {
  id: process.env.PAYTR_MERCHANT_ID || "test-merchant-id",
  key: process.env.PAYTR_MERCHANT_KEY || "test-merchant-key",
  salt: process.env.PAYTR_MERCHANT_SALT || "test-merchant-salt",
};

function successBody(merchantOid: string, totalAmount: string) {
  const hash = buildPaytrCallbackHash({
    merchantOid,
    merchantSalt: MERCHANT.salt,
    status: "success",
    totalAmount,
    merchantKey: MERCHANT.key,
  });
  return `merchant_oid=${merchantOid}&status=success&total_amount=${totalAmount}&hash=${encodeURIComponent(hash)}`;
}

function callbackRequest(rawBody: string) {
  return new Request("http://localhost/api/billing/paytr/callback", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: rawBody,
  });
}

describe("paytr callback retry contract (handler + route)", () => {
  let productId = "";
  let planId = "";
  const orgIds: string[] = [];
  const paymentIds: string[] = [];

  before(async () => {
    process.env.PAYTR_MERCHANT_ID = MERCHANT.id;
    process.env.PAYTR_MERCHANT_KEY = MERCHANT.key;
    process.env.PAYTR_MERCHANT_SALT = MERCHANT.salt;
    delete process.env.PAYTR_CALLBACK_SECRET;

    const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
    const plan = await prisma.plan.findFirst({
      where: { isActive: true, OR: [{ tierKey: "essential" }, { key: "wexpay_essential" }] },
    });
    if (!product || !plan) throw new Error("Seed required: wexpay + essential");
    productId = product.id;
    planId = plan.id;
  });

  afterEach(() => {
    __testOnlyForceActivationFailures(0);
  });

  after(async () => {
    __testOnlyForceActivationFailures(0);
    for (const id of paymentIds) {
      await prisma.subscriptionPayment.deleteMany({ where: { id } }).catch(() => undefined);
    }
    for (const oid of orgIds) {
      await prisma.billingPayment.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.invoice.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.subscription.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.license.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.appInstallation.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.organization.delete({ where: { id: oid } }).catch(() => undefined);
    }
  });

  async function createOrg() {
    const org = await prisma.organization.create({
      data: {
        name: `PayTR Retry ${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        slug: `paytr-retry-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        email: `paytr-retry-${Date.now()}-${Math.random().toString(36).slice(2, 5)}@example.com`,
        isDemo: false,
        isActive: true,
      },
    });
    orgIds.push(org.id);
    return org.id;
  }

  async function createPendingPayment(orgId: string, withActivation: boolean) {
    const tier = getCanonicalTier("essential");
    const activation = withActivation ? tier.activationFeeMinor : 0;
    const quote = buildCheckoutQuote({
      subscriptionAmountMinor: tier.monthlyPriceMinor,
      activationFeeAmountMinor: activation,
    });
    const merchantOid = `wxretry${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const payment = await prisma.subscriptionPayment.create({
      data: {
        organizationId: orgId,
        planId,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid,
        amount: quote.grossAmountMinor / 100,
        amountMinor: quote.grossAmountMinor,
        subscriptionAmountMinor: quote.subscriptionAmountMinor,
        activationFeeAmountMinor: quote.activationFeeAmountMinor,
        netAmountMinor: quote.netAmountMinor,
        taxRateBps: quote.taxRateBps,
        taxAmountMinor: quote.taxAmountMinor,
        grossAmountMinor: quote.grossAmountMinor,
        taxEnabledAtPurchase: quote.taxEnabledAtPurchase,
        taxModeAtPurchase: quote.taxModeAtPurchase,
        currency: "TRY",
        taxRatePct: 20,
        billingInterval: "MONTHLY",
        status: "PENDING_CALLBACK",
      },
    });
    paymentIds.push(payment.id);
    if (withActivation) {
      await reserveActivationFeeForCheckout(prisma, {
        organizationId: orgId,
        productId,
        planId,
        activationFeeMinor: activation,
        quote,
        subscriptionPaymentId: payment.id,
        isDemo: false,
      });
    }
    return { payment, quote, merchantOid, totalAmount: String(quote.grossAmountMinor) };
  }

  it("first activation failure returns HTTP 503 non-OK; retry recovers then duplicate OK", async () => {
    const organizationId = await createOrg();
    const { payment, merchantOid, totalAmount, quote } = await createPendingPayment(
      organizationId,
      true,
    );
    const body = successBody(merchantOid, totalAmount);

    __testOnlyForceActivationFailures(1);
    const first = await paytrCallbackPost(callbackRequest(body));
    const firstText = await first.text();

    assert.equal(first.status, 503);
    assert.notEqual(firstText.trim(), "OK");
    assert.equal(firstText.trim(), "ACTIVATION_PENDING_RETRY");
    assert.doesNotMatch(firstText, /prisma|password|secret|DATABASE|activation_forced_failure/i);

    const afterFirst = await prisma.subscriptionPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    assert.equal(afterFirst.status, "PAID");
    assert.equal(afterFirst.subscriptionId, null);

    const ledger = await prisma.activationFeeLedger.findUniqueOrThrow({
      where: { organizationId_productId: { organizationId, productId } },
    });
    assert.equal(ledger.status, "PAID");
    assert.equal(ledger.subscriptionPaymentId, payment.id);
    assert.equal(ledger.activationFeeMinor, quote.activationFeeAmountMinor);

    assert.equal(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: "billing.paytr.subscription_activation_pending_retry",
          entityId: payment.id,
        },
      }),
      1,
    );

    const second = await paytrCallbackPost(callbackRequest(body));
    const secondText = await second.text();
    assert.equal(second.status, 200);
    assert.equal(secondText.trim(), "OK");
    assert.doesNotMatch(secondText, /prisma|password|secret|DATABASE/i);

    const afterSecond = await prisma.subscriptionPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    assert.ok(afterSecond.subscriptionId);

    assert.equal(await prisma.license.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.subscription.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.invoice.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.billingPayment.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.appInstallation.count({ where: { organizationId } }), 1);

    assert.equal(
      await prisma.auditLog.count({
        where: {
          organizationId,
          action: "billing.paytr.subscription_activation_recovered",
          entityId: payment.id,
        },
      }),
      1,
    );

    const third = await paytrCallbackPost(callbackRequest(body));
    const thirdText = await third.text();
    assert.equal(third.status, 200);
    assert.equal(thirdText.trim(), "OK");

    assert.equal(await prisma.license.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.subscription.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.invoice.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.billingPayment.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.appInstallation.count({ where: { organizationId } }), 1);
  });

  it("recovery path failure also returns non-OK 503 until activation succeeds", async () => {
    const organizationId = await createOrg();
    const { payment, merchantOid, totalAmount } = await createPendingPayment(organizationId, false);
    const body = successBody(merchantOid, totalAmount);

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date(), subscriptionId: null },
    });

    __testOnlyForceActivationFailures(1);
    const failed = await handlePaytrSubscriptionCallback({ rawBody: body });
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.reason, "activation_pending_retry");
      assert.equal(failed.status, 503);
    }

    const stillOrphan = await prisma.subscriptionPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    assert.equal(stillOrphan.status, "PAID");
    assert.equal(stillOrphan.subscriptionId, null);

    const recovered = await handlePaytrSubscriptionCallback({ rawBody: body });
    assert.equal(recovered.ok, true);
    if (recovered.ok) {
      assert.equal(recovered.recovered, true);
      assert.equal(recovered.activated, true);
    }
  });
});
