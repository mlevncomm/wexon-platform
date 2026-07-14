/**
 * Read-only migration report helper. Does NOT apply plan changes or reactivate fixtures.
 */

import { prisma } from "@/lib/prisma";
import { isEntitlementEnabled, type CoreEntitlementMap } from "@/lib/wexon-core-access";
import {
  entitlementDefaultsForTier,
  WEXPAY_FEATURE_ENTITLEMENT_KEYS,
  type WexPayFeatureEntitlementKey,
} from "@/lib/wexpay-entitlement-map";
import { resolveWexPayTierKey, type WexPayTierKey } from "@/lib/wexpay-tier-config";

export type WexPayMigrationStatus = "not_reviewed" | "approved" | "skipped" | "migrated";

export type WexPayMigrationSubscriptionInfo = {
  id: string;
  status: string;
  interval: string;
  currentPeriodEnd: Date | null;
  provider: string | null;
};

export type WexPayMigrationSuggestion = {
  organizationId: string;
  organizationName: string;
  isDemo: boolean;
  isActive: boolean;
  licenseId: string;
  licenseStatus: string;
  currentPlanKey: string | null;
  currentPlanName: string | null;
  currentTierKey: WexPayTierKey | null;
  suggestedTier: WexPayTierKey;
  reason: string;
  capabilities: CoreEntitlementMap;
  capabilitiesAtRisk: WexPayFeatureEntitlementKey[];
  grandfatheringRecommendation: string;
  migrationStatus: WexPayMigrationStatus;
  subscription: WexPayMigrationSubscriptionInfo | null;
};

type EntitlementRow = {
  key: string;
  valueBool: boolean | null;
  valueInt: number | null;
  valueString: string | null;
  isActive: boolean;
};

function readActiveCapabilities(entitlements: EntitlementRow[]): CoreEntitlementMap {
  return entitlements
    .filter((entry) => entry.isActive)
    .reduce<CoreEntitlementMap>((accumulator, entitlement) => {
      accumulator[entitlement.key] =
        entitlement.valueInt ?? entitlement.valueString ?? entitlement.valueBool ?? null;
      return accumulator;
    }, {});
}

function suggestTier(input: {
  planKey: string | null;
  branchLimit: number | null;
  hasCustomIntegration: boolean;
}): { tier: WexPayTierKey; reason: string } {
  const mapped = resolveWexPayTierKey(input.planKey);
  if (input.hasCustomIntegration) {
    return { tier: "business_suite", reason: "custom_integration_signal" };
  }
  if (input.branchLimit != null && input.branchLimit > 5) {
    return { tier: "scale", reason: "multi_location_entitlement" };
  }
  if (mapped) {
    return { tier: mapped, reason: "legacy_or_current_plan_map" };
  }
  return { tier: "growth", reason: "default_growth" };
}

function deriveMigrationStatus(currentTier: WexPayTierKey | null, suggestedTier: WexPayTierKey): WexPayMigrationStatus {
  if (currentTier && currentTier === suggestedTier) return "migrated";
  return "not_reviewed";
}

function capabilitiesAtRisk(
  current: CoreEntitlementMap,
  suggestedTier: WexPayTierKey,
): WexPayFeatureEntitlementKey[] {
  const suggestedDefaults = entitlementDefaultsForTier(suggestedTier);
  const atRisk: WexPayFeatureEntitlementKey[] = [];

  for (const key of WEXPAY_FEATURE_ENTITLEMENT_KEYS) {
    const currentEnabled = isEntitlementEnabled(current, key);
    if (!currentEnabled) continue;

    const suggestedValue = suggestedDefaults[key];
    const suggestedEnabled =
      typeof suggestedValue === "boolean"
        ? suggestedValue
        : typeof suggestedValue === "number"
          ? suggestedValue > 0
          : typeof suggestedValue === "string"
            ? suggestedValue.trim().length > 0 && suggestedValue !== "none" && suggestedValue !== "false"
            : false;

    if (!suggestedEnabled) {
      atRisk.push(key);
    }
  }

  return atRisk;
}

function grandfatheringRecommendation(
  migrationStatus: WexPayMigrationStatus,
  atRisk: WexPayFeatureEntitlementKey[],
  currentTier: WexPayTierKey | null,
  suggestedTier: WexPayTierKey,
): string {
  if (migrationStatus === "migrated") {
    return "Müşteri zaten önerilen kademede; otomatik geçiş gerekmez.";
  }
  if (atRisk.length === 0) {
    return `${currentTier ?? "bilinmeyen"} → ${suggestedTier}: yetenek kaybı beklenmiyor; standart geçiş uygulanabilir.`;
  }
  return `${atRisk.length} özellik risk altında (${atRisk.join(", ")}). Mevcut yetkileri koruyan grandfathering veya sözleşme uzatması değerlendirilsin.`;
}

/** Read-only listing for admin review. Never mutates licenses/subscriptions. */
export async function buildWexPayPlanMigrationReport(): Promise<WexPayMigrationSuggestion[]> {
  const licenses = await prisma.license.findMany({
    where: {
      product: { key: "wexpay" },
      status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
    },
    include: {
      organization: { select: { id: true, name: true, isDemo: true, isActive: true } },
      plan: {
        include: {
          entitlements: {
            where: { isActive: true },
          },
        },
      },
      subscription: {
        select: {
          id: true,
          status: true,
          interval: true,
          currentPeriodEnd: true,
          provider: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return licenses.map((license) => {
    const activeEntitlements = license.plan.entitlements;
    const capabilities = readActiveCapabilities(activeEntitlements);
    const branchLimit =
      activeEntitlements.find((entry) => entry.key === "branch_limit")?.valueInt ?? null;
    const hasCustomIntegration =
      activeEntitlements.some(
        (entry) =>
          entry.key === "integration_level" &&
          (entry.valueString === "custom" || entry.valueString === "advanced"),
      ) || license.plan.tierKey === "business_suite";

    const { tier, reason } = suggestTier({
      planKey: license.plan.tierKey ?? license.plan.key,
      branchLimit,
      hasCustomIntegration,
    });

    const currentTier =
      resolveWexPayTierKey(license.plan.tierKey) ?? resolveWexPayTierKey(license.plan.key);
    const migrationStatus = deriveMigrationStatus(currentTier, tier);
    const atRisk = capabilitiesAtRisk(capabilities, tier);

    return {
      organizationId: license.organization.id,
      organizationName: license.organization.name,
      isDemo: license.organization.isDemo,
      isActive: license.organization.isActive,
      licenseId: license.id,
      licenseStatus: license.status,
      currentPlanKey: license.plan.key,
      currentPlanName: license.plan.name,
      currentTierKey: currentTier,
      suggestedTier: tier,
      reason,
      capabilities,
      capabilitiesAtRisk: atRisk,
      grandfatheringRecommendation: grandfatheringRecommendation(
        migrationStatus,
        atRisk,
        currentTier,
        tier,
      ),
      migrationStatus,
      subscription: license.subscription
        ? {
            id: license.subscription.id,
            status: license.subscription.status,
            interval: license.subscription.interval,
            currentPeriodEnd: license.subscription.currentPeriodEnd,
            provider: license.subscription.provider,
          }
        : null,
    };
  });
}
