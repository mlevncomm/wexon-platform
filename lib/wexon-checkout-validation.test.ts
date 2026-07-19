import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CheckoutValidationError, computeCheckoutQuote, computePlanPrice } from "./wexon-checkout-validation";
import { buildCheckoutQuote } from "./wexon-billing-tax-policy";

describe("computePlanPrice", () => {
  it("uses canonical tax-disabled policy (tax=0, gross=net) for custom plans", () => {
    const price = computePlanPrice(
      { priceMonthly: 1490, priceYearly: 14900, currency: "TRY", taxRatePct: 20 },
      "monthly",
    );
    assert.equal(price.subtotal, 1490);
    assert.equal(price.tax, 0);
    assert.equal(price.total, 1490);
    assert.equal(price.currency, "TRY");
    assert.equal(price.taxRatePct, 20);
  });

  it("computes yearly totals from plan fields without tax when disabled", () => {
    const price = computePlanPrice(
      { priceMonthly: 2990, priceYearly: 29900, currency: "TRY", taxRatePct: 20 },
      "yearly",
    );
    assert.equal(price.subtotal, 29900);
    assert.equal(price.tax, 0);
    assert.equal(price.total, 29900);
  });

  it("throws when interval price is missing", () => {
    assert.throws(
      () => computePlanPrice({ priceMonthly: 1490, currency: "TRY", taxRatePct: 20 }, "yearly"),
      (error: unknown) => error instanceof CheckoutValidationError,
    );
  });

  it("prefers canonical catalog prices for known tiers", () => {
    const price = computePlanPrice({ tierKey: "essential", currency: "TRY" }, "monthly");
    assert.equal(price.total, 7500);
  });
});

describe("computeCheckoutQuote", () => {
  it("includes activation fee on first purchase snapshot", () => {
    const quote = computeCheckoutQuote({
      plan: { tierKey: "essential" },
      interval: "monthly",
      activationFeeAmountMinor: 2_000_000,
    });
    assert.equal(quote.grossAmountMinor, 2_750_000);
    assert.equal(quote.taxEnabledAtPurchase, false);
  });

  it("supports tax-enabled override for pure unit coverage", () => {
    const quote = buildCheckoutQuote({
      subscriptionAmountMinor: 1_000_000,
      activationFeeAmountMinor: 0,
      taxPolicy: { taxEnabled: true, taxRateBps: 2000, taxMode: "EXCLUSIVE" },
    });
    assert.equal(quote.taxAmountMinor, 200_000);
    assert.equal(quote.grossAmountMinor, 1_200_000);
  });
});
