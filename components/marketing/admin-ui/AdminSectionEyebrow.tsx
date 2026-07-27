import type { ReactNode } from "react";

/**
 * Premium section eyebrow for admin titles.
 * Dark slate chip + emerald type — matches shell avatar / primary chrome.
 */
export function AdminSectionEyebrow({
  children,
  tone = "light",
  className = "",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  const isDark = tone === "dark";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.04em] shadow-sm ${
        isDark
          ? "border border-white/15 bg-white/10 text-emerald-300 shadow-black/20 backdrop-blur-sm"
          : "border border-slate-900/10 bg-slate-950 text-emerald-300 shadow-slate-900/10"
      } ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-400"}`}
        aria-hidden
      />
      {children}
    </span>
  );
}
