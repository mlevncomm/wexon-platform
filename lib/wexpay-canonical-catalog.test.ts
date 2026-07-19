import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanonicalCatalogIntegrity,
  getCanonicalTier,
  listCanonicalTiers,
  getCanonicalTaxPolicy,
  resolveWexPayTierKey,
} from "@/lib/wexpay-canonical-catalog";
import { WEXPAY_TIER_SEED_DEFAULTS, validateTierSeedDefault } from "@/lib/wexpay-tier-config";
import { WEXPAY_PRICING_FALLBACK } from "@/lib/wexon-public-pricing-fallback";
import { catalogCheckoutFallbackTable } from "@/lib/wexon-checkout-validation";
import { majorFromMinor } from "@/lib/wexon-billing-money";

describe("wexpay canonical catalog", () => {
  it("passes integrity checks and exposes four tiers", () => {
    assert.deepEqual(assertCanonicalCatalogIntegrity(), []);
    assert.equal(listCanonicalTiers().length, 4);
  });

  it("locks commercial prices, activation fees, and limits", () => {
    const essential = getCanonicalTier("essential");
    assert.equal(essential.displayName, "WexPay Essential");
    assert.equal(essential.monthlyPriceMinor, 750_000);
    assert.equal(essential.yearlyPriceMinor, 7_500_000);
    assert.equal(essential.activationFeeMinor, 2_000_000);
    assert.equal(essential.entitlements.branch_limit, 1);
    assert.equal(essential.entitlements.table_limit, 50);
    assert.equal(essential.entitlements.staff_limit, 10);
    assert.equal(essential.entitlements.product_limit, 300);
    assert.equal(essential.entitlements.monthly_order_limit, 6000);

    const growth = getCanonicalTier("growth");
    assert.equal(growth.displayName, "WexPay Growth");
    assert.equal(growth.monthlyPriceMinor, 1_500_000);
    assert.equal(growth.yearlyPriceMinor, 15_000_000);
    assert.equal(growth.activationFeeMinor, 4_000_000);
    assert.equal(growth.entitlements.branch_limit, 5);
    assert.equal(growth.entitlements.table_limit, 200);
    assert.equal(growth.entitlements.staff_limit, 40);
    assert.equal(growth.entitlements.product_limit, 1500);
    assert.equal(growth.entitlements.monthly_order_limit, 30_000);

    const scale = getCanonicalTier("scale");
    assert.equal(scale.displayName, "WexPay Scale");
    assert.equal(scale.monthlyPriceMinor, 3_500_000);
    assert.equal(scale.yearlyPriceMinor, 35_000_000);
    assert.equal(scale.activationFeeMinor, 9_000_000);
    assert.equal(scale.entitlements.branch_limit, 25);
    assert.equal(scale.entitlements.table_limit, 1000);
    assert.equal(scale.entitlements.staff_limit, 200);
    assert.equal(scale.entitlements.product_limit, 7500);
    assert.equal(scale.entitlements.monthly_order_limit, 150_000);

    const enterprise = getCanonicalTier("business_suite");
    assert.equal(enterprise.displayName, "WexPay Enterprise");
    assert.equal(enterprise.tierKey, "business_suite");
    assert.equal(enterprise.monthlyPriceMinor, 7_500_000);
    assert.equal(enterprise.yearlyPriceMinor, null);
    assert.equal(enterprise.activationFeeMinor, 20_000_000);
    assert.equal(enterprise.customPricing, true);
    assert.equal(enterprise.ctaKind, "book_meeting");
    assert.equal(enterprise.entitlements.branch_limit, -1);
    assert.equal(enterprise.entitlements.table_limit, -1);
  });

  it("keeps seed, public pricing, and checkout fallback in parity", () => {
    for (const tier of WEXPAY_TIER_SEED_DEFAULTS) {
      assert.deepEqual(validateTierSeedDefault(tier), []);
      const canonical = getCanonicalTier(tier.tierKey);
      assert.equal(tier.name, canonical.displayName);
      assert.equal(tier.monthlyFee, majorFromMinor(canonical.monthlyPriceMinor));
      assert.equal(tier.setupFee, majorFromMinor(canonical.activationFeeMinor));
    }

    assert.equal(WEXPAY_PRICING_FALLBACK[0].priceLabel, "₺7.500/ay");
    assert.equal(WEXPAY_PRICING_FALLBACK[3].name, "WexPay Enterprise");
    assert.equal(WEXPAY_PRICING_FALLBACK[3].priceLabel, "₺75.000/ay");

    const checkout = catalogCheckoutFallbackTable();
    assert.equal(checkout.find((r) => r.tierKey === "essential")?.monthly, 7500);
    assert.equal(checkout.find((r) => r.tierKey === "essential")?.activation, 20000);
    assert.equal(checkout.find((r) => r.tierKey === "business_suite")?.yearly, null);
  });

  it("maps legacy keys and exposes tax-disabled policy", () => {
    assert.equal(resolveWexPayTierKey("enterprise"), "business_suite");
    const tax = getCanonicalTaxPolicy();
    assert.equal(tax.taxEnabled, false);
    assert.equal(tax.taxRateBps, 2000);
    assert.equal(tax.taxMode, "EXCLUSIVE");
  });
});
