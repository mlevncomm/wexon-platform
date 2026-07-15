import Link from "next/link";
import type { ReactNode } from "react";

export function WexPayDarkPanelHeaderBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_58%)]" aria-hidden />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />
    </>
  );
}

export const wexpayPanelShellClassName =
  "min-w-0 overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-950/[0.03]";

export function formatLira(value: number) {
  return `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)} ₺`;
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-[16px] border border-slate-200/80 bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <span className="min-w-0 truncate text-sm font-medium text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-bold text-slate-950">{value}</span>
    </div>
  );
}

export function WexPayMetricCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-2xl border bg-white p-3.5 shadow-sm transition-colors sm:p-4 ${
        accent ? "border-emerald-200/80 shadow-emerald-900/5" : "border-slate-200/70 shadow-slate-900/5"
      }`}
    >
      <span
        className={`absolute right-3 top-3 h-2 w-2 rounded-full ${
          accent ? "bg-emerald-500 shadow-sm shadow-emerald-500/40" : "bg-slate-200"
        }`}
        aria-hidden
      />
      <p className="pr-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p
        className={`mt-1.5 break-words text-lg font-black tracking-tight sm:text-xl ${
          accent ? "text-emerald-600" : "text-slate-950"
        }`}
      >
        {value}
      </p>
      {detail ? <p className="mt-1.5 text-[11px] font-medium leading-snug text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function WexPayMetricStrip({
  eyebrow,
  title,
  description,
  children,
  className = "",
  gridClassName = "grid gap-3 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 sm:p-5",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  gridClassName?: string;
}) {
  const hasHeader = Boolean(eyebrow || title || description);

  return (
    <section className={`${wexpayPanelShellClassName} ${className}`}>
      {hasHeader ? (
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-5 sm:px-6 sm:py-6">
          <WexPayDarkPanelHeaderBackdrop />
          <div className="relative min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">{eyebrow}</p>
            ) : null}
            {title ? <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2> : null}
            {description ? (
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-400">{description}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={gridClassName}>{children}</div>
    </section>
  );
}

export function SummaryCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return <WexPayMetricCard label={label} value={value} detail={detail} accent={accent} />;
}

export function WexPayPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 flex-col gap-4 sm:gap-5 ${className}`}>{children}</div>;
}

export function WexPayPanelGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid min-w-0 gap-4 sm:gap-5 ${className}`}>{children}</div>;
}

export function WexPaySurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/5 ${className}`}
    >
      {children}
    </div>
  );
}

export function WexPayPanel({
  eyebrow,
  title,
  description,
  headerAction,
  toolbar,
  children,
  className = "",
  bodyClassName = "",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  toolbar?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const hasHeader = Boolean(eyebrow || title || description || headerAction);

  return (
    <section className={`${wexpayPanelShellClassName} ${className}`}>
      {hasHeader ? (
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-5 sm:px-6 sm:py-6">
          <WexPayDarkPanelHeaderBackdrop />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">{eyebrow}</p>
              ) : null}
              {title ? <h2 className="mt-1 break-words text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2> : null}
              {description ? (
                <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-400">{description}</p>
              ) : null}
            </div>
            {headerAction ? <div className="flex shrink-0 flex-wrap gap-2">{headerAction}</div> : null}
          </div>
        </div>
      ) : null}
      {toolbar ? <div className="border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5">{toolbar}</div> : null}
      {children ? (
        <div className={`${hasHeader || toolbar ? "p-4 sm:p-5" : "p-5 sm:p-6"} ${bodyClassName}`}>{children}</div>
      ) : null}
    </section>
  );
}

export function WexPayEmptyNotice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <p className="text-sm font-semibold leading-relaxed text-slate-400">{children}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function WexPayErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-sm shadow-rose-900/5">
      {message}
    </div>
  );
}

export function WexPayFilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-wrap items-end gap-2 sm:gap-3 ${className}`}>{children}</div>
  );
}

export function WexPayTableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-full min-w-0 overflow-hidden rounded-none border-y border-slate-200 bg-white sm:rounded-[16px] sm:border ${className}`}>
      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div className="min-w-full [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-slate-50/80 [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-3 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-slate-50/95">
          {children}
        </div>
      </div>
    </div>
  );
}

