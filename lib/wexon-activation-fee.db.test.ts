import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  ActivationFeeError,
  ACTIVATION_RESERVE_MS,
  markActivationFeePaid,
  releaseActivationFeeReservation,
  reserveActivationFeeForCheckout,
  resolveActivationFeeDue,
  waiveActivationFee,
} from "@/lib/wexon-activation-fee";
import { buildCheckoutQuote } from "@/lib/wexon-billing-tax-policy";
import { getCanonicalTier } from "@/lib/wexpay-canonical-catalog";

assertLocalDbTestGuard(process.env);

describe("activation fee ledger (db)", () => {
  let organizationId = "";
  let otherOrgId = "";
  let productId = "";
  let planId = "";
  const paymentIds: string[] = [];

  before(async () => {
    const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
    const plan = await prisma.plan.findFirst({
      where: { isActive: true, OR: [{ tierKey: "essential" }, { key: "wexpay_essential" }] },
    });
    if (!product || !plan) throw new Error("Seed required: wexpay + essential plan");
    productId = product.id;
    planId = plan.id;

    assert.equal(Number(plan.processingFeePct), 0);
    assert.equal(Number(plan.minimumTransactionCommitment ?? 0), 0);

    const org = await prisma.organization.create({
      data: {
        name: `ActFee ${Date.now()}`,
        slug: `actfee-${Date.now()}`,
        email: `actfee-${Date.now()}@example.com`,
        isDemo: false,
        isActive: true,
      },
    });
    organizationId = org.id;

    const other = await prisma.organization.create({
      data: {
        name: `ActFee Other ${Date.now()}`,
        slug: `actfee-other-${Date.now()}`,
        email: `actfee-other-${Date.now()}@example.com`,
        isDemo: false,
        isActive: true,
      },
    });
    otherOrgId = other.id;
  });

  after(async () => {
    for (const id of paymentIds) {
      await prisma.subscriptionPayment.deleteMany({ where: { id } }).catch(() => undefined);
    }
    for (const oid of [organizationId, otherOrgId]) {
      if (!oid) continue;
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.organization.delete({ where: { id: oid } }).catch(() => undefined);
    }
  });

  async function createPayment(orgId: string, quote: ReturnType<typeof buildCheckoutQuote>) {
    const payment = await prisma.subscriptionPayment.create({
      data: {
        organizationId: orgId,
        planId,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid: `wxact${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
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
    return payment;
  }

  it("stores activation line-item only, blocks concurrent reserve, and enforces ownership", async () => {
    const fee = getCanonicalTier("essential").activationFeeMinor;
    const quote = buildCheckoutQuote({
      subscriptionAmountMinor: getCanonicalTier("essential").monthlyPriceMinor,
      activationFeeAmountMinor: fee,
    });
    assert.equal(quote.grossAmountMinor, 2_750_000);
    assert.equal(quote.activationGrossAmountMinor, 2_000_000);

    const due1 = await resolveActivationFeeDue(prisma, {
      organizationId,
      productId,
      plan: { tierKey: "essential", id: planId },
      isDemo: false,
    });
    assert.equal(due1.due, true);
    assert.equal(due1.amountMinor, fee);

    const payment = await createPayment(organizationId, quote);
    await reserveActivationFeeForCheckout(prisma, {
      organizationId,
      productId,
      planId,
      activationFeeMinor: fee,
      quote,
      subscriptionPaymentId: payment.id,
      isDemo: false,
    });

    const ledger = await prisma.activationFeeLedger.findUniqueOrThrow({
      where: { organizationId_productId: { organizationId, productId } },
    });
    assert.equal(ledger.activationFeeMinor, 2_000_000);
    assert.equal(ledger.taxAmountMinor, 0);
    assert.equal(ledger.grossAmountMinor, 2_000_000);
    assert.notEqual(ledger.grossAmountMinor, quote.grossAmountMinor);

    const payment2 = await createPayment(organizationId, quote);
    await assert.rejects(
      () =>
        reserveActivationFeeForCheckout(prisma, {
          organizationId,
          productId,
          planId,
          activationFeeMinor: fee,
          quote,
          subscriptionPaymentId: payment2.id,
          isDemo: false,
        }),
      (error: unknown) => error instanceof ActivationFeeError && error.code === "ACTIVATION_FEE_RESERVED",
    );

    // Stale callback after release (timeout path): cannot claim ownership.
    await releaseActivationFeeReservation(prisma, {
      organizationId,
      productId,
      subscriptionPaymentId: payment.id,
    });
    await assert.rejects(
      () =>
        markActivationFeePaid(prisma, {
          organizationId,
          productId,
          subscriptionPaymentId: payment.id,
          activationFeeAmountMinor: fee,
        }),
      (error: unknown) => error instanceof ActivationFeeError && error.code === "ACTIVATION_FEE_STALE_CALLBACK",
    );

    // New reservation by payment2; stale payment1 must not overwrite.
    await reserveActivationFeeForCheckout(prisma, {
      organizationId,
      productId,
      planId,
      activationFeeMinor: fee,
      quote,
      subscriptionPaymentId: payment2.id,
      isDemo: false,
    });
    await assert.rejects(
      () =>
        markActivationFeePaid(prisma, {
          organizationId,
          productId,
          subscriptionPaymentId: payment.id,
          activationFeeAmountMinor: fee,
        }),
      (error: unknown) => error instanceof ActivationFeeError && error.code === "ACTIVATION_FEE_OWNERSHIP_MISMATCH",
    );

    await markActivationFeePaid(prisma, {
      organizationId,
      productId,
      subscriptionPaymentId: payment2.id,
      activationFeeAmountMinor: fee,
    });
    const duplicate = await markActivationFeePaid(prisma, {
      organizationId,
      productId,
      subscriptionPaymentId: payment2.id,
      activationFeeAmountMinor: fee,
    });
    assert.equal(duplicate.updated, false);
    assert.equal("duplicate" in duplicate && duplicate.duplicate, true);

    await assert.rejects(
      () =>
        markActivationFeePaid(prisma, {
          organizationId,
          productId,
          subscriptionPaymentId: payment.id,
          activationFeeAmountMinor: fee,
        }),
      (error: unknown) => error instanceof ActivationFeeError && error.code === "ACTIVATION_FEE_OWNERSHIP_MISMATCH",
    );

    // Renewal-style payment with 0 activation fee is a no-op against PAID ledger.
    const renewal = await markActivationFeePaid(prisma, {
      organizationId,
      productId,
      subscriptionPaymentId: payment.id,
      activationFeeAmountMinor: 0,
    });
    assert.equal(renewal.updated, false);
    assert.equal("alreadySettled" in renewal && renewal.alreadySettled, true);

    const otherDue = await resolveActivationFeeDue(prisma, {
      organizationId: otherOrgId,
      productId,
      plan: { tierKey: "essential" },
      isDemo: false,
    });
    assert.equal(otherDue.due, true);

    await waiveActivationFee(prisma, {
      organizationId: otherOrgId,
      productId,
      reason: "admin_test_waiver",
    });
    const waived = await resolveActivationFeeDue(prisma, {
      organizationId: otherOrgId,
      productId,
      plan: { tierKey: "essential" },
      isDemo: false,
    });
    assert.equal(waived.due, false);
    assert.equal(waived.reason, "waived");

    await assert.rejects(
      () =>
        waiveActivationFee(prisma, {
          organizationId: otherOrgId,
          productId,
          reason: "second_waiver",
        }),
      (error: unknown) => error instanceof ActivationFeeError && error.code === "ACTIVATION_FEE_IMMUTABLE",
    );

    // Tax-enabled quote: ledger activation gross includes only activation tax.
    const taxedQuote = buildCheckoutQuote({
      subscriptionAmountMinor: 750_000,
      activationFeeAmountMinor: 2_000_000,
      taxPolicy: { taxEnabled: true, taxRateBps: 2000, taxMode: "EXCLUSIVE" },
    });
    assert.equal(taxedQuote.activationGrossAmountMinor, 2_400_000);
    assert.equal(taxedQuote.grossAmountMinor, 3_300_000);
    assert.equal(ACTIVATION_RESERVE_MS, 30 * 60 * 1000);
  });
});
