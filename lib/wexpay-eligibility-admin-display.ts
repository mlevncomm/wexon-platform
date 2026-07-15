/**
 * Admin-only display helpers for WexPay eligibility metadata on demo leads.
 * Safe for Server Components used behind admin guards. Does not export high-risk
 * sector internals from the evaluator.
 */

import { getTierSeedDefault, resolveWexPayTierKey, type WexPayTierKey } from "@/lib/wexpay-tier-config";
import type { WexPayReviewStatus } from "@/lib/wexpay-eligibility";

export const ELIGIBILITY_UNSPECIFIED = "Belirtilmedi";

const RISK_REASON_LABELS: Record<string, string> = {
  multi_location_requires_scale_or_above: "Çoklu lokasyon Scale veya üzeri gerektiriyor",
  preferred_tier_uplift: "Talep edilen paket öneriyi yükseltti",
  preferred_tier_below_recommendation_ignored: "Talep edilen paket önerinin altında kaldı (yoksayıldı)",
  multi_location_floor_scale: "Lokasyon sayısı Scale tabanına yükseltti",
  high_risk_sector: "Sektör manuel inceleme gerektiriyor",
  marketplace_or_payout_request: "Marketplace / fon dağıtımı talebi",
  custom_integration: "Özel entegrasyon ihtiyacı",
  scale_requires_manual_review: "Scale paketi manuel inceleme gerektirir",
  business_suite_requires_manual_review: "Business Suite manuel inceleme gerektirir",
  individual_vs_high_gmv_mismatch: "Bireysel işletme / yüksek hacim uyumsuzluğu",
  fallback_growth: "Öneri Growth’a düşürüldü (güvenli yedek)",
};

const REVIEW_STATUS_LABELS: Record<WexPayReviewStatus, string> = {
  auto_approve: "Ön uygunluk",
  manual_review: "Manuel inceleme",
  reject: "Uygun değil",
};

export type ReviewStatusBadgeTone = "success" | "warning" | "danger" | "neutral";

export type WexPayEligibilityLeadFields = {
  preferredTier: string | null;
  recommendedTier: string | null;
  reviewStatus: string | null;
  riskReasons: string[];
  companyType: string | null;
  sector: string | null;
  monthlyGmvBand: string | null;
  locationCount: number | null;
  avgTicket: number | null;
  needsSubscriptions: boolean | null;
  needsQr: boolean | null;
  needsIntegration: boolean | null;
  needsMarketplaceOrPayout: boolean | null;
};

