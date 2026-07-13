import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CheckoutValidationError, computePlanPrice } from "./wexon-checkout-validation";

describe("computePlanPrice", () => {
  it("computes monthly totals with default 20% tax", () => {
    const price = computePlanPrice(
      { priceMonthly: 1490, priceYearly: 14900, currency: "TRY", taxRatePct: 20 },
      "monthly",
    );
    assert.equal(price.subtotal, 1490);
    assert.equal(price.tax, 298);
    assert.equal(price.total, 1788);
    assert.equal(price.currency, "TRY");
    assert.equal(price.taxRatePct, 20);
  });

  it("computes yearly totals from plan fields", () => {
    const price = computePlanPrice(
      { priceMonthly: 2990, priceYearly: 29900, currency: "TRY", taxRatePct: 20 },
      "yearly",
    );
    assert.equal(price.subtotal, 29900);
    assert.equal(price.tax, 5980);
    assert.equal(price.total, 35880);
  });

  it("throws when interval price is missing", () => {
    assert.throws(
      () => computePlanPrice({ priceMonthly: 1490, currency: "TRY", taxRatePct: 20 }, "yearly"),
      (error: unknown) => error instanceof CheckoutValidationError,
    );
  });
});
