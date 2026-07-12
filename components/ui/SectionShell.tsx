import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SectionTone = "canvas" | "subtle" | "white" | "dark";

const TONE: Record<SectionTone, string> = {
  canvas: "bg-[#f6f8f7] text-slate-950",
  subtle: "bg-slate-50 text-slate-950",
  white: "bg-white text-slate-950",
  dark: "wx-dark-panel text-white",
};

interface SectionShellProps {
  children: ReactNode;
  tone?: SectionTone;
  id?: string;
  /** Container max width. */
  width?: "default" | "narrow" | "wide";
  className?: string;
  innerClassName?: string;
}

const WIDTH: Record<NonNullable<SectionShellProps["width"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-[1180px]",
  wide: "max-w-[1480px]",
};

/**
 * Standard marketing section: consistent vertical rhythm, centered container,
 * scroll offset for anchored navigation, and a background tone.
 */
export default function SectionShell({
  children,
  tone = "canvas",
  id,
  width = "default",
  className,
  innerClassName,
}: SectionShellProps) {
  return (
    <section
      id={id}
      className={cn(
        "px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28",
        id && "scroll-mt-28",
        TONE[tone],
        className,
      )}
    >
      <div className={cn("mx-auto", WIDTH[width], innerClassName)}>{children}</div>
    </section>
  );
}
