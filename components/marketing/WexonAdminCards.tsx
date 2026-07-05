import type { ReactNode } from "react";

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
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-4 break-words text-3xl font-black tracking-tight text-slate-950">{value}</p>
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
      <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
        {badge}
      </span>
      <h2 className="break-words text-2xl font-black tracking-[-0.02em] text-slate-950 sm:text-3xl">{title}</h2>
      {description && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
    </div>
  );
}

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
    <section className={`min-w-0 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:rounded-[32px] sm:p-8 ${className}`}>
      {children}
    </section>
  );
}

export function AdminEmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm shadow-slate-200/60">
      {children}
    </div>
  );
}

export function AdminTableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-none border-y border-slate-200 bg-white sm:rounded-[24px] sm:border ${className}`}>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-w-full">{children}</div>
      </div>
    </div>
  );
}
