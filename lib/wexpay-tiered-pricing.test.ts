import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMerchantRate, calculateMonthlyInvoice } from "./wexpay-commercials";
import { evaluateWexPayEligibility } from "./wexpay-eligibility";
import { resolveWexPayTierKey, validateTierSeedDefault, WEXPAY_TIER_SEED_DEFAULTS } from "./wexpay-tier-config";
import { entitlementDefaultsForTier } from "./wexpay-entitlement-map";

describe("wexpay commercials invoice math", () => {
  it("uses transaction-fee floor: planFee + max(actual, commitment)", () => {
    const lowActual = calculateMonthlyInvoice({
      planFee: 7000,
      actualTransactionFees: 4000,
      minimumTransactionCommitment: 10000,
    });
    assert.equal(lowActual.monthlyInvoice, 17000);
    assert.equal(lowActual.commitmentApplied, true);
    assert.equal(lowActual.transactionFeePortion, 10000);

    const highActual = calculateMonthlyInvoice({
      planFee: 15000,
      actualTransactionFees: 30000,
      minimumTransactionCommitment: 20000,
    });
    assert.equal(highActual.monthlyInvoice, 45000);
    assert.equal(highActual.commitmentApplied, false);
  });

  it("does not treat commitment as total-invoice floor", () => {
    // If commitment were total invoice floor wrongly: max(plan+txn, commitment)
    // Correct: plan + max(txn, commitment) = 7000 + 10000 = 17000 (not max(11000,10000)=11000)
    const result = calculateMonthlyInvoice({
      planFee: 7000,
      actualTransactionFees: 4000,
      minimumTransactionCommitment: 10000,
    });
    assert.notEqual(result.monthlyInvoice, 11000);
    assert.equal(result.monthlyInvoice, 17000);
  });

  it("calculates merchant rate as wholesale + markup", () => {
    assert.ok(Math.abs(calculateMerchantRate(2.2, 0.39) - 2.59) < 1e-9);
  });
});

describe("wexpay eligibility", () => {
  it("never auto-approves Business Suite", () => {
    const result = evaluateWexPayEligibility({
      monthlyGmvBand: "15m+",
      locationCount: 40,
      preferredTier: "business_suite",
    });
    assert.equal(result.recommendedTier, "business_suite");
    assert.equal(result.reviewStatus, "manual_review");
  });

  it("floors multi-location below Scale to Scale", () => {
    const result = evaluateWexPayEligibility({
      locationCount: 8,
      preferredTier: "essential",
      monthlyGmvBand: "150k-750k",
    });
    assert.equal(result.recommendedTier, "scale");
    assert.equal(result.reviewStatus, "manual_review");
  });

  it("forces manual review for marketplace/payout", () => {
    const result = evaluateWexPayEligibility({
      locationCount: 1,
      needsMarketplaceOrPayout: true,
    });
    assert.equal(result.reviewStatus, "manual_review");
    assert.ok(result.riskReasons.includes("marketplace_or_payout_request"));
  });

  it("forces manual review for high-risk sector", () => {
    const result = evaluateWexPayEligibility({
      sector: "Kripto bahis",
      locationCount: 1,
    });
    assert.equal(result.reviewStatus, "manual_review");
    assert.ok(result.riskReasons.includes("high_risk_sector"));
  });
});

describe("wexpay tier config", () => {
  it("seed defaults validate and start at 7000", () => {
    for (const tier of WEXPAY_TIER_SEED_DEFAULTS) {
      assert.deepEqual(validateTierSeedDefault(tier), []);
    }
    assert.equal(WEXPAY_TIER_SEED_DEFAULTS[0].monthlyFee, 7000);
  });

  it("maps legacy Basic/Standard/Pro deep links", () => {
    assert.equal(resolveWexPayTierKey("basic"), "essential");
    assert.equal(resolveWexPayTierKey("standard"), "growth");
    assert.equal(resolveWexPayTierKey("pro"), "scale");
    assert.equal(resolveWexPayTierKey("wexpay_business_suite"), "business_suite");
  });

  it("provides entitlement defaults per tier", () => {
    const growth = entitlementDefaultsForTier("growth");
    assert.equal(growth.feature_qr_advanced, true);
    assert.equal(growth.feature_multi_location, true);
  });
});
