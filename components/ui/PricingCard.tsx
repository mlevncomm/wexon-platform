import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";
import { WexonIcon } from "@/components/marketing/home/icons";
import type { PricingPlan } from "@/types/wexon";

interface PricingCardProps {
  plan: PricingPlan;
  href: string;
  tone?: "light" | "dark";
  className?: string;
}

/** Pricing plan card with feature checklist and CTA; highlighted plan gets the emerald treatment. */
export default function PricingCard({ plan, href, tone = "light", className }: PricingCardProps) {
  const isDark = tone === "dark";
  const highlighted = plan.highlighted;

  return (
    <div
      className={cn(
        "wx-lift relative flex flex-col rounded-[26px] border p-6 sm:p-7",
        highlighted
          ? "border-emerald-400/50 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_30px_70px_-28px_rgba(16,185,129,0.7)]"
          : isDark
            ? "border-white/10 bg-white/[0.04] text-white"
            : "border-slate-200 bg-white text-slate-950 shadow-[0_20px_50px_-30px_rgba(2,44,34,0.22)]",
        className,
      )}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-emerald-300">
          En popüler
        </span>
      )}

      <p
        className={cn(
          "text-lg font-black",
          highlighted ? "text-white" : isDark ? "text-white" : "text-slate-950",
        )}
      >
        {plan.name}
      </p>
      <p
        className={cn(
          "mt-1 text-[0.8125rem] leading-relaxed",
          highlighted ? "text-emerald-50/90" : isDark ? "text-slate-300/85" : "text-slate-500",
        )}
      >
        {plan.audience}
      </p>

      <div className="mt-5">
        <p
          className={cn(
            "text-2xl font-black tracking-[-0.02em]",
            highlighted ? "text-white" : isDark ? "text-white" : "text-slate-950",
          )}
        >
          {plan.priceLabel}
        </p>
        <p
          className={cn(
            "mt-1 text-xs font-semibold",
            highlighted ? "text-emerald-50/80" : isDark ? "text-slate-400" : "text-slate-500",
          )}
        >
          {plan.billingNote}
        </p>
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                highlighted
                  ? "bg-white/20 text-white"
                  : isDark
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-emerald-50 text-emerald-600",
              )}
            >
              <WexonIcon name="check" size={12} strokeWidth={3} />
            </span>
            <span
              className={cn(
                "text-[0.8125rem] leading-relaxed",
                highlighted ? "text-emerald-50" : isDark ? "text-slate-200" : "text-slate-700",
              )}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <Button
          href={href}
          variant={highlighted ? "onDark" : isDark ? "onDark" : "primary"}
          fullWidth
          withArrow
        >
          {plan.cta}
        </Button>
      </div>
    </div>
  );
}
