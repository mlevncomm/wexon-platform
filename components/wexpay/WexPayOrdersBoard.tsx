"use client";

import { useMemo, useState } from "react";
import { OrderStatus } from ".prisma/client";
import { updateOrderStatusAction } from "@/lib/wexpay-actions";
import {
  DemoPrimaryButton,
  DemoSecondaryButton,
  formatLira,
  InfoRow,
  OrderStatusBadge,
  orderStatusLabels,
  WexPayEmptyNotice,
  WexPayPanel,
  wexpayPanelShellClassName,
} from "@/components/wexpay/WexPayBusinessUI";

type OrderRow = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  subtotal: number;
  note: string | null;
  createdAt: string;
  tableLabel: string;
  items: { id: string; name: string; quantity: number; lineTotal: number }[];
};

const FILTERS: Array<{ value: "ALL" | OrderStatus; label: string }> = [
  { value: "ALL", label: "Tümü" },
  { value: OrderStatus.NEW, label: "Yeni" },
  { value: OrderStatus.PREPARING, label: "Hazırlanıyor" },
  { value: OrderStatus.SERVED, label: "Servis Edildi" },
  { value: OrderStatus.CANCELLED, label: "İptal Edildi" },
];

export default function WexPayOrdersBoard({
  orders,
  canManage,
  redirectTo,
}: {
  orders: OrderRow[];
  canManage: boolean;
  redirectTo: string;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? "");
  const [orderFilter, setOrderFilter] = useState<"ALL" | OrderStatus>("ALL");

  const filteredOrders = useMemo(() => {
    if (orderFilter === "ALL") return orders;
    return orders.filter((order) => order.status === orderFilter);
  }, [orders, orderFilter]);

  const selectedOrder = useMemo(() => {
    return (
      filteredOrders.find((order) => order.id === selectedOrderId) ??
      filteredOrders[0] ??
      orders.find((order) => order.id === selectedOrderId) ??
      orders[0] ??
      null
    );
  }, [filteredOrders, selectedOrderId, orders]);

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <WexPayPanel
        eyebrow="Operasyon"
        title="QR siparişler"
        description="Masa siparişlerini takip edin ve durumlarını güncelleyin."
        toolbar={
          <div className="flex min-w-0 flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setOrderFilter(filter.value)}
                className={`min-w-0 rounded-2xl border px-3 py-2 text-xs font-black transition-all ${
                  orderFilter === filter.value
                    ? "border-emerald-500 bg-[#10b981] text-white shadow-sm shadow-emerald-500/25"
                    : "border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-3">
          {filteredOrders.length === 0 && <WexPayEmptyNotice>Gösterilecek sipariş bulunmuyor.</WexPayEmptyNotice>}
          {filteredOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelectedOrderId(order.id)}
              className={`w-full rounded-[16px] border p-4 text-left shadow-sm transition-all ${
                order.id === selectedOrder?.id
                  ? "border-emerald-300 bg-emerald-50 shadow-emerald-900/10"
                  : "border-slate-200 bg-white shadow-slate-900/5 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-slate-50/80 hover:shadow-md"
              }`}
            >
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-black text-slate-950">{order.orderNo}</h3>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {order.tableLabel} · {new Date(order.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} · {order.items.length} kalem
                  </p>
                </div>
                <p className="shrink-0 text-lg font-black text-slate-950">{formatLira(order.subtotal)}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {order.items.slice(0, 4).map((item) => (
                  <div key={item.id} className="truncate rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/70">
                    {item.quantity}x {item.name}
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </WexPayPanel>

      {selectedOrder ? (
        <WexPayPanel
          eyebrow="Sipariş detayı"
          title={selectedOrder.orderNo}
          description={selectedOrder.tableLabel}
          headerAction={<OrderStatusBadge status={selectedOrder.status} />}
          className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-48px)] xl:overflow-y-auto"
        >

          <div className="space-y-3">
            {selectedOrder.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-[16px] border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.quantity} adet</p>
                </div>
                <p className="shrink-0 text-sm font-black text-slate-950">{formatLira(item.lineTotal)}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <InfoRow label="Sipariş notu" value={selectedOrder.note ?? "Not yok"} />
            <InfoRow label="Toplam tutar" value={formatLira(selectedOrder.subtotal)} />
            <InfoRow label="Durum" value={orderStatusLabels[selectedOrder.status] ?? selectedOrder.status} />
          </div>

          {canManage && (
            <div className="mt-5 grid gap-3">
              {selectedOrder.status === OrderStatus.NEW && (
                <form action={updateOrderStatusAction}>
                  <input type="hidden" name="orderId" value={selectedOrder.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <input type="hidden" name="status" value={OrderStatus.PREPARING} />
                  <DemoPrimaryButton className="w-full">Hazırlamaya Al</DemoPrimaryButton>
                </form>
              )}
              {selectedOrder.status !== OrderStatus.SERVED && selectedOrder.status !== OrderStatus.CANCELLED && (
                <form action={updateOrderStatusAction}>
                  <input type="hidden" name="orderId" value={selectedOrder.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <input type="hidden" name="status" value={OrderStatus.SERVED} />
                  <DemoSecondaryButton className="w-full">Servis Edildi</DemoSecondaryButton>
                </form>
              )}
              {selectedOrder.status !== OrderStatus.CANCELLED && selectedOrder.status !== OrderStatus.SERVED && (
                <form action={updateOrderStatusAction}>
                  <input type="hidden" name="orderId" value={selectedOrder.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <input type="hidden" name="status" value={OrderStatus.CANCELLED} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    İptal Et
                  </button>
                </form>
              )}
            </div>
          )}
        </WexPayPanel>
      ) : (
        <aside className={`${wexpayPanelShellClassName} p-5 text-sm font-semibold text-slate-500`}>
          Sipariş detayı için bir sipariş seçin.
        </aside>
      )}
    </div>
  );
}
