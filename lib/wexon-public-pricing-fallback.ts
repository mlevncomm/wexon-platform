import type { PricingPlan } from "@/types/wexon";
import {
  ctaHrefForTier,
  ctaLabelForKind,
  WEXPAY_COMMITMENT_LABEL,
  WEXPAY_COMMITMENT_NOTE,
  WEXPAY_PROCESSING_DISCLAIMER,
  WEXPAY_TIER_SEED_DEFAULTS,
  type WexPayTierKey,
} from "@/lib/wexpay-tier-config";

function formatTry(value: number) {
  return `₺${value.toLocaleString("tr-TR")}`;
}

function formatTryMonthly(value: number) {
  return `${formatTry(value)}/ay`;
}

function formatProcessingFrom(pct: number) {
  return `%${pct.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}'den başlayan işlem ücreti`;
}

/** Static fallback only when DB query fails or returns no public WexPay plans. */
export const WEXPAY_PRICING_FALLBACK: PricingPlan[] = WEXPAY_TIER_SEED_DEFAULTS.map((tier) => ({
  id: tier.tierKey,
  name: tier.name,
  audience: tier.audience,
  priceLabel: formatTryMonthly(tier.monthlyFee),
  billingNote: "Aylık · vergi yansıtılmaz · uygunluk ve sağlayıcı onayına bağlı",
  features: [
    tier.limits.maxLocations == null ? "Lokasyon: sözleşmeye özel" : `${tier.limits.maxLocations} lokasyon`,
    tier.limits.maxUsers == null ? "Kullanıcı: sözleşmeye özel" : `${tier.limits.maxUsers} kullanıcı`,
    tier.entitlementDefaults.feature_qr_advanced ? "Gelişmiş QR" : "Temel QR",
    `Destek: ${tier.limits.supportLevel}`,
    `SLA: ${tier.limits.slaDisplay}`,
  ],
  cta: ctaLabelForKind(tier.ctaKind),
  ctaHref: ctaHrefForTier(tier.tierKey, tier.ctaKind),
  highlighted: tier.highlighted,
  setupFeeLabel:
    tier.tierKey === "business_suite"
      ? `${formatTry(tier.setupFee)}'den başlayan ${tier.activationLabel ?? "Akıllı Aktivasyon Bedeli"}`
      : `${formatTry(tier.setupFee)} ${tier.activationLabel ?? "Akıllı Aktivasyon Bedeli"}`,
  processingFeeLabel: formatProcessingFrom(tier.processingFeePct),
  commitmentLabel: `${WEXPAY_COMMITMENT_LABEL}: ${formatTry(tier.minimumTransactionCommitment)}`,
  commitmentNote: WEXPAY_COMMITMENT_NOTE,
  processingDisclaimer: WEXPAY_PROCESSING_DISCLAIMER,
  settlementDisplay: tier.settlementDisplay,
}));

/** @deprecated Enterprise is now Business Suite tier — kept for home preview secondary card if needed. */
export const ENTERPRISE_PRICING_PLAN: PricingPlan =
  WEXPAY_PRICING_FALLBACK.find((p) => p.id === "business_suite") ?? WEXPAY_PRICING_FALLBACK[WEXPAY_PRICING_FALLBACK.length - 1];

export function formatTierPriceParts(input: {
  tierKey: WexPayTierKey;
  monthly: number;
  setupFee: number;
  processingFeePct: number;
  commitment: number;
  settlementDisplay?: string | null;
  ctaKind: "eligibility_check" | "book_meeting" | "start_checkout";
  highlighted?: boolean;
  name: string;
  audience: string;
  features: string[];
}): PricingPlan {
  return {
    id: input.tierKey,
    name: input.name,
    audience: input.audience,
    priceLabel: formatTryMonthly(input.monthly),
    billingNote: "Aylık · vergi yansıtılmaz · uygunluk ve sağlayıcı onayına bağlı",
    features: input.features,
    cta: ctaLabelForKind(input.ctaKind),
    ctaHref: ctaHrefForTier(input.tierKey, input.ctaKind),
    highlighted: input.highlighted,
    setupFeeLabel:
      input.tierKey === "business_suite"
        ? `${formatTry(input.setupFee)}'den başlayan Akıllı Aktivasyon Bedeli`
        : `${formatTry(input.setupFee)} Akıllı Aktivasyon Bedeli`,
    processingFeeLabel: formatProcessingFrom(input.processingFeePct),
    commitmentLabel: `${WEXPAY_COMMITMENT_LABEL}: ${formatTry(input.commitment)}`,
    commitmentNote: WEXPAY_COMMITMENT_NOTE,
    processingDisclaimer: WEXPAY_PROCESSING_DISCLAIMER,
    settlementDisplay: input.settlementDisplay ?? undefined,
  };
}
