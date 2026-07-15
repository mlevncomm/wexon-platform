import Link from "next/link";
import type { OperationsNotification } from "@/lib/wexpay-read";
import { appNavigationUrl } from "@/lib/wexon/urls";

export type OpsAlertKind = "waiter_call" | "payment_request" | "ops";

export type OpsAlertItem = {
  id: string;
  kind: OpsAlertKind;
  title: string;
  message: string;
  createdAt: string;
  href: string;
};

export function classifyOpsNotification(notification: OperationsNotification): OpsAlertKind {
  const title = notification.title ?? "";
  if (title.includes("[GARSON ÇAĞRISI]")) return "waiter_call";
  if (title.includes("[ÖDEME TALEBİ]")) return "payment_request";
  return "ops";
}

export function buildOpsAlerts(
  notifications: OperationsNotification[],
  organizationId: string,
  branchId: string,
): OpsAlertItem[] {
  const baseParams = `organizationId=${encodeURIComponent(organizationId)}&branchId=${encodeURIComponent(branchId)}`;
  return notifications.map((notification) => {
    const kind = classifyOpsNotification(notification);
    const href =
      kind === "waiter_call" || kind === "payment_request"
        ? appNavigationUrl("/apps/wexpay/tables", baseParams)
        : appNavigationUrl("/apps/wexpay", baseParams);
    return {
      id: notification.id,
      kind,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      href,
    };
  });
}

const KIND_LABEL: Record<OpsAlertKind, string> = {
  waiter_call: "Garson çağrısı",
  payment_request: "Müşteri ödeme istedi",
  ops: "Operasyon",
};

const KIND_CLASS: Record<OpsAlertKind, string> = {
  waiter_call: "border-sky-200 bg-sky-50 text-sky-950",
  payment_request: "border-amber-200 bg-amber-50 text-amber-950",
  ops: "border-slate-200 bg-white text-slate-900",
};

export function WexPayOperationsAlertStrip({
  alerts,
  emptyHint = "Aktif garson çağrısı veya müşteri ödeme isteği yok.",
}: {
  alerts: OpsAlertItem[];
  emptyHint?: string;
}) {
  const priority = alerts.filter((alert) => alert.kind === "waiter_call" || alert.kind === "payment_request");
  const items = priority.length > 0 ? priority : alerts.slice(0, 4);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-500">
        {emptyHint}
      </div>
    );
  }

  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Operasyon uyarıları">
      {items.map((alert) => (
        <Link
          key={alert.id}
          href={alert.href}
          className={`min-h-[3rem] rounded-2xl border p-4 transition hover:shadow-sm ${KIND_CLASS[alert.kind]}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-80">{KIND_LABEL[alert.kind]}</p>
            <time className="text-[10px] font-bold opacity-70">
              {new Date(alert.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </time>
          </div>
          <p className="mt-2 text-sm font-black leading-snug">
            {alert.kind === "payment_request"
              ? "Müşteri ödeme istedi"
              : alert.kind === "waiter_call"
                ? "Yeni garson çağrısı"
                : alert.title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs font-semibold opacity-80">{alert.message}</p>
          <p className="mt-3 text-xs font-black underline-offset-2 hover:underline">Masalara git →</p>
        </Link>
      ))}
    </section>
  );
}
