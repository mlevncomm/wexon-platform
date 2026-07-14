/**
 * Server-side eligibility evaluation. Do not import this module into client components
 * (keeps high-risk sector list off the client bundle).
 */

import {
  getTierSeedDefault,
  isWexPayTierKey,
  resolveWexPayTierKey,
  type WexPayTierKey,
} from "@/lib/wexpay-tier-config";

export type WexPayReviewStatus = "auto_approve" | "manual_review" | "reject";

export type WexPayEligibilityInput = {
  companyType?: string | null;
  sector?: string | null;
  monthlyGmvBand?: string | null;
  locationCount?: number | null;
  avgTicket?: number | null;
  onlineOfflineSplit?: string | null;
  needsSubscriptions?: boolean;
  needsQr?: boolean;
  needsIntegration?: boolean;
  needsMarketplaceOrPayout?: boolean;
  preferredTier?: string | null;
};

export type WexPayEligibilityResult = {
  recommendedTier: WexPayTierKey;
  reviewStatus: WexPayReviewStatus;
  /** Internal only — never render to applicants. */
  riskReasons: string[];
};

/** Server-only. Do not expose to client. */
export const WEXPAY_HIGH_RISK_SECTORS = [
  "kumar",
  "gambling",
  "bahis",
  "betting",
  "crypto",
  "kripto",
  "yetiskin",
  "adult",
  "silah",
  "weapons",
  "tobacco",
  "tutun",
  "ilac",
  "pharmacy_rx",
] as const;

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function sectorIsHighRisk(sector: string | null | undefined): boolean {
  const s = normalize(sector);
  if (!s) return false;
  return WEXPAY_HIGH_RISK_SECTORS.some((item) => s.includes(item));
}

function gmvSuggestsScale(band: string | null | undefined): boolean {
  const b = normalize(band);
  return (
    b.includes("3m") ||
    b.includes("3+") ||
    b.includes("15m") ||
    b.includes("yuksek") ||
    b.includes("high") ||
    b === "3000000+" ||
    b === "15000000+"
  );
}

function gmvSuggestsBusinessSuite(band: string | null | undefined): boolean {
  const b = normalize(band);
  return b.includes("15m") || b.includes("15000000") || b.includes("enterprise_gmv");
}

/**
 * Eligibility is a recommendation only. Admin grants final commercial approval.
 */
export function evaluateWexPayEligibility(input: WexPayEligibilityInput): WexPayEligibilityResult {
  const reasons: string[] = [];
  const locations = input.locationCount == null ? 1 : Math.max(0, Number(input.locationCount) || 0);
  let recommended: WexPayTierKey = "essential";

  if (locations <= 1 && !gmvSuggestsScale(input.monthlyGmvBand)) {
    recommended = "essential";
  }
  if (locations >= 2 || normalize(input.monthlyGmvBand).includes("750")) {
    recommended = "growth";
  }
  if (locations > 5 || gmvSuggestsScale(input.monthlyGmvBand) || input.needsIntegration) {
    recommended = "scale";
  }
  if (gmvSuggestsBusinessSuite(input.monthlyGmvBand) || locations > 25) {
    recommended = "business_suite";
  }

  const preferred = resolveWexPayTierKey(input.preferredTier ?? undefined);
  if (preferred) {
    const order: WexPayTierKey[] = ["essential", "growth", "scale", "business_suite"];
    const prefIdx = order.indexOf(preferred);
    const recIdx = order.indexOf(recommended);
    // Never down-tier below multi-location minimum.
    if (locations > 5 && prefIdx < order.indexOf("scale")) {
      reasons.push("multi_location_requires_scale_or_above");
      recommended = "scale";
    } else if (prefIdx > recIdx) {
      recommended = preferred;
      reasons.push("preferred_tier_uplift");
    } else if (prefIdx < recIdx) {
      reasons.push("preferred_tier_below_recommendation_ignored");
    }
  }

  if (locations > 5 && (recommended === "essential" || recommended === "growth")) {
    recommended = "scale";
    reasons.push("multi_location_floor_scale");
  }

  let reviewStatus: WexPayReviewStatus = "auto_approve";

  if (sectorIsHighRisk(input.sector)) {
    reviewStatus = "manual_review";
    reasons.push("high_risk_sector");
  }

  if (input.needsMarketplaceOrPayout) {
    reviewStatus = "manual_review";
    reasons.push("marketplace_or_payout_request");
  }

  if (input.needsIntegration) {
    reviewStatus = "manual_review";
    reasons.push("custom_integration");
  }

  if (recommended === "business_suite" || recommended === "scale") {
    reviewStatus = "manual_review";
    reasons.push(`${recommended}_requires_manual_review`);
  }

  if (getTierSeedDefault(recommended).requiresManualReview) {
    reviewStatus = "manual_review";
  }

  // Soft reject only for clearly invalid shell requests.
  if (normalize(input.companyType) === "individual" && gmvSuggestsBusinessSuite(input.monthlyGmvBand)) {
    reviewStatus = "manual_review";
    reasons.push("individual_vs_high_gmv_mismatch");
  }

  if (!isWexPayTierKey(recommended)) {
    recommended = "growth";
    reviewStatus = "manual_review";
    reasons.push("fallback_growth");
  }

  return {
    recommendedTier: recommended,
    reviewStatus,
    riskReasons: reasons,
  };
}

/** Applicant-safe summary — never includes riskReasons. */
export function applicantFacingEligibilityMessage(result: WexPayEligibilityResult): string {
  if (result.reviewStatus === "reject") {
    return "Başvurunuz şu an ilerletilemiyor. Lütfen destek ile iletişime geçin.";
  }
  if (result.reviewStatus === "manual_review") {
    return "Önerilen paket kaydedildi. Ekibimiz uygunluğu inceledikten sonra size dönüş yapacak.";
  }
  return "Ön değerlendirme tamamlandı. Ekibimiz kısa sürede sizinle iletişime geçecek.";
}
