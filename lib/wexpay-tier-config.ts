/** Types, seed defaults, validation & fallback snapshots — NOT a live price book. Runtime SoT = DB Plan. */

import {
  canonicalTierAsSeedDefaults,
  getCanonicalTier,
  isWexPayTierKey,
  listCanonicalTiers,
  resolveWexPayTierKey,
  WEXPAY_LEGACY_PLAN_KEY_MAP,
  WEXPAY_TIER_KEYS,
  type WexPayTierKey,
} from "@/lib/wexpay-canonical-catalog";

export {
  isWexPayTierKey,
  resolveWexPayTierKey,
  WEXPAY_LEGACY_PLAN_KEY_MAP,
  WEXPAY_TIER_KEYS,
  type WexPayTierKey,
};

export const WEXPAY_PROCESSING_DISCLAIMER =
  "İşlem oranları; iş modeli, işlem hacmi, risk değerlendirması ve ödeme sağlayıcısı onayına bağlıdır.";

export const WEXPAY_COMMITMENT_LABEL = "Aylık minimum işlem taahhüdü";
export const WEXPAY_COMMITMENT_NOTE =
  "Bu tutar paket bedelinden ayrıdır; işlem komisyonu gelirinin aylık tabanıdır. Plan ücreti + max(gerçekleşen işlem ücretleri, bu taahhüt) şeklinde faturalanır.";

export type WexPayCtaKind = "eligibility_check" | "book_meeting" | "start_checkout";

/** null = contract / special / unlimited (never treat as 0). */
export type NullableLimit = number | null;

export type WexPayTierLimits = {
  maxLocations: NullableLimit;
  maxUsers: NullableLimit;
  monthlyOrderLimit: NullableLimit;
  apiAccess: boolean;
  qrBasic: boolean;
  qrAdvanced: boolean;
  reportingAdvanced: boolean;
  subscriptions: boolean | "limited";
  integrationLevel: "none" | "basic" | "advanced" | "custom";
  supportLevel: string;
  slaDisplay: string;
};

export type WexPayTierSeedDefault = {
  tierKey: WexPayTierKey;
  planKey: string;
  name: string;
  audience: string;
  sortOrder: number;
  monthlyFee: number;
  yearlyFee: number | null;
  setupFee: number;
  /** Starting "from" rate; underwriting may differ. */
  processingFeePct: number;
  minimumTransactionCommitment: number;
  currency: string;
  taxRatePct: number;
  isPublic: boolean;
  isActive: boolean;
  requiresManualReview: boolean;
  settlementDisplay: string;
  ctaKind: WexPayCtaKind;
  highlighted: boolean;
  activationLabel?: string;
  customPricing?: boolean;
  limits: WexPayTierLimits;
  entitlementDefaults: Record<string, boolean | number | string>;
};

/** Derived from data/wexpay-canonical-catalog.json — do not duplicate price literals here. */
export const WEXPAY_TIER_SEED_DEFAULTS: WexPayTierSeedDefault[] = canonicalTierAsSeedDefaults();

export function getTierSeedDefault(tierKey: WexPayTierKey): WexPayTierSeedDefault {
  const found = WEXPAY_TIER_SEED_DEFAULTS.find((item) => item.tierKey === tierKey);
  if (!found) throw new Error(`Unknown WexPay tier: ${tierKey}`);
  return found;
}

export function validateTierSeedDefault(tier: WexPayTierSeedDefault): string[] {
  const errors: string[] = [];
  if (!isWexPayTierKey(tier.tierKey)) errors.push("invalid tierKey");
  const canonical = getCanonicalTier(tier.tierKey);
  if (tier.monthlyFee !== canonical.monthlyPriceMinor / 100) {
    errors.push("monthlyFee diverges from canonical catalog");
  }
  if (tier.monthlyFee <= 0) errors.push("monthlyFee must be positive");
  if (tier.setupFee < 0) errors.push("setupFee invalid");
  if (tier.processingFeePct <= 0 || tier.processingFeePct > 100) errors.push("processingFeePct out of range");
  if (tier.minimumTransactionCommitment < 0) errors.push("minimumTransactionCommitment invalid");
  return errors;
}

export function ctaLabelForKind(kind: WexPayCtaKind): string {
  if (kind === "book_meeting") return "Görüşme Planla";
  if (kind === "start_checkout") return "Paketi satın al";
  return "Uygunluğunu Kontrol Et";
}

export function ctaHrefForTier(tierKey: WexPayTierKey, kind: WexPayCtaKind): string {
  if (kind === "book_meeting") {
    return `/randevu-ai?product=wexpay&plan=${tierKey}`;
  }
  if (kind === "start_checkout") {
    return `/checkout?product=wexpay&plan=${tierKey}&interval=monthly`;
  }
  return `/demo-request?product=wexpay&plan=${tierKey}&intent=eligibility`;
}

export function listTierFromCatalog() {
  return listCanonicalTiers();
}
