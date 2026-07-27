import type { ReactNode } from "react";
import {
  AdminStatusBadge,
  type AdminStatusTone,
} from "@/components/marketing/admin-ui/AdminStatusBadge";
import { AdminSectionEyebrow } from "@/components/marketing/admin-ui/AdminSectionEyebrow";

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
    <div className="min-w-0 rounded-[12px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</p>
      {helper && <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{helper}</p>}
    </div>
  );
}

export function AdminMetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number; highlight?: boolean }>;
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-[12px] border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-white px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
          <p
            className={`mt-1 text-2xl font-black tracking-tight ${
              item.highlight ? "text-emerald-700" : "text-slate-950"
            }`}
          >
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
      <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-[12px] border border-slate-200 bg-white">
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

export function AdminSectionTitle({
  badge,
  title,
  description,
}: {
  badge: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 min-w-0">
      <AdminSectionEyebrow className="mb-3.5">{badge}</AdminSectionEyebrow>
      <h2 className="break-words text-xl font-black tracking-[-0.02em] text-slate-950 sm:text-2xl lg:text-3xl">{title}</h2>
      {description ? <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p> : null}
    </div>
  );
}

/** Back-compat wrapper — prefer AdminStatusBadge with explicit tone. */
export function AdminStatusPill({
  children,
  active = false,
  tone,
}: {
  children: string;
  active?: boolean;
  tone?: AdminStatusTone;
}) {
  return <AdminStatusBadge tone={tone ?? (active ? "active" : "inactive")}>{children}</AdminStatusBadge>;
}

export function AdminInfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

export function AdminPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`min-w-0 rounded-[12px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminEmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

export function AdminTableToolbar({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  if (!title && !description && !children) return null;
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        {title ? <p className="text-sm font-black text-slate-950">{title}</p> : null}
        {description ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function AdminTableShell({
  children,
  className = "",
  toolbar,
  mobile,
}: {
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
  /** Card/list layout shown below `lg`; desktop table stays hidden on smaller screens. */
  mobile?: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-none border-y border-slate-200 bg-white sm:rounded-[12px] sm:border ${className}`}
    >
      {toolbar}
      {mobile ? <div className="lg:hidden">{mobile}</div> : null}
      <div className={`min-w-0 ${mobile ? "hidden lg:block" : ""}`}>
        <div className="min-w-0 overflow-hidden">
          <div className="min-w-0 [&_table]:w-full [&_table]:table-fixed [&_tbody_tr]:border-t [&_tbody_tr]:border-slate-100 [&_tbody_tr:hover]:bg-slate-50/80 [&_td]:px-3 [&_td]:py-3.5 [&_td]:align-middle [&_td]:text-sm sm:[&_td]:px-4 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-slate-400 sm:[&_th]:px-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mobile-friendly stack: shows primary columns as cards below `md`. */
export function AdminResponsiveRows({
  rows,
}: {
  rows: Array<{
    key: string;
    primary: ReactNode;
    secondary?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
  }>;
}) {
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => (
        <div key={row.key} className="space-y-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{row.primary}</div>
            {row.meta ? <div className="shrink-0">{row.meta}</div> : null}
          </div>
          {row.secondary ? <div className="min-w-0 text-sm text-slate-600">{row.secondary}</div> : null}
          {row.actions ? <div className="flex flex-wrap gap-2 pt-0.5">{row.actions}</div> : null}
        </div>
      ))}
    </div>
  );
}

export { AdminStatusBadge } from "@/components/marketing/admin-ui/AdminStatusBadge";
export type { AdminStatusTone } from "@/components/marketing/admin-ui/AdminStatusBadge";
export { adminStatusToneFromValue } from "@/components/marketing/admin-ui/AdminStatusBadge";
export { AdminSectionEyebrow } from "@/components/marketing/admin-ui/AdminSectionEyebrow";
