import Link from "next/link";
import type { ReactNode } from "react";
import { WORKSPACE_GRID_GAP } from "@/lib/wexon-workspace-layout";

export function DashboardSummaryCard({
  label,
  value,
  helper,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  helper?: string;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const valueClass =
    tone === "warning"
      ? "text-amber-800"
      : tone === "danger"
        ? "text-rose-800"
        : tone === "success"
          ? "text-emerald-800"
          : "text-slate-950";

  const body = (
    <>
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className={`mt-3 break-words text-2xl font-black tracking-tight sm:text-3xl ${valueClass}`}>{value}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </div>
      {helper ? (
        <div className="relative mt-3 rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold leading-relaxed text-slate-500">{helper}</p>
        </div>
      ) : null}
    </>
  );

  const className =
    "group relative flex min-h-[7.5rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 sm:p-5";

  if (href) {
    return (
      <Link href={href} className={`${className} transition hover:border-emerald-200 hover:shadow-md`}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export function DashboardHealthCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 transition-all hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-100/60">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />
      <div className="relative flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-base font-black text-slate-950">{value}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardStatusPill({
  children,
  active = false,
}: {
  children: string;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

export function DashboardSectionTitle({
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
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}

export const DashboardPageHeader = DashboardSectionTitle;

export function DashboardEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-5 text-center">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-xs font-semibold leading-relaxed text-slate-500">{description}</p>
      {action ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function DashboardAccountStatusNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm shadow-amber-100/60">
      <p className="text-sm font-black">Bu hesap pasif durumda.</p>
      <p className="mt-2 text-sm font-semibold leading-relaxed">
        Ürün erişimleri durdurulmuş olabilir. Lütfen Wexon destek ekibiyle iletişime geçin.
      </p>
    </div>
  );
}

export function DashboardInfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 transition-colors hover:border-emerald-200 hover:bg-white">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardStatusBar({ children }: { children: ReactNode }) {
  return (
    <section className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {children}
    </section>
  );
}

export function DashboardStatusItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

export function DashboardCompactPanel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
        {description && <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function DashboardMetricList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{children}</div>;
}

export function DashboardMetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-white px-4 py-3 transition-colors hover:bg-slate-50">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}

export function DashboardUsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-950">{label}</p>
        <p className="text-xs font-bold text-slate-500">{limit > 0 ? `${used} / ${limit}` : "Tanımlanmadı"}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function DashboardRoleCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}

export function DashboardUsageCard({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-slate-950">{label}</p>
        <p className="text-xs font-bold text-slate-600">
          {limit > 0 ? `${used} / ${limit}` : "Tanımlanmadı"}
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function DashboardPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`min-w-0 w-full rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:rounded-[24px] sm:p-6 xl:p-7 ${className}`}
    >
      {children}
    </section>
  );
}

export function DashboardKpiGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 ${WORKSPACE_GRID_GAP} ${className}`}>{children}</section>;
}

export function DashboardFilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:items-end ${className || "lg:grid-cols-[minmax(0,1fr)_auto_auto]"}`}>
      {children}
    </div>
  );
}

export function DashboardTableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-full min-w-0 overflow-hidden rounded-none border-y border-slate-200 bg-white sm:rounded-[20px] sm:border ${className}`}>
      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-w-full [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-slate-50/80 [&_td]:px-4 [&_td]:py-3.5 [&_th]:px-4 [&_th]:py-3.5 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-slate-50/95">
          {children}
        </div>
      </div>
    </div>
  );
}
