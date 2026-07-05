import type { ReactNode } from "react";

export function AdminFormPanel({
  title,
  description,
  children,
  className = "",
  collapsible = false,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  if (collapsible) {
    return (
      <details
        open={defaultOpen}
        className={`group min-w-0 max-w-full rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:rounded-[32px] sm:p-6 ${className}`}
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block break-words text-xl font-black tracking-tight text-slate-950">{title}</span>
            {description && <span className="mt-2 block text-sm leading-relaxed text-slate-600">{description}</span>}
          </span>
          <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600 transition group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="mt-5">{children}</div>
      </details>
    );
  }

  return (
    <section className={`min-w-0 max-w-full rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:rounded-[32px] sm:p-6 ${className}`}>
      <div className="mb-5 min-w-0">
        <h3 className="break-words text-xl font-black tracking-tight text-slate-950">{title}</h3>
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
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

export function AdminSelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      >
        {children}
      </select>
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

export function AdminSubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-[#48e050] sm:w-auto"
    >
      {children}
    </button>
  );
}

export function AdminActionNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" }) {
  const styles = {
    info: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-relaxed ${styles[tone]}`}>
      {children}
    </div>
  );
}
