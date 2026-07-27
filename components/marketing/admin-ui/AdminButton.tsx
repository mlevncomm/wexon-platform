import type { ButtonHTMLAttributes, ReactNode } from "react";

export type AdminButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_CLASS: Record<AdminButtonVariant, string> = {
  primary:
    "bg-slate-950 text-white hover:bg-emerald-700 focus-visible:ring-emerald-200",
  secondary:
    "border border-slate-200 bg-white text-slate-800 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-emerald-100",
  danger:
    "bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-200",
};

export function AdminButton({
  children,
  variant = "primary",
  className = "",
  type = "submit",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: AdminButtonVariant;
}) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-[10px] px-5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
