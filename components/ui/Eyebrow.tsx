import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ACCENT_CLASSES } from "@/components/marketing/home/accent";
import type { ProductAccent } from "@/types/wexon";

interface EyebrowProps {
  children: ReactNode;
  tone?: "light" | "dark";
  accent?: ProductAccent;
  className?: string;
}

/** Small uppercase pill label with a leading accent dot. */
export default function Eyebrow({
  children,
  tone = "light",
  accent = "emerald",
  className,
}: EyebrowProps) {
  const isDark = tone === "dark";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em]",
        isDark
          ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
          : "border-slate-200 bg-white text-slate-600",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ACCENT_CLASSES[accent].dot)} />
      {children}
    </span>
  );
}
