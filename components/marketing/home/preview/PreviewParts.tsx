import type { PreviewMetric, PreviewNotification } from "@/types/wexon";
import { STATUS_DOT_CLASS } from "../StatusBadge";

export function PanelFrame({
  productName,
  title,
  children,
}: {
  productName: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </span>
        <p className="ml-1 truncate text-xs font-bold text-slate-500">
          {productName} <span className="font-semibold text-slate-400">· {title}</span>
        </p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function MetricRow({ metrics }: { metrics: PreviewMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="truncate text-[11px] font-semibold text-slate-400">{m.label}</p>
          <p className="mt-1 text-base font-black tracking-tight text-slate-950 sm:text-lg">{m.value}</p>
          {m.hint && <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{m.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function NotificationFeed({ items }: { items: PreviewNotification[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Canlı bildirimler</p>
      {items.map((n) => (
        <div
          key={n.title}
          className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
        >
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[n.tone]}`} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-slate-900">{n.title}</p>
            <p className="truncate text-[11px] font-medium text-slate-500">{n.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
