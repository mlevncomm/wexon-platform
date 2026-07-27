import type { ReactNode } from "react";

export type AdminCalloutTone = "info" | "warning" | "error" | "neutral";

const TONE_CLASS: Record<AdminCalloutTone, string> = {
  info: "border-l-emerald-500 text-slate-700",
  warning: "border-l-amber-500 text-slate-700",
  error: "border-l-rose-600 text-slate-700",
  neutral: "border-l-slate-400 text-slate-700",
};

const ICON: Record<AdminCalloutTone, string> = {
  info: "ℹ",
  warning: "!",
  error: "!",
  neutral: "·",
};

export function AdminCallout({
  children,
  tone = "info",
  title,
  className = "",
}: {
  children: ReactNode;
  tone?: AdminCalloutTone;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-3 rounded-[10px] border border-slate-200 border-l-4 bg-white px-4 py-3 text-sm font-semibold leading-relaxed shadow-sm shadow-slate-200/40 ${TONE_CLASS[tone]} ${className}`}
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-700"
        aria-hidden
      >
        {ICON[tone]}
      </span>
      <div className="min-w-0">
        {title ? <p className="font-black text-slate-950">{title}</p> : null}
        <div className={title ? "mt-1" : undefined}>{children}</div>
      </div>
    </div>
  );
}
