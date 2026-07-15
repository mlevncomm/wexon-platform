/** Types, seed defaults, validation & fallback snapshots — NOT a live price book. Runtime SoT = DB Plan. */

export const WEXPAY_TIER_KEYS = ["essential", "growth", "scale", "business_suite"] as const;
export type WexPayTierKey = (typeof WEXPAY_TIER_KEYS)[number];

export const WEXPAY_LEGACY_PLAN_KEY_MAP: Record<string, WexPayTierKey> = {
  basic: "essential",
  standard: "growth",
  pro: "scale",
  enterprise: "business_suite",
  wexpay_basic: "essential",
  wexpay_standard: "growth",
  wexpay_pro: "scale",
  wexpay_essential: "essential",
  wexpay_growth: "growth",
  wexpay_scale: "scale",
  wexpay_business_suite: "business_suite",
};

export const WEXPAY_PROCESSING_DISCLAIMER =
  "İşlem oranları; iş modeli, işlem hacmi, risk değerlendirmesi ve ödeme sağlayıcısı onayına bağlıdır.";

export const WEXPAY_COMMITMENT_LABEL = "Aylık minimum işlem taahhüdü";
export const WEXPAY_COMMITMENT_NOTE =
  "Bu tutar paket bedelinden ayrıdır; işlem komisyonu gelirinin aylık tabanıdır. Plan ücreti + max(gerçekleşen işlem ücretleri, bu taahhüt) şeklinde faturalanır.";

export type WexPayCtaKind = "eligibility_check" | "book_meeting";

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
  limits: WexPayTierLimits;
  entitlementDefaults: Record<string, boolean | number | string>;
};

export const WEXPAY_TIER_SEED_DEFAULTS: WexPayTierSeedDefault[] = [
  {
    tierKey: "essential",
    planKey: "wexpay_essential",
    name: "WexPay Essential",
    audience: "Tek lokasyon, basit operasyonlu küçük işletmeler",
    sortOrder: 1,
    monthlyFee: 7000,
    yearlyFee: 70000,
    setupFee: 12000,
    processingFeePct: 2.89,
    minimumTransactionCommitment: 10000,
    currency: "TRY",
    taxRatePct: 20,
    isPublic: true,
    isActive: true,
    requiresManualReview: false,
    settlementDisplay: "Standart settlement · uygunluk ve sağlayıcı onayına bağlı",
    ctaKind: "eligibility_check",
    highlighted: false,
    limits: {
      maxLocations: 1,
      maxUsers: 5,
      monthlyOrderLimit: 3000,
      apiAccess: false,
      qrBasic: true,
      qrAdvanced: false,
      reportingAdvanced: false,
      subscriptions: "limited",
      integrationLevel: "none",
      supportLevel: "9x5 ticket",
      slaDisplay: "Sonraki iş günü",
    },
    entitlementDefaults: {
      branch_limit: 1,
      table_limit: 30,
      product_limit: 80,
      staff_limit: 5,
      monthly_order_limit: 3000,
      api_request_limit: 0,
      reporting_level: "basic",
      integration_level: "none",
      support_level: "standard",
      role_level: "basic",
      feature_subscriptions: false,
      feature_qr_basic: true,
      feature_qr_advanced: false,
      feature_pos_bridge: false,
      feature_multi_location: false,
      feature_reporting_advanced: false,
      feature_api_access: false,
      feature_priority_support: false,
      feature_fast_settlement_eligible: false,
      feature_custom_settlement: false,
      feature_invoicing_exports: true,
    },
  },
  {
    tierKey: "growth",
    planKey: "wexpay_growth",
    name: "WexPay Growth",
    audience: "1–5 lokasyon, düzenli tahsilat yapan orta ölçekli işletmeler",
    sortOrder: 2,
    monthlyFee: 15000,
    yearlyFee: 150000,
    setupFee: 25000,
    processingFeePct: 2.59,
    minimumTransactionCommitment: 20000,
    currency: "TRY",
    taxRatePct: 20,
    isPublic: true,
    isActive: true,
    requiresManualReview: false,
    settlementDisplay: "Standart / hızlı settlement · teklif bazlı",
    ctaKind: "eligibility_check",
    highlighted: true,
    limits: {
      maxLocations: 5,
      maxUsers: 25,
      monthlyOrderLimit: 15000,
      apiAccess: true,
      qrBasic: true,
      qrAdvanced: true,
      reportingAdvanced: false,
      subscriptions: true,
      integrationLevel: "basic",
      supportLevel: "Priority 9x5",
      slaDisplay: "8 iş saati",
    },
    entitlementDefaults: {
      branch_limit: 5,
      table_limit: 120,
      product_limit: 400,
      staff_limit: 25,
      monthly_order_limit: 15000,
      api_request_limit: 50000,
      reporting_level: "standard",
      integration_level: "basic",
      support_level: "priority",
      role_level: "standard",
      feature_subscriptions: true,
      feature_qr_basic: true,
      feature_qr_advanced: true,
      feature_pos_bridge: false,
      feature_multi_location: true,
      feature_reporting_advanced: false,
      feature_api_access: true,
      feature_priority_support: true,
      feature_fast_settlement_eligible: false,
      feature_custom_settlement: false,
      feature_invoicing_exports: true,
    },
  },
  {
    tierKey: "scale",
    planKey: "wexpay_scale",
    name: "WexPay Scale",
    audience: "5+ lokasyon, zincirleşen veya yüksek hacimli işletmeler",
    sortOrder: 3,
    monthlyFee: 35000,
    yearlyFee: 350000,
    setupFee: 60000,
    processingFeePct: 2.35,
    minimumTransactionCommitment: 45000,
    currency: "TRY",
    taxRatePct: 20,
    isPublic: true,
    isActive: true,
    requiresManualReview: true,
    settlementDisplay: "Hızlı / teklif bazlı settlement · underwriting sonrası",
    ctaKind: "book_meeting",
    highlighted: false,
    limits: {
      maxLocations: 25,
      maxUsers: 100,
      monthlyOrderLimit: 60000,
      apiAccess: true,
      qrBasic: true,
      qrAdvanced: true,
      reportingAdvanced: true,
      subscriptions: true,
      integrationLevel: "advanced",
      supportLevel: "7x12",
      slaDisplay: "4 saat",
    },
    entitlementDefaults: {
      branch_limit: 25,
      table_limit: 500,
      product_limit: 2000,
      staff_limit: 100,
      monthly_order_limit: 60000,
      api_request_limit: 250000,
      reporting_level: "advanced",
      integration_level: "advanced",
      support_level: "priority",
      role_level: "advanced",
      feature_subscriptions: true,
      feature_qr_basic: true,
      feature_qr_advanced: true,
      feature_pos_bridge: true,
      feature_multi_location: true,
      feature_reporting_advanced: true,
      feature_api_access: true,
      feature_priority_support: true,
      feature_fast_settlement_eligible: true,
      feature_custom_settlement: false,
      feature_invoicing_exports: true,
    },
  },
  {
    tierKey: "business_suite",
    planKey: "wexpay_business_suite",
    name: "WexPay Business Suite",
    audience: "Franchise, grup şirketi veya yüksek hacimli zincir — invite-only",
    sortOrder: 4,
    monthlyFee: 99000,
    yearlyFee: null,
    setupFee: 150000,
    processingFeePct: 2.05,
    minimumTransactionCommitment: 90000,
    currency: "TRY",
    taxRatePct: 20,
    isPublic: true,
    isActive: true,
    requiresManualReview: true,
    settlementDisplay: "Özel settlement modeli · sözleşme ve reserve ile",
    ctaKind: "book_meeting",
    highlighted: false,
    limits: {
      maxLocations: null,
      maxUsers: null,
      monthlyOrderLimit: null,
      apiAccess: true,
      qrBasic: true,
      qrAdvanced: true,
      reportingAdvanced: true,
      subscriptions: true,
      integrationLevel: "custom",
      supportLevel: "P1 7x24",
      slaDisplay: "1 saat / özel sözleşme",
    },
    entitlementDefaults: {
      branch_limit: -1,
      table_limit: -1,
      product_limit: -1,
      staff_limit: -1,
      monthly_order_limit: -1,
      api_request_limit: -1,
      reporting_level: "custom",
      integration_level: "custom",
      support_level: "enterprise",
      role_level: "enterprise",
      feature_subscriptions: true,
      feature_qr_basic: true,
      feature_qr_advanced: true,
      feature_pos_bridge: true,
      feature_multi_location: true,
      feature_reporting_advanced: true,
      feature_api_access: true,
      feature_priority_support: true,
      feature_fast_settlement_eligible: true,
      feature_custom_settlement: true,
      feature_invoicing_exports: true,
    },
  },
];

