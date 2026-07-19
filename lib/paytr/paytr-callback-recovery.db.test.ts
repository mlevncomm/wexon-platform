import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildPaytrCallbackHash } from "@/lib/paytr/paytr-hash";
import { handlePaytrSubscriptionCallback } from "@/lib/paytr/paytr-callback";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  markActivationFeePaid,
  reserveActivationFeeForCheckout,
} from "@/lib/wexon-activation-fee";
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

describe("paytr subscription callback recovery", () => {
  let productId = "";
  let planId = "";
  const orgIds: string[] = [];
  const paymentIds: string[] = [];

  before(async () => {
    process.env.PAYTR_MERCHANT_ID = MERCHANT.id;
    process.env.PAYTR_MERCHANT_KEY = MERCHANT.key;
    process.env.PAYTR_MERCHANT_SALT = MERCHANT.salt;

    const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
    const plan = await prisma.plan.findFirst({
      where: { isActive: true, OR: [{ tierKey: "essential" }, { key: "wexpay_essential" }] },
    });
    if (!product || !plan) throw new Error("Seed required: wexpay + essential");
    productId = product.id;
    planId = plan.id;
  });

  after(async () => {
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
        name: `PayTR Recover ${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        slug: `paytr-rec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        email: `paytr-rec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}@example.com`,
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
    const merchantOid = `wxrec${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
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

  it("recovers PAID payment with null subscriptionId and matching PAID activation ledger", async () => {
    const organizationId = await createOrg();
    const { payment, merchantOid, totalAmount, quote } = await createPendingPayment(organizationId, true);

    await prisma.$transaction(async (tx) => {
      await markActivationFeePaid(tx, {
        organizationId,
        productId,
        subscriptionPaymentId: payment.id,
        activationFeeAmountMinor: quote.activationFeeAmountMinor,
      });
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: new Date(), subscriptionId: null },
      });
    });

    const first = await handlePaytrSubscriptionCallback({
      rawBody: successBody(merchantOid, totalAmount),
    });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.recovered, true);
      assert.equal(first.activated, true);
    }

    const updated = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.ok(updated.subscriptionId);

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

    const second = await handlePaytrSubscriptionCallback({
      rawBody: successBody(merchantOid, totalAmount),
    });
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.duplicate, true);

    assert.equal(await prisma.license.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.subscription.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.invoice.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.billingPayment.count({ where: { organizationId } }), 1);
    assert.equal(await prisma.appInstallation.count({ where: { organizationId } }), 1);
  });

  it("retries after activation failure leave payment PAID then second callback recovers", async () => {
    const organizationId = await createOrg();
    const { payment, merchantOid, totalAmount } = await createPendingPayment(organizationId, false);

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date(), subscriptionId: null },
    });

    const recovered = await handlePaytrSubscriptionCallback({
      rawBody: successBody(merchantOid, totalAmount),
    });
    assert.equal(recovered.ok, true);
    if (recovered.ok) assert.equal(recovered.recovered, true);

    const linked = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.ok(linked.subscriptionId);

    const again = await handlePaytrSubscriptionCallback({
      rawBody: successBody(merchantOid, totalAmount),
    });
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.duplicate, true);
  });

  it("PAID with subscriptionId is a normal duplicate", async () => {
    const organizationId = await createOrg();
    const { payment, merchantOid, totalAmount } = await createPendingPayment(organizationId, false);
    const body = successBody(merchantOid, totalAmount);
    const first = await handlePaytrSubscriptionCallback({ rawBody: body });
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.activated, true);

    const paid = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.ok(paid.subscriptionId);

    const second = await handlePaytrSubscriptionCallback({ rawBody: body });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.duplicate, true);
      assert.equal(second.recovered, undefined);
    }
  });

  it("ownership mismatch does not open a subscription", async () => {
    const organizationId = await createOrg();
    const a = await createPendingPayment(organizationId, true);
    const b = await createPendingPayment(organizationId, false);

    await prisma.subscriptionPayment.update({
      where: { id: b.payment.id },
      data: {
        activationFeeAmountMinor: a.quote.activationFeeAmountMinor,
        grossAmountMinor: a.quote.grossAmountMinor,
        amountMinor: a.quote.grossAmountMinor,
        amount: a.quote.grossAmountMinor / 100,
        netAmountMinor: a.quote.netAmountMinor,
      },
    });

    const result = await handlePaytrSubscriptionCallback({
      rawBody: successBody(b.merchantOid, String(a.quote.grossAmountMinor)),
    });
    assert.equal(result.ok, true);

    const updated = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: b.payment.id } });
    assert.equal(updated.status, "FAILED");
    assert.equal(updated.subscriptionId, null);
    assert.match(updated.failedReasonCode ?? "", /ownership|activation_fee/i);

    assert.equal(
      await prisma.subscription.count({
        where: { organizationId, providerRef: b.merchantOid },
      }),
      0,
    );
  });

  it("renewal with activationFeeAmountMinor=0 does not mutate existing PAID ledger", async () => {
    const organizationId = await createOrg();
    const first = await createPendingPayment(organizationId, true);
    const activated = await handlePaytrSubscriptionCallback({
      rawBody: successBody(first.merchantOid, first.totalAmount),
    });
    assert.equal(activated.ok, true);

    const ledgerBefore = await prisma.activationFeeLedger.findUniqueOrThrow({
      where: { organizationId_productId: { organizationId, productId } },
    });
    assert.equal(ledgerBefore.status, "PAID");
    const paidPaymentId = ledgerBefore.subscriptionPaymentId;

    const renewal = await createPendingPayment(organizationId, false);
    await prisma.subscriptionPayment.update({
      where: { id: renewal.payment.id },
      data: { status: "PAID", paidAt: new Date(), subscriptionId: null, activationFeeAmountMinor: 0 },
    });

    const result = await handlePaytrSubscriptionCallback({
      rawBody: successBody(renewal.merchantOid, renewal.totalAmount),
    });
    assert.equal(result.ok, true);

    const ledgerAfter = await prisma.activationFeeLedger.findUniqueOrThrow({
      where: { organizationId_productId: { organizationId, productId } },
    });
    assert.equal(ledgerAfter.status, "PAID");
    assert.equal(ledgerAfter.subscriptionPaymentId, paidPaymentId);
    assert.equal(ledgerAfter.activationFeeMinor, ledgerBefore.activationFeeMinor);
  });
});
