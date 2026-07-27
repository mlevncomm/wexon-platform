import type { ReactNode } from "react";
import { AdminButton, type AdminButtonVariant } from "@/components/marketing/admin-ui/AdminButton";
import { AdminCallout, type AdminCalloutTone } from "@/components/marketing/admin-ui/AdminCallout";
import { AdminSelect, type AdminSelectOption } from "@/components/marketing/admin-ui/AdminSelect";
import {
  ADMIN_FIELD_CONTROL,
} from "@/components/marketing/admin-ui/adminFieldStyles";

export type { AdminSelectOption };
export { ADMIN_FIELD_CONTROL, ADMIN_FIELD_CONTROL_COMPACT, ADMIN_FIELD_TEXTAREA, ADMIN_FIELD_SURFACE } from "@/components/marketing/admin-ui/adminFieldStyles";

export function AdminFormPanel({
  title,
  description,
  children,
  className = "",
  collapsible = false,
  defaultOpen = false,
  badge,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  if (collapsible) {
    return (
      <details
        open={defaultOpen || undefined}
        className={`group flex h-full min-w-0 max-w-full flex-col rounded-[12px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6 ${className}`}
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="block break-words text-lg font-black tracking-tight text-slate-950">{title}</span>
              {badge}
            </span>
            {description ? (
              <span className="mt-2 block min-h-[2.75rem] text-sm leading-relaxed text-slate-600">{description}</span>
            ) : null}
          </span>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-slate-100 text-sm font-black text-slate-600 transition group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="mt-5 border-t border-slate-100 pt-5">{children}</div>
      </details>
    );
  }

  return (
    <section
      className={`min-w-0 max-w-full rounded-[12px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6 ${className}`}
    >
      <div className="mb-5 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-black tracking-tight text-slate-950">{title}</h3>
          {badge}
        </div>
        {description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function AdminTextField({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
  helper,
  minLength,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
  helper?: string;
  minLength?: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className={ADMIN_FIELD_CONTROL}
      />
      {helper ? <span className="mt-1.5 block text-xs font-semibold text-slate-500">{helper}</span> : null}
    </label>
  );
}

export function AdminSelectField({
  label,
  name,
  defaultValue,
  options,
  helper,
  required = false,
  placeholder = "Seçin",
  compact = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: AdminSelectOption[];
  helper?: string;
  required?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <AdminSelect
        name={name}
        options={options}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        compact={compact}
        aria-label={label}
      />
      {helper ? <span className="mt-1.5 block text-xs font-semibold text-slate-500">{helper}</span> : null}
    </label>
  );
}

export function AdminDateField({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return <AdminTextField label={label} name={name} type="date" defaultValue={defaultValue} required={required} />;
}

export function AdminSubmitButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: AdminButtonVariant;
}) {
  return <AdminButton variant={variant}>{children}</AdminButton>;
}

export function AdminActionNotice({
  children,
  tone = "info",
  title,
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "error";
  title?: string;
}) {
  const calloutTone: AdminCalloutTone =
    tone === "warning" ? "warning" : tone === "error" ? "error" : "info";
  return (
    <AdminCallout tone={calloutTone} title={title}>
      {children}
    </AdminCallout>
  );
}

export { AdminButton } from "@/components/marketing/admin-ui/AdminButton";
export { AdminCallout } from "@/components/marketing/admin-ui/AdminCallout";
export { AdminDangerZone } from "@/components/marketing/admin-ui/AdminDangerZone";
export {
  AdminActionMenu,
  AdminActionMenuHint,
  AdminActionMenuSection,
} from "@/components/marketing/admin-ui/AdminActionMenu";
export { AdminSelect } from "@/components/marketing/admin-ui/AdminSelect";
