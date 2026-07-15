"use client";

import { useEffect, useMemo, useState } from "react";
import { updateOrderStatusAction } from "@/lib/wexpay-actions";
import type { KitchenOrderRow } from "@/lib/wexpay-read";
import {
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
  { key: "NEW", label: "Yeni", accent: "border-sky-200 bg-sky-50/60", next: "PREPARING" as const },
  { key: "PREPARING", label: "Hazırlanıyor", accent: "border-amber-200 bg-amber-50/60", next: "SERVED" as const },
  { key: "SERVED", label: "Servis edildi", accent: "border-emerald-200 bg-emerald-50/60", next: null },
] as const;

function formatKitchenTime(value: string) {
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function elapsedMins(iso: string) {
  return Math.max(0, Math.floor((new Date().getTime() - new Date(iso).getTime()) / 60000));
}

function KitchenOrderCard({
  order,
  canManage,
  redirectTo,
  selected,
  onSelect,
}: {
  order: KitchenOrderRow;
  canManage: boolean;
  redirectTo: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const column = KITCHEN_COLUMNS.find((item) => item.key === order.status);
  const nextStatus = column?.next ?? null;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
        selected ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200/80"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full border-b border-slate-100 px-4 py-3 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">{order.orderNo}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{order.tableLabel}</p>
          </div>
          <div className="shrink-0 text-right">
            <OrderStatusBadge status={order.status} />
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              {formatKitchenTime(order.createdAt)} · {elapsedMins(order.createdAt)} dk
            </p>
          </div>
        </div>
      </button>

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
          <button
            type="submit"
            data-kitchen-advance={order.id}
            data-kitchen-next={nextStatus}
            disabled={!selected}
            className="w-full rounded-2xl bg-[#10b981] px-5 py-2.5 text-xs font-black text-white shadow-sm shadow-emerald-500/25 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {orderStatusLabels[nextStatus] ?? nextStatus} olarak işaretle
            {selected ? "" : " (önce seçin)"}
          </button>
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
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null);
  const [mobileTab, setMobileTab] = useState<"NEW" | "PREPARING" | "SERVED">("NEW");

  const grouped = useMemo(
    () =>
      KITCHEN_COLUMNS.map((column) => ({
        ...column,
        orders: orders.filter((order) => order.status === column.key),
      })),
    [orders],
  );

  const selected = orders.find((order) => order.id === selectedId) ?? null;

  useEffect(() => {
    function isTyping(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      if (!selectedId || (event.key !== "1" && event.key !== "2")) return;
      const button = document.querySelector<HTMLButtonElement>(`[data-kitchen-advance="${selectedId}"]`);
      if (!button || button.disabled) return;
      const next = button.getAttribute("data-kitchen-next");
      if (event.key === "1" && next !== "PREPARING") return;
      if (event.key === "2" && next !== "SERVED") return;
      event.preventDefault();
      button.click();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  return (
    <WexPayPage>
      <section className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-950/[0.03]">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-6 sm:px-6">
          <WexPayDarkPanelHeaderBackdrop />
          <div className="relative min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Mutfak</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Hazırlık ekranı</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
              Ticket seçin, ardından ekrandaki aksiyonu kullanın. Kısayol: seçili ticket için{" "}
              <kbd className="rounded bg-white/10 px-1.5 py-0.5">1</kbd> hazırlamaya,{" "}
              <kbd className="rounded bg-white/10 px-1.5 py-0.5">2</kbd> servise. İptal/kapatma kısayolda yok.
            </p>
            {selected ? (
              <p className="mt-3 text-xs font-bold text-emerald-200">
                Seçili: {selected.orderNo} · {orderStatusLabels[selected.status] ?? selected.status}
              </p>
            ) : (
              <p className="mt-3 text-xs font-bold text-amber-200">Durum geçişi için bir ticket seçin.</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3 lg:hidden">
          {KITCHEN_COLUMNS.map((column) => (
            <button
              key={column.key}
              type="button"
              onClick={() => setMobileTab(column.key)}
              className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                mobileTab === column.key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {column.label} ({orders.filter((o) => o.status === column.key).length})
            </button>
          ))}
        </div>

        <div className="hidden gap-3 overflow-x-auto p-4 sm:p-5 lg:grid lg:grid-cols-3 lg:overflow-visible">
          {grouped.map((column) => (
            <div
              key={column.key}
              className={`flex max-h-[70vh] min-w-[16rem] flex-col gap-3 overflow-y-auto rounded-[18px] border p-3 sm:min-w-[18rem] lg:min-w-0 ${column.accent}`}
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-sm font-black text-slate-950">{column.label}</h3>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                  {column.orders.length}
                </span>
              </div>
              {column.orders.length === 0 ? (
                <div
                  className={`${wexpayPanelShellClassName} border-dashed bg-white/70 p-4 text-center text-xs font-semibold text-slate-400`}
                >
                  Sipariş yok
                </div>
              ) : (
                column.orders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    canManage={canManage}
                    redirectTo={redirectTo}
                    selected={selectedId === order.id}
                    onSelect={() => setSelectedId(order.id)}
                  />
                ))
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3 p-4 lg:hidden">
          {grouped
            .find((column) => column.key === mobileTab)
            ?.orders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                canManage={canManage}
                redirectTo={redirectTo}
                selected={selectedId === order.id}
                onSelect={() => setSelectedId(order.id)}
              />
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
