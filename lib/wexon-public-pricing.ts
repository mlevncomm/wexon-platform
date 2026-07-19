import { prisma } from "@/lib/prisma";
import type { PricingPlan } from "@/types/wexon";
import {
  formatTierPriceParts,
  WEXPAY_PRICING_FALLBACK,
} from "@/lib/wexon-public-pricing-fallback";
import {
  getTierSeedDefault,
  resolveWexPayTierKey,
  type WexPayCtaKind,
  type WexPayTierKey,
} from "@/lib/wexpay-tier-config";

export { WEXPAY_PRICING_FALLBACK, ENTERPRISE_PRICING_PLAN } from "@/lib/wexon-public-pricing-fallback";

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function entitlementValue(
  entitlements: Array<{ key: string; valueInt: number | null; valueString: string | null; valueBool: boolean | null }>,
  key: string,
) {
  const item = entitlements.find((entry) => entry.key === key);
  return item?.valueInt ?? item?.valueString ?? (item?.valueBool == null ? null : item.valueBool ? "Evet" : "Hayır");
}

function buildFeatures(
  entitlements: Array<{ key: string; valueInt: number | null; valueString: string | null; valueBool: boolean | null }>,
  tierKey: WexPayTierKey,
): string[] {
  const seed = getTierSeedDefault(tierKey);
  const branch = entitlementValue(entitlements, "branch_limit");
  const staff = entitlementValue(entitlements, "staff_limit");
  const orders = entitlementValue(entitlements, "monthly_order_limit");
  const reporting = entitlementValue(entitlements, "reporting_level");
  const support = entitlementValue(entitlements, "support_level");
  const features: string[] = [];

  if (branch === -1 || branch === null) features.push(seed.limits.maxLocations == null ? "Lokasyon: sözleşmeye özel" : `${seed.limits.maxLocations} lokasyon`);
  else features.push(`${branch} lokasyon`);

  if (staff === -1 || staff === null) features.push(seed.limits.maxUsers == null ? "Kullanıcı: sözleşmeye özel" : `${seed.limits.maxUsers} kullanıcı`);
  else features.push(`${staff} kullanıcı`);

  if (orders === -1 || orders === null) features.push("Sipariş limiti: sözleşmeye özel");
  else features.push(`${orders} aylık sipariş limiti`);

  if (reporting) features.push(`Raporlama: ${reporting}`);
  if (support) features.push(`Destek: ${support}`);
  features.push(`SLA: ${seed.limits.slaDisplay}`);
  return features;
}

function ctaKindForTier(tierKey: WexPayTierKey, requiresManualReview: boolean): WexPayCtaKind {
  if (tierKey === "scale" || tierKey === "business_suite" || requiresManualReview) return "book_meeting";
  return "start_checkout";
}

/** Public marketing pricing cards — DB is source of truth; fallback only if query fails / empty. */
export async function getPublicWexPayPricingPlans(): Promise<PricingPlan[]> {
  try {
    const dbPlans = await prisma.plan.findMany({
      where: {
        isActive: true,
        isPublic: true,
        product: { key: "wexpay", isActive: true },
      },
      include: { entitlements: { where: { isActive: true } } },
      orderBy: { sortOrder: "asc" },
    });

    const mapped = dbPlans
      .map((plan) => {
        const tierKey =
          resolveWexPayTierKey(plan.tierKey) ??
          resolveWexPayTierKey(plan.key) ??
          null;
        if (!tierKey) return null;
        // Skip legacy public Basic/Standard/Pro if still active; prefer new tier keys.
        if (!plan.tierKey && ["basic", "standard", "pro"].includes(plan.key.replace(/^wexpay_/, ""))) {
          return null;
        }
        const seed = getTierSeedDefault(tierKey);
        const monthly = num(plan.priceMonthly) ?? seed.monthlyFee;
        const setup = num(plan.setupFee) ?? seed.setupFee;
        const processing = num(plan.processingFeePct) ?? seed.processingFeePct;
        const commitment = num(plan.minimumTransactionCommitment) ?? seed.minimumTransactionCommitment;
        return formatTierPriceParts({
          tierKey,
          monthly,
          setupFee: setup,
          processingFeePct: processing,
          commitment,
          settlementDisplay: plan.settlementDisplay ?? seed.settlementDisplay,
          ctaKind: ctaKindForTier(tierKey, plan.requiresManualReview || seed.requiresManualReview),
          highlighted: tierKey === "growth" || plan.sortOrder === 2,
          name: plan.name,
          audience: plan.description ?? seed.audience,
          features: buildFeatures(plan.entitlements, tierKey),
        });
      })
      .filter(Boolean) as PricingPlan[];

    if (mapped.length === 0) return WEXPAY_PRICING_FALLBACK;
    return mapped;
  } catch {
    return WEXPAY_PRICING_FALLBACK;
  }
}

export function startingPriceLabel(plans: PricingPlan[]) {
  const essential = plans.find((plan) => plan.id === "essential") ?? plans[0];
  return essential?.priceLabel ?? "₺7.500/ay";
}

/** Resolve deep-link plan ids including legacy Basic/Standard/Pro. */
export function normalizePublicPlanId(raw: string | null | undefined): WexPayTierKey | null {
  return resolveWexPayTierKey(raw);
}
