import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WEXPAY_CURRENCY,
  WEXPAY_PLAN_CATALOG,
  WEXPAY_PLAN_KEYS,
  WEXPAY_TAX_RATE,
  getWexPayPlan,
  withTax,
} from "@/lib/wexon-plan-catalog.mjs";
import {
  checkoutPrice,
  checkoutPriceMap,
  type CheckoutPlanKey,
} from "@/lib/wexon-checkout-validation";

describe("wexon plan catalog", () => {
  it("defines exactly the basic/standard/pro tiers with wexpay_ db keys", () => {
    assert.deepEqual(
      WEXPAY_PLAN_CATALOG.map((plan) => plan.planKey),
      ["basic", "standard", "pro"],
    );
    for (const plan of WEXPAY_PLAN_CATALOG) {
      assert.equal(plan.dbKey, `wexpay_${plan.planKey}`);
      assert.equal(plan.currency, WEXPAY_CURRENCY);
      assert.ok(plan.priceMonthly > 0, `${plan.planKey} monthly price must be positive`);
      assert.ok(plan.priceYearly > 0, `${plan.planKey} yearly price must be positive`);
      assert.ok(Array.isArray(plan.features) && plan.features.length > 0);
    }
  });

  it("exposes WEXPAY_PLAN_KEYS matching the catalog", () => {
    assert.deepEqual([...WEXPAY_PLAN_KEYS], WEXPAY_PLAN_CATALOG.map((plan) => plan.planKey));
  });

  it("getWexPayPlan resolves known keys and rejects unknown ones", () => {
    assert.equal(getWexPayPlan("standard")?.dbKey, "wexpay_standard");
    assert.equal(getWexPayPlan("nope"), null);
  });

  it("withTax applies the KDV rate on top of the subtotal", () => {
    const breakdown = withTax(1000);
    assert.deepEqual(breakdown, {
      subtotal: 1000,
      tax: Math.round(1000 * WEXPAY_TAX_RATE),
      total: 1000 + Math.round(1000 * WEXPAY_TAX_RATE),
      currency: WEXPAY_CURRENCY,
    });
  });
});

describe("checkout pricing stays consistent with the catalog", () => {
  for (const plan of WEXPAY_PLAN_CATALOG) {
    const planKey = plan.planKey as CheckoutPlanKey;

    it(`${planKey}: checkoutPriceMap matches catalog subtotals`, () => {
      assert.equal(checkoutPriceMap.wexpay[planKey].monthly, plan.priceMonthly);
      assert.equal(checkoutPriceMap.wexpay[planKey].yearly, plan.priceYearly);
    });

    it(`${planKey}: checkoutPrice returns catalog subtotal + KDV`, () => {
      const monthly = checkoutPrice("wexpay", planKey, "monthly");
      assert.equal(monthly.subtotal, plan.priceMonthly);
      assert.equal(monthly.tax, Math.round(plan.priceMonthly * WEXPAY_TAX_RATE));
      assert.equal(monthly.total, monthly.subtotal + monthly.tax);
      assert.equal(monthly.currency, WEXPAY_CURRENCY);

      const yearly = checkoutPrice("wexpay", planKey, "yearly");
      assert.equal(yearly.subtotal, plan.priceYearly);
      assert.equal(yearly.total, yearly.subtotal + yearly.tax);
    });
  }
});
