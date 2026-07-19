import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
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
  let paymentId = "";
  let paymentId2 = "";

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
    for (const id of [paymentId, paymentId2]) {
      if (id) await prisma.subscriptionPayment.deleteMany({ where: { id } }).catch(() => undefined);
    }
    for (const oid of [organizationId, otherOrgId]) {
      if (!oid) continue;
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId: oid } }).catch(() => undefined);
      await prisma.organization.delete({ where: { id: oid } }).catch(() => undefined);
    }
  });

  it("charges once, blocks concurrent reserve, releases abandoned PENDING, and isolates orgs", async () => {
    const fee = getCanonicalTier("essential").activationFeeMinor;
    const quote = buildCheckoutQuote({
      subscriptionAmountMinor: getCanonicalTier("essential").monthlyPriceMinor,
      activationFeeAmountMinor: fee,
    });

    const due1 = await resolveActivationFeeDue(prisma, {
      organizationId,
      productId,
      plan: { tierKey: "essential", id: planId },
      isDemo: false,
    });
    assert.equal(due1.due, true);
    assert.equal(due1.amountMinor, fee);

    const payment = await prisma.subscriptionPayment.create({
      data: {
        organizationId,
        planId,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid: `wxact${Date.now()}a`,
        amount: quote.grossAmountMinor / 100,
        amountMinor: quote.grossAmountMinor,
        grossAmountMinor: quote.grossAmountMinor,
        activationFeeAmountMinor: fee,
        currency: "TRY",
        taxRatePct: 20,
        billingInterval: "MONTHLY",
        status: "PENDING_CALLBACK",
      },
    });
    paymentId = payment.id;

    await reserveActivationFeeForCheckout(prisma, {
      organizationId,
      productId,
      planId,
      activationFeeMinor: fee,
      quote,
      subscriptionPaymentId: payment.id,
      isDemo: false,
    });

    const payment2 = await prisma.subscriptionPayment.create({
      data: {
        organizationId,
        planId,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid: `wxact${Date.now()}b`,
        amount: quote.grossAmountMinor / 100,
        amountMinor: quote.grossAmountMinor,
        currency: "TRY",
        taxRatePct: 20,
        billingInterval: "MONTHLY",
        status: "INITIATED",
      },
    });
    paymentId2 = payment2.id;

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
      /ACTIVATION_FEE_RESERVED/,
    );

    await releaseActivationFeeReservation(prisma, {
      organizationId,
      productId,
      subscriptionPaymentId: payment.id,
    });

    const dueAfterFail = await resolveActivationFeeDue(prisma, {
      organizationId,
      productId,
      plan: { tierKey: "essential" },
      isDemo: false,
    });
    assert.equal(dueAfterFail.due, true);

    await reserveActivationFeeForCheckout(prisma, {
      organizationId,
      productId,
      planId,
      activationFeeMinor: fee,
      quote,
      subscriptionPaymentId: payment2.id,
      isDemo: false,
    });
    await markActivationFeePaid(prisma, {
      organizationId,
      productId,
      subscriptionPaymentId: payment2.id,
    });
    const duplicate = await markActivationFeePaid(prisma, {
      organizationId,
      productId,
      subscriptionPaymentId: payment2.id,
    });
    assert.equal(duplicate.updated, false);

    const duePaid = await resolveActivationFeeDue(prisma, {
      organizationId,
      productId,
      plan: { tierKey: "essential" },
      isDemo: false,
    });
    assert.equal(duePaid.due, false);

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
      waivedByUserId: null,
    });
    const waived = await resolveActivationFeeDue(prisma, {
      organizationId: otherOrgId,
      productId,
      plan: { tierKey: "essential" },
      isDemo: false,
    });
    assert.equal(waived.due, false);
    assert.equal(waived.reason, "waived");
  });
});
