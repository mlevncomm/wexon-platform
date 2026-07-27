import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSelect } from "@/components/marketing/admin-ui/AdminSelect";
import { ADMIN_FIELD_CONTROL_COMPACT } from "@/components/marketing/admin-ui/adminFieldStyles";

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
          className="inline-flex rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
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
        <AdminSelect
          name={fieldName}
          defaultValue={value}
          options={options}
          compact
          className="min-w-0 flex-1"
          aria-label={submitLabel}
        />
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-[10px] bg-slate-900 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
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
            className={ADMIN_FIELD_CONTROL_COMPACT}
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
  requireHighRiskConfirm = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  requireHighRiskConfirm?: boolean;
}) {
  const showConfirm = requireHighRiskConfirm && isActive;

  return (
    <form action={action} className={showConfirm ? "flex flex-col gap-2" : "inline-flex"}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className={`inline-flex min-h-9 items-center rounded-[10px] px-3 text-xs font-bold transition-colors ${
            isActive
              ? "border border-slate-200 border-l-4 border-l-amber-500 bg-white text-slate-800 hover:bg-slate-50"
              : "border border-slate-200 border-l-4 border-l-emerald-500 bg-white text-slate-800 hover:bg-slate-50"
          }`}
        >
          {isActive ? inactiveLabel : activeLabel}
        </button>
      </div>
      {showConfirm ? (
        <>
          <input
            name="reason"
            required
            minLength={8}
            placeholder="Gerekçe (min 8 karakter)"
            className={ADMIN_FIELD_CONTROL_COMPACT}
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

export function AdminPageActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
