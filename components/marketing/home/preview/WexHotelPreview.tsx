import type { HotelRoomState, WexHotelAppData } from "@/types/wexon";
import StatusBadge from "../StatusBadge";
import { MetricRow, PanelFrame } from "./PreviewParts";

const ROOM_STYLE: Record<HotelRoomState, { cell: string; label: string; dot: string }> = {
  available: { cell: "border-emerald-300 bg-emerald-50 text-emerald-800", label: "Müsait", dot: "bg-emerald-500" },
  occupied: { cell: "border-slate-300 bg-white text-slate-700", label: "Dolu", dot: "bg-slate-400" },
  cleaning: { cell: "border-amber-300 bg-amber-50 text-amber-800", label: "Temizlik", dot: "bg-amber-500" },
  reserved: { cell: "border-blue-300 bg-blue-50 text-blue-800", label: "Rezerve", dot: "bg-blue-500" },
};

const LEGEND: HotelRoomState[] = ["available", "occupied", "cleaning", "reserved"];

export default function WexHotelPreview({ data }: { data: WexHotelAppData }) {
  return (
    <PanelFrame productName="WexHotel" title="Otel operasyon paneli">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
            {data.rooms.map((room) => {
              const style = ROOM_STYLE[room.state];
              return (
                <div
                  key={room.label}
                  className={`flex flex-col items-center justify-center rounded-xl border px-1 py-2.5 text-center ${style.cell}`}
                >
                  <span className="text-[13px] font-black">{room.label}</span>
                  <span className="mt-0.5 text-[10px] font-semibold leading-tight">{style.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {LEGEND.map((state) => (
              <span key={state} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                <span className={`h-2 w-2 rounded-full ${ROOM_STYLE[state].dot}`} />
                {ROOM_STYLE[state].label}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <div className="min-w-[28rem]">
            <div className="grid grid-cols-[1.2fr_1.3fr_0.8fr_0.9fr] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">
              <span>Misafir</span>
              <span>Oda</span>
              <span>Giriş</span>
              <span className="text-right">Ödeme</span>
            </div>
            {data.reservations.map((r) => (
              <div
                key={r.guest}
                className="grid grid-cols-[1.2fr_1.3fr_0.8fr_0.9fr] items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-b-0"
              >
                <span className="truncate text-[13px] font-bold text-slate-900">{r.guest}</span>
                <span className="truncate text-[12px] font-medium text-slate-600">{r.room}</span>
                <span className="text-[11px] font-medium text-slate-500">
                  {r.checkIn}
                  <span className="text-slate-300"> → </span>
                  {r.checkOut}
                </span>
                <span className="flex justify-end">
                  <StatusBadge badge={r.payment} />
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
