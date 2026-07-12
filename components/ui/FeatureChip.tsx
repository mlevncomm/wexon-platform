import { cn } from "@/lib/cn";
import { WexonIcon } from "@/components/marketing/home/icons";
import { ACCENT_CLASSES } from "@/components/marketing/home/accent";
import type { ProductAccent, WexonIconName } from "@/types/wexon";

interface FeatureChipProps {
  icon: WexonIconName;
  title: string;
  description?: string;
  accent?: ProductAccent;
  tone?: "light" | "dark";
  /** Stack icon above text (card) vs inline (chip row). */
  layout?: "stack" | "inline";
  className?: string;
}

/**
 * Icon tile + title + optional description — the kit's atomic "feature" card,
 * inspired by the reference checklist cards.
 */
export default function FeatureChip({
  icon,
  title,
  description,
  accent = "emerald",
  tone = "light",
  layout = "inline",
  className,
}: FeatureChipProps) {
  const isDark = tone === "dark";
  const a = ACCENT_CLASSES[accent];

  return (
    <div
      className={cn(
        "wx-lift flex gap-3.5 rounded-2xl border p-4",
        layout === "stack" ? "flex-col" : "flex-row items-start",
        isDark
          ? "border-white/10 bg-white/[0.04] hover:border-emerald-400/30"
          : cn("border-slate-200 bg-white", a.hoverBorder),
        className,
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          isDark ? "bg-emerald-500/15 text-emerald-300" : a.solid,
        )}
      >
        <WexonIcon name={icon} size={21} />
      </span>
      <div className="min-w-0">
        <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
          {title}
        </p>
        {description && (
          <p
            className={cn(
              "mt-1 text-[0.8125rem] leading-relaxed",
              isDark ? "text-slate-300/85" : "text-slate-600",
            )}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
