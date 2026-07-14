/**
 * Read-only migration report helper. Does NOT apply plan changes or reactivate fixtures.
 */

import { prisma } from "@/lib/prisma";
import { resolveWexPayTierKey, type WexPayTierKey } from "@/lib/wexpay-tier-config";

export type WexPayMigrationSuggestion = {
  organizationId: string;
  organizationName: string;
  isDemo: boolean;
  isActive: boolean;
  currentPlanKey: string | null;
  currentPlanName: string | null;
  suggestedTier: WexPayTierKey;
  reason: string;
};

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
          entitlements: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return licenses.map((license) => {
    const branchLimit =
      license.plan.entitlements.find((e) => e.key === "branch_limit")?.valueInt ?? null;
    const hasCustomIntegration =
      license.plan.entitlements.some(
        (e) => e.key === "integration_level" && (e.valueString === "custom" || e.valueString === "advanced"),
      ) || license.plan.tierKey === "business_suite";

    const { tier, reason } = suggestTier({
      planKey: license.plan.tierKey ?? license.plan.key,
      branchLimit,
      hasCustomIntegration,
    });

    return {
      organizationId: license.organization.id,
      organizationName: license.organization.name,
      isDemo: license.organization.isDemo,
      isActive: license.organization.isActive,
      currentPlanKey: license.plan.key,
      currentPlanName: license.plan.name,
      suggestedTier: tier,
      reason,
    };
  });
}
