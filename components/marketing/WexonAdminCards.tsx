import type { ReactNode } from "react";
import { ADMIN_GRID_GAP } from "@/lib/wexon-admin-layout";

export function AdminSummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="flex min-h-[7.5rem] min-w-0 flex-col rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:rounded-[22px] sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-auto break-words pt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{helper}</p> : null}
    </div>
  );
}

export function AdminMetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number; highlight?: boolean }>;
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-white px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
          <p className={`mt-1 text-2xl font-black tracking-tight ${item.highlight ? "text-amber-700" : "text-slate-950"}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AdminMetricGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string | number; helper?: string }>;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm font-semibold text-slate-600">{item.label}</dt>
            <dd className="shrink-0 text-right">
              <span className="text-lg font-black tabular-nums text-slate-950">{item.value}</span>
              {item.helper ? <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">{item.helper}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Page / section header with optional right-side actions. */
export function AdminSectionTitle({
  badge,
  title,
  description,
  actions,
}: {
  badge: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="mb-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-700">
            {badge}
          </span>
          <h2 className="break-words text-2xl font-black tracking-[-0.02em] text-slate-950 sm:text-[1.75rem] lg:text-[1.875rem]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Alias used by plan naming — same as AdminSectionTitle. */
export const AdminPageHeader = AdminSectionTitle;

export function AdminStatusPill({ children, active = false }: { children: string; active?: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      {children}
    </span>
  );
}

export function AdminInfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

export function AdminPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`min-w-0 w-full rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:rounded-[24px] sm:p-6 xl:p-7 ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminEmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-5 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

export function AdminTableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-full min-w-0 overflow-hidden rounded-none border-y border-slate-200 bg-white sm:rounded-[20px] sm:border ${className}`}>
      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-w-full [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-slate-50/80 [&_td]:px-4 [&_td]:py-3.5 [&_th]:px-4 [&_th]:py-3.5 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-slate-50/95 [&_thead]:backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Desktop row / mobile stack filter toolbar. */
export function AdminFilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end ${className}`}
    >
      {children}
    </div>
  );
}

/** KPI grid helper matching wide-admin breakpoints. */
export function AdminStatGrid({ children }: { children: ReactNode }) {
  return <section className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 ${ADMIN_GRID_GAP}`}>{children}</section>;
}
