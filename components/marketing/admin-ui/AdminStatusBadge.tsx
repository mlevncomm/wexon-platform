import type { ReactNode } from "react";

export type AdminStatusTone =
  | "active"
  | "pending"
  | "trial"
  | "info"
  | "inactive"
  | "failed"
  | "danger";

const TONE_CLASS: Record<AdminStatusTone, string> = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  pending: "bg-amber-50 text-amber-900 ring-amber-100",
  trial: "bg-sky-50 text-sky-800 ring-sky-100",
  info: "bg-sky-50 text-sky-800 ring-sky-100",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  failed: "bg-rose-50 text-rose-800 ring-rose-100",
  danger: "bg-rose-50 text-rose-900 ring-rose-200",
};

/** Map common domain status strings to semantic tones (display text stays caller-owned). */
export function adminStatusToneFromValue(value: string | null | undefined): AdminStatusTone {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!normalized) return "inactive";
  if (["ACTIVE", "PAID", "LIVE", "RESOLVED", "CLOSED", "SUCCESS", "SUCCEEDED"].includes(normalized)) {
    return "active";
  }
  if (["PENDING", "OPEN", "WAITING", "IN_PROGRESS", "PROCESSING", "WARN", "WARNING"].includes(normalized)) {
    return "pending";
  }
  if (["TRIAL", "TRIALING", "INFO", "INVITED"].includes(normalized)) {
    return "trial";
  }
  if (["FAILED", "SUSPENDED", "OVERDUE", "PAST_DUE", "EXPIRED", "REVOKED", "ERROR", "BLOCKED", "CANCELLED"].includes(normalized)) {
    return "failed";
  }
  if (["INACTIVE", "REMOVED", "DISABLED", "DRAFT"].includes(normalized)) {
    return "inactive";
  }
  return "info";
}

export function AdminStatusBadge({
  children,
  tone = "inactive",
  className = "",
}: {
  children: ReactNode;
  tone?: AdminStatusTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
