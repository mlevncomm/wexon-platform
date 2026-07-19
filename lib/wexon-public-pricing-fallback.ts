import type { PricingPlan } from "@/types/wexon";
import {
  ctaHrefForTier,
  ctaLabelForKind,
  WEXPAY_NO_COMMITMENT_LABEL,
  WEXPAY_PROCESSING_DISCLAIMER,
  WEXPAY_TIER_SEED_DEFAULTS,
  WEXPAY_ZERO_COMMISSION_LABEL,
  type WexPayTierKey,
} from "@/lib/wexpay-tier-config";

function formatTry(value: number) {
  return `₺${value.toLocaleString("tr-TR")}`;
}

function formatTryMonthly(value: number) {
  return `${formatTry(value)}/ay`;
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
    WEXPAY_ZERO_COMMISSION_LABEL,
    WEXPAY_NO_COMMITMENT_LABEL,
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
  processingFeeLabel: WEXPAY_ZERO_COMMISSION_LABEL,
  commitmentLabel: WEXPAY_NO_COMMITMENT_LABEL,
  commitmentNote: WEXPAY_NO_COMMITMENT_LABEL,
  processingDisclaimer: WEXPAY_PROCESSING_DISCLAIMER,
  settlementDisplay: tier.settlementDisplay,
}));

/** @deprecated Enterprise secondary card helper. */
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
    processingFeeLabel: WEXPAY_ZERO_COMMISSION_LABEL,
    commitmentLabel: WEXPAY_NO_COMMITMENT_LABEL,
    commitmentNote: WEXPAY_NO_COMMITMENT_LABEL,
    processingDisclaimer: WEXPAY_PROCESSING_DISCLAIMER,
    settlementDisplay: input.settlementDisplay ?? undefined,
  };
}
