/**
 * Canonical WexPay commercial catalog — single source of truth for prices/limits.
 * Seed (mjs) and TypeScript both read data/wexpay-canonical-catalog.json.
 * Runtime live SoT remains DB Plan rows (synced from this catalog via seed/admin).
 */
import catalogJson from "@/data/wexpay-canonical-catalog.json";
import { majorFromMinor, type TaxMode } from "@/lib/wexon-billing-money";

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

export type CanonicalTaxPolicyJson = {
  taxEnabled: boolean;
  taxRateBps: number;
  taxMode: TaxMode;
};

export type CanonicalTierJson = {
  tierKey: WexPayTierKey;
  planKey: string;
  displayName: string;
  audience: string;
  sortOrder: number;
  monthlyPriceMinor: number;
  yearlyPriceMinor: number | null;
  activationFeeMinor: number;
  customPricing: boolean;
  processingFeePct: number;
  minimumTransactionCommitmentMinor: number;
  isPublic: boolean;
  isActive: boolean;
  requiresManualReview: boolean;
  settlementDisplay: string;
  ctaKind: "eligibility_check" | "book_meeting" | "start_checkout";
  highlighted: boolean;
  activationLabel: string;
  limits: {
    maxLocations: number | null;
    maxUsers: number | null;
    monthlyOrderLimit: number | null;
    apiAccess: boolean;
    qrBasic: boolean;
    qrAdvanced: boolean;
    reportingAdvanced: boolean;
    subscriptions: boolean | "limited";
    integrationLevel: "none" | "basic" | "advanced" | "custom";
    supportLevel: string;
    slaDisplay: string;
  };
  entitlements: Record<string, boolean | number | string>;
};

export type CanonicalCatalogJson = {
  version: number;
  currency: string;
  minorUnitsPerMajor: number;
  taxPolicy: CanonicalTaxPolicyJson;
  tiers: CanonicalTierJson[];
};

export const WEXPAY_CANONICAL_CATALOG = catalogJson as CanonicalCatalogJson;

export function isWexPayTierKey(value: string): value is WexPayTierKey {
  return (WEXPAY_TIER_KEYS as readonly string[]).includes(value);
}

export function resolveWexPayTierKey(raw: string | null | undefined): WexPayTierKey | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLowerCase().replace(/^wexpay_/, "");
  if (isWexPayTierKey(key)) return key;
  return WEXPAY_LEGACY_PLAN_KEY_MAP[raw.trim().toLowerCase()] ?? WEXPAY_LEGACY_PLAN_KEY_MAP[key] ?? null;
}

export function getCanonicalTier(tierKey: WexPayTierKey): CanonicalTierJson {
  const found = WEXPAY_CANONICAL_CATALOG.tiers.find((t) => t.tierKey === tierKey);
  if (!found) throw new Error(`Unknown WexPay tier: ${tierKey}`);
  return found;
}

export function listCanonicalTiers(): CanonicalTierJson[] {
  return [...WEXPAY_CANONICAL_CATALOG.tiers].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getCanonicalTaxPolicy(): CanonicalTaxPolicyJson {
  return { ...WEXPAY_CANONICAL_CATALOG.taxPolicy };
}

/** Major-unit fees derived from catalog (for DB Plan Decimal columns / display). */
export function canonicalTierAsSeedDefaults() {
  return listCanonicalTiers().map((tier) => ({
    tierKey: tier.tierKey,
    planKey: tier.planKey,
    name: tier.displayName,
    audience: tier.audience,
    sortOrder: tier.sortOrder,
    monthlyFee: majorFromMinor(tier.monthlyPriceMinor),
    yearlyFee: tier.yearlyPriceMinor == null ? null : majorFromMinor(tier.yearlyPriceMinor),
    setupFee: majorFromMinor(tier.activationFeeMinor),
    processingFeePct: tier.processingFeePct,
    minimumTransactionCommitment: majorFromMinor(tier.minimumTransactionCommitmentMinor),
    currency: WEXPAY_CANONICAL_CATALOG.currency,
    taxRatePct: Math.round(WEXPAY_CANONICAL_CATALOG.taxPolicy.taxRateBps / 100),
    isPublic: tier.isPublic,
    isActive: tier.isActive,
    requiresManualReview: tier.requiresManualReview,
    settlementDisplay: tier.settlementDisplay,
    ctaKind: tier.ctaKind,
    highlighted: tier.highlighted,
    activationLabel: tier.activationLabel,
    customPricing: tier.customPricing,
    limits: { ...tier.limits },
    entitlementDefaults: { ...tier.entitlements },
  }));
}

export function assertCanonicalCatalogIntegrity(): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const tier of WEXPAY_CANONICAL_CATALOG.tiers) {
    if (!isWexPayTierKey(tier.tierKey)) errors.push(`invalid tierKey ${tier.tierKey}`);
    if (keys.has(tier.tierKey)) errors.push(`duplicate tierKey ${tier.tierKey}`);
    keys.add(tier.tierKey);
    if (!Number.isInteger(tier.monthlyPriceMinor) || tier.monthlyPriceMinor <= 0) {
      errors.push(`${tier.tierKey}: monthlyPriceMinor invalid`);
    }
    if (tier.yearlyPriceMinor != null && (!Number.isInteger(tier.yearlyPriceMinor) || tier.yearlyPriceMinor <= 0)) {
      errors.push(`${tier.tierKey}: yearlyPriceMinor invalid`);
    }
    if (!Number.isInteger(tier.activationFeeMinor) || tier.activationFeeMinor < 0) {
      errors.push(`${tier.tierKey}: activationFeeMinor invalid`);
    }
    for (const [k, v] of Object.entries(tier.entitlements)) {
      if (typeof v === "number" && v < -1) errors.push(`${tier.tierKey}.${k}: entitlement < -1`);
    }
  }
  for (const expected of WEXPAY_TIER_KEYS) {
    if (!keys.has(expected)) errors.push(`missing tier ${expected}`);
  }
  return errors;
}
