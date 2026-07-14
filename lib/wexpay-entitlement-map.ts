/**
 * Tier → entitlement key map only. Runtime checks must use
 * isEntitlementEnabled / assertEntitlementLimit from wexon-core-access.
 */

import { getTierSeedDefault, type WexPayTierKey } from "@/lib/wexpay-tier-config";

export const WEXPAY_FEATURE_ENTITLEMENT_KEYS = [
  "feature_subscriptions",
  "feature_qr_basic",
  "feature_qr_advanced",
  "feature_pos_bridge",
  "feature_multi_location",
  "feature_reporting_advanced",
  "feature_api_access",
  "feature_priority_support",
  "feature_fast_settlement_eligible",
  "feature_custom_settlement",
  "feature_invoicing_exports",
] as const;

export type WexPayFeatureEntitlementKey = (typeof WEXPAY_FEATURE_ENTITLEMENT_KEYS)[number];

export function entitlementDefaultsForTier(tierKey: WexPayTierKey): Record<string, boolean | number | string> {
  return { ...getTierSeedDefault(tierKey).entitlementDefaults };
}

export function featureEntitlementKey(feature: string): string {
  return feature.startsWith("feature_") ? feature : `feature_${feature}`;
}
