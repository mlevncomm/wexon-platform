import type { ReactNode } from "react";
import Link from "next/link";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const labelClass = "block";
const labelTextClass = "text-xs font-black uppercase tracking-[0.12em] text-slate-400";

export function WexPayErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
      {message}
    </div>
  );
}

export function WexPayField({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required = false,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className={labelClass}>
      <span className={labelTextClass}>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        step={step}
        min={min}
        max={max}
        className={fieldClass}
      />
    </label>
  );
}

export function WexPayTextarea({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className={labelClass}>
      <span className={labelTextClass}>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={3}
        className={`${fieldClass} resize-y`}
      />
    </label>
  );
}

export function WexPaySelect({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className={labelClass}>
      <span className={labelTextClass}>{label}</span>
      <select name={name} defaultValue={defaultValue} className={fieldClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WexPayCheckbox({
  label,
  name,
  description,
  defaultChecked = false,
}: {
  label: string;
  name: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <input
        name={name}
        value="true"
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />
      <span>
        <span className="block text-sm font-black text-slate-950">{label}</span>
        {description && <span className="mt-1 block text-xs font-semibold text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

export function WexPaySubmit({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {children}
    </button>
  );
}

const badgeTones: Record<string, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
};

export function WexPayBadge({
  tone = "slate",
  children,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeTones[tone] ?? badgeTones.slate}`}
    >
      {children}
    </span>
  );
}

const tableStatusConfig: Record<string, { label: string; tone: keyof typeof badgeTones }> = {
  EMPTY: { label: "Boş", tone: "slate" },
  OCCUPIED: { label: "Dolu", tone: "amber" },
  PAYMENT_PENDING: { label: "Ödeme bekliyor", tone: "emerald" },
  PARTIALLY_PAID: { label: "Kısmi ödendi", tone: "sky" },
  PAID: { label: "Ödendi", tone: "emerald" },
  RECEIPT_REQUESTED: { label: "Fiş talep edildi", tone: "rose" },
  CLOSED: { label: "Kapatıldı", tone: "slate" },
};

export function WexPayTableStatusBadge({ status }: { status: string }) {
  const config = tableStatusConfig[status] ?? { label: status, tone: "slate" as const };
  return <WexPayBadge tone={config.tone}>{config.label}</WexPayBadge>;
}

export function WexPayActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <WexPayBadge tone={isActive ? "emerald" : "slate"}>{isActive ? "Aktif" : "Pasif"}</WexPayBadge>
  );
}

const orderStatusConfig: Record<string, { label: string; tone: keyof typeof badgeTones }> = {
  NEW: { label: "Yeni", tone: "sky" },
  PREPARING: { label: "Hazırlanıyor", tone: "amber" },
  SERVED: { label: "Servis edildi", tone: "emerald" },
  CANCELLED: { label: "İptal", tone: "rose" },
};

export function WexPayOrderStatusBadge({ status }: { status: string }) {
  const config = orderStatusConfig[status] ?? { label: status, tone: "slate" as const };
  return <WexPayBadge tone={config.tone}>{config.label}</WexPayBadge>;
}

const paymentStatusConfig: Record<string, { label: string; tone: keyof typeof badgeTones }> = {
  PENDING: { label: "Bekliyor", tone: "amber" },
  PAID: { label: "Ödendi", tone: "emerald" },
  PARTIAL: { label: "Kısmi", tone: "sky" },
  FAILED: { label: "Başarısız", tone: "rose" },
  REFUNDED: { label: "İade", tone: "slate" },
};

export function WexPayPaymentStatusBadge({ status }: { status: string }) {
  const config = paymentStatusConfig[status] ?? { label: status, tone: "slate" as const };
  return <WexPayBadge tone={config.tone}>{config.label}</WexPayBadge>;
}

export function WexPayBranchSelector({
  basePath,
  branches,
  activeBranchId,
}: {
  basePath: string;
  branches: Array<{ id: string; name: string; restaurant: { name: string } }>;
  activeBranchId: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {branches.map((branch) => {
        const active = branch.id === activeBranchId;
        return (
          <Link
            key={branch.id}
            href={`${basePath}?branchId=${branch.id}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "border-emerald-200 bg-emerald-50 font-bold text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {branch.restaurant.name} · {branch.name}
          </Link>
        );
      })}
    </div>
  );
}