export function WexPayKpiGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 ${className}`}>
      {children}
    </div>
  );
}

export function WexPayEmptyAccess({
  organizationId,
  reason,
}: {
  organizationId?: string | null;
  reason?: string | null;
}) {
  const dashboardHref = organizationId ? `/dashboard?organizationId=${encodeURIComponent(organizationId)}` : "/dashboard";
  const supportHref = organizationId
    ? `/dashboard/support?organizationId=${encodeURIComponent(organizationId)}`
    : "/dashboard/support";
  const adminHref = organizationId ? `/admin/organizations/${organizationId}` : "/admin";

  const isDemoTenant = reason === "demo_tenant";

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center">
      <span className="mb-4 inline-flex rounded-full border border-amber-200 bg-white px-4 py-1.5 text-xs font-semibold text-amber-700">
        Erişim gerekli
      </span>
      <h1 className="mt-2 text-lg font-black text-slate-950">
        {isDemoTenant ? "Demo tenant ile gerçek WexPay açılamaz" : "WexPay erişiminiz aktif değil."}
      </h1>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
        {isDemoTenant
          ? "Gerçek WexPay uygulaması yalnızca isDemo=false müşteri organizasyonları için kullanılabilir. Lütfen gerçek test tenant veya canlı müşteri organizasyonunuzu seçin."
          : "Bu uygulamaya erişmek için WexPay lisansınızın ve kurulumunuzun aktif olması gerekir."}
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

const tableStatusStyles: Record<string, string> = {
  EMPTY: "border-slate-200 bg-slate-100 text-slate-600",
  OCCUPIED: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-900/5",
  PAYMENT_PENDING: "border-sky-200 bg-sky-50 text-sky-800 shadow-sky-900/5",
  PARTIALLY_PAID: "border-violet-200 bg-violet-50 text-violet-800 shadow-violet-900/5",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-900/5",
  RECEIPT_REQUESTED: "border-rose-200 bg-rose-50 text-rose-800 shadow-rose-900/5",
  CLOSED: "border-slate-200 bg-slate-100 text-slate-600",
};

const tableStatusLabels: Record<string, string> = {
  EMPTY: "Boş",
  OCCUPIED: "Dolu",
  PAYMENT_PENDING: "Ödeme Bekliyor",
  PARTIALLY_PAID: "Kısmi Ödendi",
  PAID: "Ödendi",
  RECEIPT_REQUESTED: "Fiş Talep Edildi",
  CLOSED: "Kapalı",
};

export function TableStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] shadow-sm ${
        tableStatusStyles[status] ?? "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {tableStatusLabels[status] ?? status}
    </span>
  );
}

export const orderStatusLabels: Record<string, string> = {
  NEW: "Yeni",
  PREPARING: "Hazırlanıyor",
  SERVED: "Servis Edildi",
  CANCELLED: "İptal Edildi",
};

const orderStatusStyles: Record<string, string> = {
  NEW: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PREPARING: "border-amber-200 bg-amber-50 text-amber-800",
  SERVED: "border-sky-200 bg-sky-50 text-sky-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${
        orderStatusStyles[status] ?? "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {orderStatusLabels[status] ?? status}
    </span>
  );
}

const paymentStatusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  PAID: "Ödendi",
  PARTIAL: "Kısmi",
  FAILED: "Başarısız",
  REFUNDED: "İade",
};

const paymentStatusStyles: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PARTIAL: "border-violet-200 bg-violet-50 text-violet-800",
  FAILED: "border-rose-200 bg-rose-50 text-rose-800",
  REFUNDED: "border-sky-200 bg-sky-50 text-sky-800",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
        paymentStatusStyles[status] ?? "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {paymentStatusLabels[status] ?? status}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
        active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Aktif" : "Pasif"}
    </span>
  );
}

export function PillButton({
  active,
  children,
  className = "",
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`min-w-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
        active
          ? "border-emerald-500 bg-[#10b981] text-white shadow-sm shadow-emerald-500/25"
          : "border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function DemoInput({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  min,
  max,
  className = "",
}: {
  label: string;
  name?: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
      />
    </label>
  );
}

export function DemoSelect({
  label,
  name,
  defaultValue,
  options,
  required,
  className = "",
}: {
  label: string;
  name?: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DemoPrimaryButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={`w-full rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-500/25 sm:w-auto ${className}`}
    >
      {children}
    </button>
  );
}

export function DemoSecondaryButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={`w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-sm shadow-slate-900/5 transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:w-auto ${className}`}
    >
      {children}
    </button>
  );
}
