import { type CoreEntitlementMap } from "@/lib/wexon-core-access";
import type { WexPayFeatureEntitlementKey } from "@/lib/wexpay-entitlement-map";
import { WexPayValidationError } from "@/lib/wexpay-validation";

export type WexPayFeatureAssertResult =
  | { ok: true }
  | { ok: false; key: string; message: string };

/**
 * Fail-closed package feature gate.
 * Enabled only for explicit true or positive numbers. Missing / false / 0 /
 * negative / non-boolean-non-numeric strings → deny.
 */
export function isWexPayFeatureEnabled(
  entitlementMap: CoreEntitlementMap,
  key: WexPayFeatureEntitlementKey | (string & {}),
) {
  if (!(key in entitlementMap)) return false;
  const value = entitlementMap[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return false;
}

export function assertWexPayFeatureEnabled(
  entitlementMap: CoreEntitlementMap,
  key: WexPayFeatureEntitlementKey | (string & {}),
): WexPayFeatureAssertResult {
  if (isWexPayFeatureEnabled(entitlementMap, key)) {
    return { ok: true };
  }

  return {
    ok: false,
    key,
    message: `Paketinizde "${key}" özelliği kapalı. Bu işlem için paketinizi yükseltmeniz gerekir.`,
  };
}

export function requireWexPayFeatureEnabled(
  entitlementMap: CoreEntitlementMap,
  key: WexPayFeatureEntitlementKey | (string & {}),
) {
  const result = assertWexPayFeatureEnabled(entitlementMap, key);
  if (!result.ok) {
    throw new WexPayValidationError(result.message);
  }
  return result;
}
