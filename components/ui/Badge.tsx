import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "accent"
  | "neutral"
  | "outline"
  | "dark"
  | "onDark";

const TONE: Record<BadgeTone, string> = {
  accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  outline: "border-slate-200 bg-white text-slate-700",
  dark: "border-slate-800 bg-slate-950 text-white",
  onDark: "border-white/15 bg-white/10 text-emerald-200",
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}

/** Compact marketing pill (e.g. "Pilot ürün", "Roadmap · Yakında"). */
export default function Badge({ children, tone = "accent", dot = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.01em]",
        TONE[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "onDark" || tone === "dark" ? "bg-emerald-400" : "bg-emerald-500",
          )}
        />
      )}
      {children}
    </span>
  );
}
