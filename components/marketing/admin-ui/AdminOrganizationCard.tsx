import Link from "next/link";
import type { ReactNode } from "react";
import { AdminStatusBadge } from "@/components/marketing/admin-ui/AdminStatusBadge";

export function AdminOrganizationCard({
  name,
  secondary,
  isActive,
  meta,
  manageHref,
  actions,
}: {
  name: string;
  secondary?: string | null;
  isActive: boolean;
  meta: Array<{ label: string; value: string | number }>;
  manageHref: string;
  actions?: ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-[12px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-black tracking-tight text-slate-950">{name}</h2>
          {secondary ? <p className="mt-1 truncate text-sm font-semibold text-slate-500">{secondary}</p> : null}
        </div>
        <AdminStatusBadge tone={isActive ? "active" : "inactive"}>
          {isActive ? "Aktif" : "Pasif"}
        </AdminStatusBadge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
        {meta.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</dt>
            <dd className="mt-1 truncate text-sm font-bold text-slate-950">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={manageHref}
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
        >
          Yönet
        </Link>
        {actions}
      </div>
    </article>
  );
}

/** Compact confirm checkbox used inside danger actions (keeps field names caller-owned). */
export function AdminConfirmCheckbox({
  name = "confirmed",
  children,
  tone = "neutral",
}: {
  name?: string;
  children: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-[10px] border bg-white p-3 ${
        tone === "danger" ? "border-rose-200" : "border-slate-200"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        value="1"
        required
        className={`mt-0.5 h-4 w-4 rounded border-slate-300 ${tone === "danger" ? "accent-rose-700" : ""}`}
      />
      <span className={`text-sm font-semibold ${tone === "danger" ? "text-rose-950" : "text-slate-700"}`}>
        {children}
      </span>
    </label>
  );
}

export function AdminOrganizationCardActionsSlot({ children }: { children: ReactNode }) {
  return <div className="w-full">{children}</div>;
}
