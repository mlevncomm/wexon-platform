/**
 * Tier → entitlement key map only. Runtime checks must use
 * isEntitlementEnabled / assertEntitlementLimit from wexon-core-access.
 */

import { getTierSeedDefault, type WexPayTierKey } from "@/lib/wexpay-tier-config";

export const WEXPAY_FEATURE_ENTITLEMENT_KEYS = [
  "feature_subscriptions",
  "feature_qr_basic",
  "feature_qr_advanced",
  "feature_guest_order",
  "feature_kitchen_display",
  "feature_cashier",
  "feature_qr_payment",
  "feature_guest_own_payment",
  "feature_item_payment",
  "feature_custom_split",
  "feature_modifiers",
  "feature_waiter_calls",
  "feature_advanced_roles",
  "feature_advanced_reports",
  "feature_csv_export",
  "feature_multi_location",
  "feature_custom_branding",
  "feature_api_access",
  "feature_webhooks",
  "feature_pos_integration",
  "feature_pos_bridge",
  "feature_reporting_advanced",
  "feature_priority_support",
  "feature_fast_settlement_eligible",
  "feature_custom_settlement",
  "feature_invoicing_exports",
] as const;

export type WexPayFeatureEntitlementKey = (typeof WEXPAY_FEATURE_ENTITLEMENT_KEYS)[number];

/** Features that must remain runtime-disabled until product-ready. */
export const WEXPAY_UNFINISHED_FEATURE_KEYS = [
  "feature_api_access",
  "feature_webhooks",
  "feature_pos_integration",
  "feature_pos_bridge",
  "feature_fast_settlement_eligible",
  "feature_custom_settlement",
] as const;

export function entitlementDefaultsForTier(tierKey: WexPayTierKey): Record<string, boolean | number | string> {
  return { ...getTierSeedDefault(tierKey).entitlementDefaults };
}

export function featureEntitlementKey(feature: string): string {
  return feature.startsWith("feature_") ? feature : `feature_${feature}`;
}
