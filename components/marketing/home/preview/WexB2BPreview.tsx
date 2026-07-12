import type { WexB2BAppData } from "@/types/wexon";
import StatusBadge from "../StatusBadge";
import { MetricRow, PanelFrame } from "./PreviewParts";

export default function WexB2BPreview({ data }: { data: WexB2BAppData }) {
  return (
    <PanelFrame productName="WexB2B" title="Bayi & toptan satış paneli">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <div className="min-w-[26rem]">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
              Ürün kataloğu
            </div>
            <div className="grid grid-cols-[1.5fr_0.7fr_0.9fr_0.9fr] gap-2 border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">
              <span>Ürün</span>
              <span>Stok</span>
              <span>Bayi ₺</span>
              <span className="text-right">Durum</span>
            </div>
            {data.catalog.map((row) => (
              <div
                key={row.product}
                className="grid grid-cols-[1.5fr_0.7fr_0.9fr_0.9fr] items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-b-0"
              >
                <span className="truncate text-[13px] font-bold text-slate-900">{row.product}</span>
                <span className="text-[12px] font-medium text-slate-600">{row.stock}</span>
                <span className="text-[12px] font-bold text-slate-700">{row.dealerPrice}</span>
                <span className="flex justify-end">
                  <StatusBadge badge={row.status} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <div className="min-w-[26rem]">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
              Sipariş & teklifler
            </div>
            <div className="grid grid-cols-[1.4fr_0.9fr_1fr_0.9fr] gap-2 border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">
              <span>Bayi</span>
              <span>Teklif</span>
              <span>Sipariş</span>
              <span className="text-right">Ödeme</span>
            </div>
            {data.orders.map((o) => (
              <div
                key={o.quote}
                className="grid grid-cols-[1.4fr_0.9fr_1fr_0.9fr] items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-b-0"
              >
                <span className="truncate text-[13px] font-bold text-slate-900">{o.dealer}</span>
                <span className="truncate text-[11px] font-medium text-slate-500">{o.quote}</span>
                <span className="flex">
                  <StatusBadge badge={o.orderStatus} />
                </span>
                <span className="flex justify-end">
                  <StatusBadge badge={o.payment} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <MetricRow metrics={data.metrics} />
      </div>
    </PanelFrame>
  );
}
