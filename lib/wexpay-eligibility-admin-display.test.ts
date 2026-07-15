import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applicantFacingEligibilityMessage,
  evaluateWexPayEligibility,
} from "./wexpay-eligibility";
import {
  buildWexPayEligibilityAdminView,
  ELIGIBILITY_UNSPECIFIED,
  formatRiskReasonLabel,
  parseWexPayEligibilityLeadFields,
  toApplicantEligibilityProjection,
} from "./wexpay-eligibility-admin-display";

describe("wexpay eligibility admin display", () => {
  it("maps metadata fields including preferredTier from plan alias", () => {
    const fields = parseWexPayEligibilityLeadFields({
      plan: "growth",
      recommendedTier: "scale",
      reviewStatus: "manual_review",
      riskReasons: ["custom_integration", "scale_requires_manual_review"],
      companyType: "llc",
      sector: "Restoran",
      monthlyGmvBand: "750k-3m",
      locationCount: 8,
      avgTicket: 420,
      needsQr: true,
      needsSubscriptions: false,
      needsIntegration: true,
    });

    assert.equal(fields.preferredTier, "growth");
    assert.equal(fields.recommendedTier, "scale");
    assert.equal(fields.reviewStatus, "manual_review");
    assert.deepEqual(fields.riskReasons, ["custom_integration", "scale_requires_manual_review"]);
    assert.equal(fields.locationCount, 8);
    assert.equal(fields.needsIntegration, true);
  });

  it("uses Belirtilmedi for null/empty admin fields", () => {
    const view = buildWexPayEligibilityAdminView({});
    assert.equal(view.preferredTierLabel, ELIGIBILITY_UNSPECIFIED);
    assert.equal(view.recommendedTierLabel, ELIGIBILITY_UNSPECIFIED);
    assert.equal(view.reviewStatusLabel, "Değerlendirilmedi");
    assert.equal(view.monthlyGmvLabel, ELIGIBILITY_UNSPECIFIED);
    assert.equal(view.locationCountLabel, ELIGIBILITY_UNSPECIFIED);
    assert.equal(view.sectorLabel, ELIGIBILITY_UNSPECIFIED);
    assert.equal(view.needsLabel, ELIGIBILITY_UNSPECIFIED);
    assert.deepEqual(view.riskReasonLabels, []);
    assert.equal(view.hasEligibilitySignal, false);
  });

  it("maps known risk reasons to Turkish labels and sanitizes unknown keys", () => {
    assert.match(formatRiskReasonLabel("high_risk_sector"), /Sektör/);
    assert.match(formatRiskReasonLabel("marketplace_or_payout_request"), /Marketplace/);
    assert.equal(
      formatRiskReasonLabel("totally_unknown_internal_code"),
      "İç değerlendirme notu mevcut (ayrıntı kısıtlı)",
    );
    assert.doesNotMatch(formatRiskReasonLabel("totally_unknown_internal_code"), /totally_unknown/);
  });

  it("builds admin view with status badge labels", () => {
    const view = buildWexPayEligibilityAdminView({
      recommendedTier: "essential",
      reviewStatus: "auto_approve",
      riskReasons: ["preferred_tier_uplift"],
      monthlyGmvBand: "150k-750k",
      locationCount: 1,
      sector: "Cafe",
      needsQr: true,
    });

    assert.equal(view.recommendedTierLabel, "WexPay Essential");
    assert.equal(view.reviewStatusLabel, "Ön uygunluk");
    assert.equal(view.reviewStatusTone, "success");
    assert.ok(view.riskReasonLabels.length === 1);
    assert.doesNotMatch(view.riskReasonLabels[0]!, /preferred_tier_uplift/);
    assert.match(view.disclaimer, /nihai ticari onay/);
    assert.equal(view.hasEligibilitySignal, true);
  });
});

describe("wexpay applicant response safety", () => {
  it("applicantFacingEligibilityMessage never includes riskReasons keys", () => {
    const result = evaluateWexPayEligibility({
      locationCount: 8,
      needsMarketplaceOrPayout: true,
      sector: "Kripto bahis",
      preferredTier: "business_suite",
      monthlyGmvBand: "15m+",
    });
    assert.ok(result.riskReasons.length > 0);
    const message = applicantFacingEligibilityMessage(result);
    for (const reason of result.riskReasons) {
      assert.doesNotMatch(message, new RegExp(reason, "i"));
    }
    assert.doesNotMatch(message, /riskReasons/i);
    assert.doesNotMatch(JSON.stringify({ applicantMessage: message }), /marketplace_or_payout|high_risk_sector/);
  });

  it("applicant projection omits riskReasons entirely", () => {
    const result = evaluateWexPayEligibility({
      needsIntegration: true,
      locationCount: 1,
    });
    const projection = toApplicantEligibilityProjection(result);
    assert.equal("riskReasons" in projection, false);
    assert.ok(!("riskReasons" in projection));
    assert.equal(projection.reviewStatus, result.reviewStatus);
    assert.equal(projection.recommendedTier, result.recommendedTier);
  });
});
