import { WEXPAY_PLAN_CATALOG } from "@/lib/wexon-plan-catalog.mjs";

export type WexPayDisplayInterval = "monthly" | "yearly";

export interface WexPayDisplayPlan {
  id: string;
  name: string;
  audience: string;
  features: string[];
  monthly: number;
  yearly: number;
  currency: string;
  highlighted: boolean;
}

/** Catalog-derived, serializable plan data for marketing/pricing surfaces. */
export const wexPayDisplayPlans: WexPayDisplayPlan[] = WEXPAY_PLAN_CATALOG.map((plan) => ({
  id: plan.planKey,
  name: plan.name,
  audience: plan.audience,
  features: plan.features,
  monthly: plan.priceMonthly,
  yearly: plan.priceYearly,
  currency: plan.currency,
  highlighted: Boolean(plan.highlighted),
}));

/** Format a TRY amount using Turkish grouping and the lira symbol. */
export function formatTry(value: number): string {
  return `${value.toLocaleString("tr-TR")} ₺`;
}
