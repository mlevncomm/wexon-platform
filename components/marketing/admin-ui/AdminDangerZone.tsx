import type { ReactNode } from "react";

export type AdminDangerZoneTone = "warning" | "danger";

const TONE_CLASS: Record<AdminDangerZoneTone, string> = {
  warning: "border-slate-200 border-l-amber-500",
  danger: "border-slate-200 border-l-rose-600",
};

const SUMMARY_TONE: Record<AdminDangerZoneTone, string> = {
  warning: "text-slate-950",
  danger: "text-slate-950",
};

/**
 * Compact premium danger/advanced accordion.
 * Callers own forms, field names, confirmation, mutationId — this is markup only.
 *
 * Uncontrolled `<details>` only — do not pass a controlled `open` prop. A controlled
 * `open` value fights native toggle / Playwright interactions and keeps forms hidden.
 */
export function AdminDangerZone({
  title,
  description,
  children,
  tone = "warning",
  defaultOpen = false,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: AdminDangerZoneTone;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      // Uncontrolled: only seed the native `open` attribute when starting expanded.
      // Do not pass `open={false}` / `open={undefined}` every render — that fights toggles.
      {...(defaultOpen ? { open: true } : {})}
      className={`group min-w-0 rounded-[10px] border border-l-4 bg-white p-4 shadow-sm shadow-slate-200/40 ${TONE_CLASS[tone]} ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-700"
              aria-hidden
            >
              !
            </span>
            <span className={`block text-sm font-black tracking-tight ${SUMMARY_TONE[tone]}`}>{title}</span>
          </span>
          {description ? (
            <span className="mt-1.5 block pl-7 text-xs font-semibold leading-relaxed text-slate-600">{description}</span>
          ) : null}
        </span>
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-slate-100 text-xs font-black text-slate-600 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 pl-0 sm:pl-7">{children}</div>
    </details>
  );
}