export type WexPayEligibilityAdminView = {
  preferredTierLabel: string;
  recommendedTierLabel: string;
  reviewStatusLabel: string;
  reviewStatusTone: ReviewStatusBadgeTone;
  reviewStatusRaw: string | null;
  monthlyGmvLabel: string;
  locationCountLabel: string;
  sectorLabel: string;
  companyTypeLabel: string;
  avgTicketLabel: string;
  needsLabel: string;
  riskReasonLabels: string[];
  hasEligibilitySignal: boolean;
  disclaimer: string;
};

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = meta[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

function readNumber(meta: Record<string, unknown>, key: string): number | null {
  const raw = meta[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readBoolean(meta: Record<string, unknown>, key: string): boolean | null {
  const raw = meta[key];
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return null;
}

function readRiskReasons(meta: Record<string, unknown>): string[] {
  const raw = meta.riskReasons;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

/** Extract eligibility-related fields from demo lead metadataJson (admin-only). */
export function parseWexPayEligibilityLeadFields(metadataJson: unknown): WexPayEligibilityLeadFields {
  const meta = asObject(metadataJson);
  return {
    preferredTier: readString(meta, "preferredTier", "plan"),
    recommendedTier: readString(meta, "recommendedTier"),
    reviewStatus: readString(meta, "reviewStatus"),
    riskReasons: readRiskReasons(meta),
    companyType: readString(meta, "companyType"),
    sector: readString(meta, "sector"),
    monthlyGmvBand: readString(meta, "monthlyGmvBand"),
    locationCount: readNumber(meta, "locationCount"),
    avgTicket: readNumber(meta, "avgTicket"),
    needsSubscriptions: readBoolean(meta, "needsSubscriptions"),
    needsQr: readBoolean(meta, "needsQr"),
    needsIntegration: readBoolean(meta, "needsIntegration"),
    needsMarketplaceOrPayout: readBoolean(meta, "needsMarketplaceOrPayout"),
  };
}

export function formatEligibilityTierLabel(tier: string | null | undefined): string {
  if (!tier?.trim()) return ELIGIBILITY_UNSPECIFIED;
  const key = resolveWexPayTierKey(tier);
  if (key) return getTierSeedDefault(key).name;
  return tier.trim();
}

export function formatReviewStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return "Değerlendirilmedi";
  const normalized = status.trim() as WexPayReviewStatus;
  return REVIEW_STATUS_LABELS[normalized] ?? "Değerlendirilmedi";
}

export function reviewStatusBadgeTone(status: string | null | undefined): ReviewStatusBadgeTone {
  switch (status?.trim()) {
    case "auto_approve":
      return "success";
    case "manual_review":
      return "warning";
    case "reject":
      return "danger";
    default:
      return "neutral";
  }
}

/** Map internal risk reason keys to Turkish admin copy. Unknown keys stay generic — never raw dump. */
export function formatRiskReasonLabel(reason: string): string {
  const key = reason.trim();
  if (!key) return "İç değerlendirme notu mevcut";
  return RISK_REASON_LABELS[key] ?? "İç değerlendirme notu mevcut (ayrıntı kısıtlı)";
}

export function formatRiskReasonLabels(reasons: string[] | null | undefined): string[] {
  if (!reasons?.length) return [];
  return reasons.map(formatRiskReasonLabel);
}

function formatOptional(value: string | number | null | undefined): string {
  if (value == null) return ELIGIBILITY_UNSPECIFIED;
  if (typeof value === "string" && !value.trim()) return ELIGIBILITY_UNSPECIFIED;
  return String(value);
}

function formatNeeds(fields: WexPayEligibilityLeadFields): string {
  const parts: string[] = [];
  if (fields.needsQr === true) parts.push("QR");
  if (fields.needsSubscriptions === true) parts.push("Abonelik");
  if (fields.needsIntegration === true) parts.push("Entegrasyon");
  if (fields.needsMarketplaceOrPayout === true) parts.push("Marketplace / payout (manuel inceleme)");
  if (parts.length) return parts.join(" · ");

  const anyFalse =
    fields.needsQr === false ||
    fields.needsSubscriptions === false ||
    fields.needsIntegration === false ||
    fields.needsMarketplaceOrPayout === false;
  if (anyFalse) return "Belirtilen ek ihtiyaç yok";
  return ELIGIBILITY_UNSPECIFIED;
}

export const ELIGIBILITY_PRE_APPROVAL_DISCLAIMER =
  "Ön uygunluk; nihai ticari onay veya ödeme sağlayıcısı onayı anlamına gelmez.";

/** Build display model for admin lead detail / list badges. */
export function buildWexPayEligibilityAdminView(metadataJson: unknown): WexPayEligibilityAdminView {
  const fields = parseWexPayEligibilityLeadFields(metadataJson);
  const hasEligibilitySignal = Boolean(
    fields.recommendedTier ||
      fields.reviewStatus ||
      fields.riskReasons.length ||
      fields.monthlyGmvBand ||
      fields.sector ||
      fields.preferredTier ||
      fields.locationCount != null ||
      fields.needsQr != null ||
      fields.needsSubscriptions != null ||
      fields.needsIntegration != null,
  );

  return {
    preferredTierLabel: formatEligibilityTierLabel(fields.preferredTier),
    recommendedTierLabel: formatEligibilityTierLabel(fields.recommendedTier),
    reviewStatusLabel: formatReviewStatusLabel(fields.reviewStatus),
    reviewStatusTone: reviewStatusBadgeTone(fields.reviewStatus),
    reviewStatusRaw: fields.reviewStatus,
    monthlyGmvLabel: formatOptional(fields.monthlyGmvBand),
    locationCountLabel: formatOptional(fields.locationCount),
    sectorLabel: formatOptional(fields.sector),
    companyTypeLabel: formatOptional(fields.companyType),
    avgTicketLabel: formatOptional(fields.avgTicket),
    needsLabel: formatNeeds(fields),
    riskReasonLabels: formatRiskReasonLabels(fields.riskReasons),
    hasEligibilitySignal,
    disclaimer: ELIGIBILITY_PRE_APPROVAL_DISCLAIMER,
  };
}

/** Compact labels for list badges — hide clutter when no signal. */
export function eligibilityListBadges(metadataJson: unknown): {
  recommendedTierLabel: string | null;
  reviewStatusLabel: string | null;
  reviewStatusTone: ReviewStatusBadgeTone;
} {
  const fields = parseWexPayEligibilityLeadFields(metadataJson);
  return {
    recommendedTierLabel: fields.recommendedTier
      ? formatEligibilityTierLabel(fields.recommendedTier)
      : null,
    reviewStatusLabel: fields.reviewStatus ? formatReviewStatusLabel(fields.reviewStatus) : null,
    reviewStatusTone: reviewStatusBadgeTone(fields.reviewStatus),
  };
}

/** Applicant-safe projection: never include riskReasons. */
export function toApplicantEligibilityProjection(result: {
  recommendedTier: WexPayTierKey;
  reviewStatus: WexPayReviewStatus;
  riskReasons: string[];
}): { recommendedTier: WexPayTierKey; reviewStatus: WexPayReviewStatus } {
  return {
    recommendedTier: result.recommendedTier,
    reviewStatus: result.reviewStatus,
  };
}
