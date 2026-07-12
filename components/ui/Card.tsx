import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SurfaceCardProps {
  children: ReactNode;
  /** Add hover lift + shadow. */
  interactive?: boolean;
  /** Padding preset. */
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  id?: string;
}

const PAD: Record<NonNullable<SurfaceCardProps["padding"]>, string> = {
  none: "",
  sm: "p-5",
  md: "p-6 sm:p-7",
  lg: "p-7 sm:p-9",
};

/** White rounded card with the kit's soft green-tinted shadow. */
export function SurfaceCard({
  children,
  interactive = false,
  padding = "md",
  className,
  id,
}: SurfaceCardProps) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_-28px_rgba(2,44,34,0.28)]",
        PAD[padding],
        interactive && "wx-lift hover:border-emerald-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

/** Dark glass card for floating stats / callouts on dark surfaces. */
export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-white shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