export function isWexPayTierKey(value: string): value is WexPayTierKey {
  return (WEXPAY_TIER_KEYS as readonly string[]).includes(value);
}

export function resolveWexPayTierKey(raw: string | null | undefined): WexPayTierKey | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLowerCase().replace(/^wexpay_/, "");
  if (isWexPayTierKey(key)) return key;
  return WEXPAY_LEGACY_PLAN_KEY_MAP[raw.trim().toLowerCase()] ?? WEXPAY_LEGACY_PLAN_KEY_MAP[key] ?? null;
}

export function getTierSeedDefault(tierKey: WexPayTierKey): WexPayTierSeedDefault {
  const found = WEXPAY_TIER_SEED_DEFAULTS.find((item) => item.tierKey === tierKey);
  if (!found) throw new Error(`Unknown WexPay tier: ${tierKey}`);
  return found;
}

export function validateTierSeedDefault(tier: WexPayTierSeedDefault): string[] {
  const errors: string[] = [];
  if (!isWexPayTierKey(tier.tierKey)) errors.push("invalid tierKey");
  if (tier.monthlyFee < 7000 && tier.tierKey === "essential") errors.push("essential monthlyFee below floor");
  if (tier.monthlyFee <= 0) errors.push("monthlyFee must be positive");
  if (tier.setupFee < 0) errors.push("setupFee invalid");
  if (tier.processingFeePct <= 0 || tier.processingFeePct > 100) errors.push("processingFeePct out of range");
  if (tier.minimumTransactionCommitment < 0) errors.push("minimumTransactionCommitment invalid");
  return errors;
}

export function ctaLabelForKind(kind: WexPayCtaKind): string {
  return kind === "book_meeting" ? "Görüşme Planla" : "Uygunluğunu Kontrol Et";
}

export function ctaHrefForTier(tierKey: WexPayTierKey, kind: WexPayCtaKind): string {
  if (kind === "book_meeting") {
    return `/randevu-ai?product=wexpay&plan=${tierKey}`;
  }
  return `/demo-request?product=wexpay&plan=${tierKey}&intent=eligibility`;
}
