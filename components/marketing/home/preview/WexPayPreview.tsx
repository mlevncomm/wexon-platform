import type { WexPayAppData, WexPayTableState } from "@/types/wexon";
import { WexonIcon } from "../icons";
import { MetricRow, NotificationFeed, PanelFrame } from "./PreviewParts";

const STATE_STYLE: Record<WexPayTableState, { cell: string; label: string; dot: string }> = {
  empty: { cell: "border-slate-200 bg-slate-50 text-slate-400", label: "Boş", dot: "bg-slate-300" },
  occupied: { cell: "border-slate-300 bg-white text-slate-700", label: "Dolu", dot: "bg-slate-400" },
  ordered: { cell: "border-blue-300 bg-blue-50 text-blue-800", label: "Sipariş alındı", dot: "bg-blue-500" },
  awaiting: { cell: "border-amber-300 bg-amber-50 text-amber-800", label: "Ödeme bekliyor", dot: "bg-amber-500" },
  partial: { cell: "border-indigo-300 bg-indigo-50 text-indigo-800", label: "Kısmi ödendi", dot: "bg-indigo-500" },
  paid: { cell: "border-emerald-300 bg-emerald-50 text-emerald-800", label: "Tamamlandı", dot: "bg-emerald-500" },
};

const LEGEND: WexPayTableState[] = ["empty", "occupied", "ordered", "awaiting", "partial", "paid"];

export default function WexPayPreview({ data }: { data: WexPayAppData }) {
  return (
    <PanelFrame productName="WexPay" title="Restoran masa yönetimi">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
            {data.tables.map((t) => {
              const style = STATE_STYLE[t.state];
              return (
                <div
                  key={t.label}
                  className={`flex flex-col items-center justify-center rounded-xl border px-1 py-2.5 text-center ${style.cell}`}
                >
                  <span className="text-[12px] font-black">{t.label}</span>
                  <span className="mt-0.5 text-[10px] font-semibold leading-tight">
                    {t.amount ?? style.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {LEGEND.map((state) => (
              <span key={state} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                <span className={`h-2 w-2 rounded-full ${STATE_STYLE[state].dot}`} />
                {STATE_STYLE[state].label}
              </span>
            ))}
          </div>
        </div>

        <NotificationFeed items={data.notifications} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Müşteri QR akışı</p>
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
          {data.qrFlow.map((step, index) => (
            <div key={step.label} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 sm:text-xs">
                <WexonIcon name={step.icon} size={14} className="text-emerald-500" />
                {step.label}
              </span>
              {index < data.qrFlow.length - 1 && (
                <WexonIcon name="arrowRight" size={13} className="shrink-0 text-slate-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <MetricRow metrics={data.metrics} />
      </div>
    </PanelFrame>
  );
}
