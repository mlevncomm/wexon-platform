import Link from "next/link";
import type { ReactNode } from "react";

export function AdminQuickLinks({
  links,
}: {
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href + link.label}
          href={link.href}
          className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export function AdminOrgLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/admin/organizations/${id}`} className="font-semibold text-slate-950 transition-colors hover:text-emerald-700">
      {name}
    </Link>
  );
}

export function AdminInlineSelectForm({
  action,
  returnTo,
  fieldName,
  value,
  options,
  submitLabel = "Kaydet",
  requireHighRiskConfirm = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
  fieldName: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  submitLabel?: string;
  requireHighRiskConfirm?: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          name={fieldName}
          defaultValue={value}
          className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-300"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
        >
          {submitLabel}
        </button>
      </div>
      {requireHighRiskConfirm ? (
        <>
          <input
            name="reason"
            required
            minLength={8}
            placeholder="Gerekçe (min 8 karakter)"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-300"
          />
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" name="confirmed" value="1" required className="h-3.5 w-3.5 rounded border-slate-300" />
            Değişikliği onaylıyorum
          </label>
        </>
      ) : null}
    </form>
  );
}

export function AdminInlineToggleForm({
  action,
  returnTo,
  isActive,
  activeLabel = "Aktif",
  inactiveLabel = "Pasif",
}: {
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
          isActive
            ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        }`}
      >
        {isActive ? inactiveLabel : activeLabel}
      </button>
    </form>
  );
}

export function AdminPageActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
