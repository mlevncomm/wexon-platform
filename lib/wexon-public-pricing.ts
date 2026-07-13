import { prisma } from "@/lib/prisma";
import type { PricingPlan } from "@/types/wexon";
import { WEXPAY_PRICING_FALLBACK } from "@/lib/wexon-public-pricing-fallback";

export { WEXPAY_PRICING_FALLBACK, ENTERPRISE_PRICING_PLAN } from "@/lib/wexon-public-pricing-fallback";

function formatTryMonthly(value: unknown) {
  const n = value == null ? null : Number(value);
  if (n == null || !Number.isFinite(n)) return null;
  return `₺${n.toLocaleString("tr-TR")}/ay`;
}

/** Public marketing/checkout pricing cards — DB is source of truth, fallback only if query fails. */
export async function getPublicWexPayPricingPlans(): Promise<PricingPlan[]> {
  try {
    const dbPlans = await prisma.plan.findMany({
      where: {
        isActive: true,
        isPublic: true,
        product: { key: "wexpay", isActive: true },
      },
      include: { entitlements: true },
      orderBy: { sortOrder: "asc" },
    });
    if (dbPlans.length === 0) return WEXPAY_PRICING_FALLBACK;

    return dbPlans.map((plan, index) => {
      const shortId = plan.key.replace(/^wexpay_/, "");
      const entitlement = (key: string) => {
        const item = plan.entitlements.find((entry) => entry.key === key);
        return item?.valueInt ?? item?.valueString ?? null;
      };
      const features = [
        entitlement("branch_limit") != null ? `${entitlement("branch_limit")} şube` : null,
        entitlement("table_limit") != null ? `${entitlement("table_limit")} masa` : null,
        entitlement("product_limit") != null ? `${entitlement("product_limit")} ürün` : null,
        entitlement("reporting_level") != null ? `${entitlement("reporting_level")} rapor` : null,
        entitlement("support_level") != null ? `${entitlement("support_level")} destek` : null,
      ].filter(Boolean) as string[];

      return {
        id: shortId || plan.key,
        name: plan.name,
        audience: plan.description ?? WEXPAY_PRICING_FALLBACK[index]?.audience ?? "WexPay paketi",
        priceLabel:
          formatTryMonthly(plan.priceMonthly) ??
          WEXPAY_PRICING_FALLBACK[index]?.priceLabel ??
          "Fiyat yakında",
        billingNote: "Aylık · Yıllık · KDV hariç",
        features: features.length > 0 ? features : WEXPAY_PRICING_FALLBACK[index]?.features ?? [],
        cta: "Abonelik Başlat",
        highlighted: shortId === "standard" || index === 1,
      };
    });
  } catch {
    return WEXPAY_PRICING_FALLBACK;
  }
}

export function startingPriceLabel(plans: PricingPlan[]) {
  const basic = plans.find((plan) => plan.id === "basic") ?? plans[0];
  return basic?.priceLabel ?? "₺1.490/ay";
}
