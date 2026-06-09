import type { ReactNode } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Layout panels
// ---------------------------------------------------------------------------

/** General-purpose white content panel — matches DashboardPanel. */
export function WexPayPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 ${className}`}>
      {children}
    </section>
  );
}

/** Titled content panel with optional description — matches DashboardCompactPanel. */
export function WexPayCompactPanel({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 ${className}`}>
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
        {description && (
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Metric / status components
// ---------------------------------------------------------------------------

/** Large metric tile with green top-accent line — matches DashboardSummaryCard. */
export function WexPayMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 transition-all hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-100/60 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-3 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {value}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </div>
      {helper && (
        <div className="relative mt-3 rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold leading-relaxed text-slate-500">{helper}</p>
        </div>
      )}
    </div>
  );
}

/** Compact horizontal status strip — matches DashboardStatusBar. */
export function WexPayStatusBar({ children }: { children: ReactNode }) {
  return (
    <section className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {children}
    </section>
  );
}

/** Single item inside WexPayStatusBar — matches DashboardStatusItem. */
export function WexPayStatusItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

/** Bordered list container for metric rows — matches DashboardMetricList. */
export function WexPayMetricList({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
      {children}
    </div>
  );
}

/** Single label/value row inside WexPayMetricList — matches DashboardMetricRow. */
export function WexPayMetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-white px-4 py-3 transition-colors hover:bg-slate-50">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}

/** Usage row with progress bar — matches DashboardUsageRow. */
export function WexPayUsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const unlimited = !Number.isFinite(limit) || limit <= 0;
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const atLimit = !unlimited && used >= limit;

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-950">{label}</p>
        <p className="text-xs font-bold text-slate-500">
          {unlimited ? "Sınırsız" : `${used} / ${limit}`}
        </p>
      </div>
      {!unlimited && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${atLimit ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Info row with green dot icon — matches DashboardInfoRow. */
export function WexPayInfoRow({ label, value }: { label: string; value: string | number }) {
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

// ---------------------------------------------------------------------------
// Page-level components
// ---------------------------------------------------------------------------

/** Section title with badge pill — matches DashboardSectionTitle. */
export function WexPaySectionTitle({
  title,
  description,
  badge = "WexPay",
}: {
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <div className="mb-6 min-w-0">
      <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
        {badge}
      </span>
      <h1 className="break-words text-2xl font-black tracking-[-0.02em] text-slate-950">{title}</h1>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>
      )}
    </div>
  );
}

/** Centered empty state — matches DashboardEmptyState. */
export function WexPayEmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm shadow-slate-200/60">
      <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <p className="text-base font-black text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

/** Access-denied full-page placeholder. */
export function WexPayEmptyAccess({ organizationId }: { organizationId?: string | null }) {
  const dashboardHref = organizationId ? `/dashboard?organizationId=${encodeURIComponent(organizationId)}` : "/dashboard";
  const supportHref = organizationId
    ? `/dashboard/support?organizationId=${encodeURIComponent(organizationId)}`
    : "/dashboard/support";
  const adminHref = organizationId ? `/admin/organizations/${organizationId}` : "/admin";

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center">
      <span className="mb-4 inline-flex rounded-full border border-amber-200 bg-white px-4 py-1.5 text-xs font-semibold text-amber-700">
        Erişim gerekli
      </span>
      <h1 className="mt-2 text-lg font-black text-slate-950">WexPay erişiminiz aktif değil.</h1>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
        Bu uygulamaya erişmek için WexPay lisansınızın ve kurulumunuzun aktif olması gerekir.
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link
          href={dashboardHref}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700"
        >
          Wexon Core paneline dön
        </Link>
        <Link
          href={supportHref}
          className="rounded-2xl border border-amber-300 bg-white px-5 py-3 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-50"
        >
          Destek talebi oluştur
        </Link>
      </div>
      {organizationId ? (
        <Link href={adminHref} className="mt-4 inline-flex text-xs font-bold text-slate-500 hover:text-emerald-700">
          Admin müşteri detayına git →
        </Link>
      ) : null}
    </div>
  );
}
