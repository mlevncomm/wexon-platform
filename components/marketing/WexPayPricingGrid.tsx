import { cn } from "@/lib/cn";
import PricingCard from "@/components/ui/PricingCard";
import WexPayPricingDisclaimer from "@/components/marketing/WexPayPricingDisclaimer";
import type { PricingPlan } from "@/types/wexon";

type DisclaimerPlacement = "above" | "below" | "both" | "none";

type WexPayPricingGridProps = {
  plans: PricingPlan[];
  tone?: "light" | "dark";
  disclaimerPlacement?: DisclaimerPlacement;
  className?: string;
  gridClassName?: string;
};

/** DB-first WexPay plan kartları — /packages, /products/wexpay ve ana sayfa önizlemesi için ortak grid. */
export default function WexPayPricingGrid({
  plans,
  tone = "light",
  disclaimerPlacement = "below",
  className,
  gridClassName,
}: WexPayPricingGridProps) {
  const showAbove = disclaimerPlacement === "above" || disclaimerPlacement === "both";
  const showBelow = disclaimerPlacement === "below" || disclaimerPlacement === "both";
  const disclaimerVariant = tone === "dark" ? "dark" : disclaimerPlacement === "above" ? "amber" : "muted";

  return (
    <div className={className}>
      {showAbove ? <WexPayPricingDisclaimer variant={disclaimerVariant} className="mb-6" /> : null}
      <div
        className={cn(
          "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch",
          gridClassName,
        )}
      >
        {plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            href={plan.ctaHref ?? `/demo-request?product=wexpay&plan=${plan.id}&intent=eligibility`}
            tone={tone}
            className="h-full"
          />
        ))}
      </div>
      {showBelow ? (
        <WexPayPricingDisclaimer
          variant={tone === "dark" ? "dark" : "muted"}
          className={cn(showAbove ? "mt-6" : "mt-6")}
        />
      ) : null}
    </div>
  );
}
