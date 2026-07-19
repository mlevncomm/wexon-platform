import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanonicalCatalogIntegrity,
  getCanonicalTier,
  listCanonicalTiers,
  getCanonicalTaxPolicy,
  resolveWexPayTierKey,
} from "@/lib/wexpay-canonical-catalog";
import { WEXPAY_TIER_SEED_DEFAULTS, validateTierSeedDefault, WEXPAY_ZERO_COMMISSION_LABEL, WEXPAY_NO_COMMITMENT_LABEL, WEXPAY_PROCESSING_DISCLAIMER } from "@/lib/wexpay-tier-config";
import { WEXPAY_PRICING_FALLBACK } from "@/lib/wexon-public-pricing-fallback";
import { catalogCheckoutFallbackTable } from "@/lib/wexon-checkout-validation";
import { majorFromMinor } from "@/lib/wexon-billing-money";
import { WEXPAY_UNFINISHED_FEATURE_KEYS, entitlementDefaultsForTier } from "@/lib/wexpay-entitlement-map";

describe("wexpay canonical catalog", () => {
  it("passes integrity checks and exposes four tiers", () => {
    assert.deepEqual(assertCanonicalCatalogIntegrity(), []);
    assert.equal(listCanonicalTiers().length, 4);
  });

  it("locks commercial prices, activation fees, and zero processing fees", () => {
    for (const tier of listCanonicalTiers()) {
      assert.equal(tier.processingFeePct, 0);
      assert.equal(tier.minimumTransactionCommitmentMinor, 0);
      assert.equal(tier.limits.apiAccess, false);
      for (const key of WEXPAY_UNFINISHED_FEATURE_KEYS) {
        assert.equal(tier.entitlements[key], false, `${tier.tierKey}.${key}`);
      }
    }

    const essential = getCanonicalTier("essential");
    assert.equal(essential.displayName, "WexPay Essential");
    assert.equal(essential.monthlyPriceMinor, 750_000);
    assert.equal(essential.activationFeeMinor, 2_000_000);
    assert.equal(essential.entitlements.table_limit, 50);
    assert.equal(essential.entitlements.feature_guest_order, true);
    assert.equal(essential.entitlements.feature_custom_split, false);
    assert.equal(essential.entitlements.feature_csv_export, false);
    assert.equal(essential.entitlements.feature_multi_location, false);

    const growth = getCanonicalTier("growth");
    assert.equal(growth.entitlements.feature_custom_split, true);
    assert.equal(growth.entitlements.feature_advanced_roles, true);
    assert.equal(growth.entitlements.feature_advanced_reports, true);
    assert.equal(growth.entitlements.feature_csv_export, true);
    assert.equal(growth.entitlements.feature_multi_location, true);
    assert.equal(growth.entitlements.feature_custom_branding, true);
    assert.equal(growth.entitlements.feature_api_access, false);

    const enterprise = getCanonicalTier("business_suite");
    assert.equal(enterprise.displayName, "WexPay Enterprise");
    assert.equal(enterprise.monthlyPriceMinor, 7_500_000);
    assert.equal(enterprise.entitlements.feature_api_access, false);
    assert.equal(enterprise.entitlements.feature_webhooks, false);
    assert.equal(enterprise.entitlements.feature_pos_bridge, false);
  });

  it("keeps seed, public pricing, and checkout fallback in parity without legacy commission copy", () => {
    for (const tier of WEXPAY_TIER_SEED_DEFAULTS) {
      assert.deepEqual(validateTierSeedDefault(tier), []);
      const canonical = getCanonicalTier(tier.tierKey);
      assert.equal(tier.name, canonical.displayName);
      assert.equal(tier.monthlyFee, majorFromMinor(canonical.monthlyPriceMinor));
      assert.equal(tier.setupFee, majorFromMinor(canonical.activationFeeMinor));
      assert.equal(tier.processingFeePct, 0);
      assert.equal(tier.minimumTransactionCommitment, 0);
    }

    assert.equal(WEXPAY_PRICING_FALLBACK[0].priceLabel, "₺7.500/ay");
    assert.equal(WEXPAY_PRICING_FALLBACK[3].name, "WexPay Enterprise");

    for (const plan of WEXPAY_PRICING_FALLBACK) {
      const blob = [
        plan.name,
        plan.audience,
        ...plan.features,
        plan.processingFeeLabel ?? "",
        plan.commitmentLabel ?? "",
        plan.commitmentNote ?? "",
        plan.processingDisclaimer ?? "",
      ].join(" ");
      assert.doesNotMatch(blob, /%2,89|%2,59|%2,35|%2,05/);
      assert.doesNotMatch(blob, /işlem komisyonu gelirinin aylık tabanı/i);
      assert.doesNotMatch(blob, /Plan ücreti \+ max/i);
      assert.match(blob, /Wexon işlem komisyonu: %0/);
      assert.match(blob, /Minimum işlem taahhüdü yok/);
      assert.equal(plan.processingFeeLabel, WEXPAY_ZERO_COMMISSION_LABEL);
      assert.equal(plan.commitmentLabel, WEXPAY_NO_COMMITMENT_LABEL);
      assert.equal(plan.processingDisclaimer, WEXPAY_PROCESSING_DISCLAIMER);
      assert.match(plan.processingDisclaimer ?? "", /PayTR merchant/i);
    }

    const checkout = catalogCheckoutFallbackTable();
    assert.equal(checkout.find((r) => r.tierKey === "essential")?.monthly, 7500);
    assert.equal(checkout.find((r) => r.tierKey === "essential")?.activation, 20000);
  });

  it("maps legacy keys and exposes tax-disabled policy", () => {
    assert.equal(resolveWexPayTierKey("enterprise"), "business_suite");
    const tax = getCanonicalTaxPolicy();
    assert.equal(tax.taxEnabled, false);
    assert.equal(tax.taxRateBps, 2000);
    assert.equal(tax.taxMode, "EXCLUSIVE");
  });

  it("seed entitlement defaults match unfinished-feature lock", () => {
    for (const tierKey of ["essential", "growth", "scale", "business_suite"] as const) {
      const ents = entitlementDefaultsForTier(tierKey);
      for (const key of WEXPAY_UNFINISHED_FEATURE_KEYS) {
        assert.equal(ents[key], false);
      }
      assert.equal(ents.feature_guest_order, true);
      assert.equal(ents.feature_qr_payment, true);
    }
  });
});
