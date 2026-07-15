import { cn } from "@/lib/cn";
import { WEXPAY_PROCESSING_DISCLAIMER } from "@/lib/wexpay-tier-config";

type DisclaimerVariant = "amber" | "muted" | "dark";

const variantClasses: Record<DisclaimerVariant, string> = {
  amber: "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950",
  muted: "text-center text-xs font-semibold leading-relaxed text-slate-500",
  dark: "text-center text-xs font-semibold leading-relaxed text-slate-400",
};

/** Shared WexPay işlem oranı ticari uyarısı — tek kaynak: WEXPAY_PROCESSING_DISCLAIMER. */
export default function WexPayPricingDisclaimer({
  variant = "amber",
  className,
}: {
  variant?: DisclaimerVariant;
  className?: string;
}) {
  return (
    <p role="note" aria-label="İşlem oranları uyarısı" className={cn(variantClasses[variant], className)}>
      {WEXPAY_PROCESSING_DISCLAIMER}
    </p>
  );
}
