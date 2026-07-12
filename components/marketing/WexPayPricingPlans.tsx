"use client";

import { useState } from "react";
import PricingCard from "@/components/ui/PricingCard";
import { cn } from "@/lib/cn";
import { formatTry, type WexPayDisplayInterval, type WexPayDisplayPlan } from "@/lib/wexon-pricing";
import type { PricingPlan } from "@/types/wexon";

interface StaticPricingCard {
  plan: PricingPlan;
  href: string;
}

interface WexPayPricingPlansProps {
  plans: WexPayDisplayPlan[];
  tone?: "light" | "dark";
  checkoutHrefBase?: string;
  gridClassName?: string;
  extraCards?: StaticPricingCard[];
}

/** Monthly/yearly toggle over the catalog-driven WexPay packages. */
export default function WexPayPricingPlans({
  plans,
  tone = "light",
  checkoutHrefBase = "/checkout",
  gridClassName,
  extraCards = [],
}: WexPayPricingPlansProps) {
  const [interval, setInterval] = useState<WexPayDisplayInterval>("monthly");
  const isDark = tone === "dark";

  const toPricingPlan = (plan: WexPayDisplayPlan): PricingPlan => ({
    id: plan.id,
    name: plan.name,
    audience: plan.audience,
    priceLabel: formatTry(interval === "monthly" ? plan.monthly : plan.yearly),
    billingNote: interval === "monthly" ? "aylık · KDV hariç" : "yıllık · KDV hariç · 2 ay avantajlı",
    features: plan.features,
    cta: "Abonelik Başlat",
    highlighted: plan.highlighted,
  });

  return (
    <div>
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Faturalama dönemi"
          className={cn(
            "inline-flex rounded-full border p-1",
            isDark ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-white",
          )}
        >
          {(["monthly", "yearly"] as const).map((value) => {
            const active = interval === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setInterval(value)}
                className={cn(
                  "rounded-full px-5 py-2 text-xs font-black transition-colors",
                  active
                    ? "bg-emerald-500 text-white"
                    : isDark
                      ? "text-slate-300 hover:text-white"
                      : "text-slate-500 hover:text-slate-900",
                )}
              >
                {value === "monthly" ? "Aylık" : "Yıllık"}
              </button>
            );
          })}
        </div>
      </div>

      <p className={cn("mt-4 text-center text-xs font-semibold", isDark ? "text-slate-400" : "text-slate-500")}>
        {interval === "monthly"
          ? "Aylık faturalandırma · fiyatlara KDV dahil değildir"
          : "Yıllık faturalandırma · 12 ay yerine 10 ay öde · fiyatlara KDV dahil değildir"}
      </p>

      <div className={cn("mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3", gridClassName)}>
        {plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={toPricingPlan(plan)}
            href={`${checkoutHrefBase}?product=wexpay&plan=${plan.id}&interval=${interval}`}
            tone={tone}
            className={plan.id === "pro" && extraCards.length === 0 ? "sm:col-span-2 lg:col-span-1" : undefined}
          />
        ))}
        {extraCards.map(({ plan, href }) => (
          <PricingCard key={plan.id} plan={plan} href={href} tone={tone} />
        ))}
      </div>
    </div>
  );
}
