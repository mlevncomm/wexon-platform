"use client";

import { updateOrderStatusAction } from "@/lib/wexpay-actions";
import type { KitchenOrderRow } from "@/lib/wexpay-read";
import {
  DemoPrimaryButton,
  formatLira,
  OrderStatusBadge,
  orderStatusLabels,
  WexPayEmptyNotice,
  WexPayPage,
  WexPayPanel,
  wexpayPanelShellClassName,
  WexPayDarkPanelHeaderBackdrop,
} from "@/components/wexpay/WexPayBusinessUI";

const KITCHEN_COLUMNS = [
  { key: "NEW", label: "Yeni", accent: "border-sky-200 bg-sky-50/60" },
  { key: "PREPARING", label: "Hazırlanıyor", accent: "border-amber-200 bg-amber-50/60" },
  { key: "SERVED", label: "Servis edildi", accent: "border-emerald-200 bg-emerald-50/60" },
] as const;

const NEXT_STATUS: Record<string, string | null> = {
  NEW: "PREPARING",
  PREPARING: "SERVED",
  SERVED: null,
};

function formatKitchenTime(value: string) {
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function KitchenOrderCard({
  order,
  canManage,
  redirectTo,
}: {
  order: KitchenOrderRow;
  canManage: boolean;
  redirectTo: string;
}) {
  const nextStatus = NEXT_STATUS[order.status] ?? null;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{order.orderNo}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{order.tableLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <OrderStatusBadge status={order.status} />
          <p className="mt-1 text-[11px] font-bold text-slate-400">{formatKitchenTime(order.createdAt)}</p>
        </div>
      </div>

      <ul className="space-y-1.5 px-4 py-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate font-medium text-slate-600">
              <span className="font-black text-slate-800">{item.quantity}×</span> {item.name}
            </span>
            <span className="shrink-0 font-bold text-slate-700">{formatLira(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs font-medium text-slate-500">Not: {order.note}</p>
      ) : null}

      {canManage && nextStatus ? (
        <form action={updateOrderStatusAction} className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="status" value={nextStatus} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <DemoPrimaryButton className="w-full !py-2.5 text-xs">
            {orderStatusLabels[nextStatus] ?? nextStatus} olarak işaretle
          </DemoPrimaryButton>
        </form>
      ) : null}
    </article>
  );
}

export default function WexPayKitchenBoard({
  orders,
  canManage,
  redirectTo,
}: {
  orders: KitchenOrderRow[];
  canManage: boolean;
  redirectTo: string;
}) {
  const grouped = KITCHEN_COLUMNS.map((column) => ({
    ...column,
    orders: orders.filter((order) => order.status === column.key),
  }));

  return (
    <WexPayPage>
      <section className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-950/[0.03]">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-6 sm:px-6">
          <WexPayDarkPanelHeaderBackdrop />
          <div className="relative min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Mutfak</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Hazırlık ekranı</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
              Şube siparişlerini mutfak akışına göre takip edin. Durum güncellemeleri masa hesabına otomatik yansır.
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
          {grouped.map((column) => (
            <div key={column.key} className={`min-w-0 rounded-[18px] border p-3 ${column.accent}`}>
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <h3 className="text-sm font-black text-slate-950">{column.label}</h3>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                  {column.orders.length}
                </span>
              </div>
              {column.orders.length === 0 ? (
                <div className={`${wexpayPanelShellClassName} border-dashed bg-white/70 p-4 text-center text-xs font-semibold text-slate-400`}>
                  Sipariş yok
                </div>
              ) : (
                <div className="space-y-3">
                  {column.orders.map((order) => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      canManage={canManage}
                      redirectTo={redirectTo}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {orders.length === 0 ? (
        <WexPayPanel eyebrow="Mutfak" title="Aktif sipariş yok">
          <WexPayEmptyNotice>Şu anda mutfakta takip edilecek sipariş bulunmuyor.</WexPayEmptyNotice>
        </WexPayPanel>
      ) : null}
    </WexPayPage>
  );
}
