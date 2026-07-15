"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { qrCard, qrFrameNarrow, qrGhostCta, qrIconBtn, qrPrimaryCta } from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import {
  normalizeOrderStatus,
  orderStatusLabel,
  type QrBillSnapshot,
  type QrOrderStatus,
  type QrTableContext,
} from "@/lib/qr-order/types";

const TRACK_STEPS: QrOrderStatus[] = ["NEW", "PREPARING", "SERVED"];

function statusRank(status: QrOrderStatus | null): number {
  if (!status || status === "CANCELLED") return -1;
  return TRACK_STEPS.indexOf(status);
}

export default function QrOrderStatusScreen({
  context,
  highlightOrderNo,
  onBack,
  onNewOrder,
  onViewBill,
}: {
  context: QrTableContext;
  highlightOrderNo: string | null;
  onBack: () => void;
  onNewOrder: () => void;
  onViewBill: () => void;
}) {
  const [bill, setBill] = useState<QrBillSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryDelay, setRetryDelay] = useState(0);
  const inFlight = useRef(false);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const response = await fetch(`/api/wexpay/public/${encodeURIComponent(context.qrCode)}/bill`);
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        bill?: QrBillSnapshot;
      };
      if (!response.ok) {
        setError(payload.error ?? "Sipariş durumu yüklenemedi.");
        setRetryDelay((current) => Math.min(30_000, current ? current * 2 : 2_000));
        return;
      }
      setBill(payload.bill ?? null);
      setRetryDelay(0);
    } catch {
      setError("Bağlantı hatası. Lütfen yenileyin.");
      setRetryDelay((current) => Math.min(30_000, current ? current * 2 : 2_000));
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [context.qrCode]);

  useEffect(() => {
    cancelled.current = false;
    void load();

    const intervalMs = 6_000;
    const timer = window.setInterval(() => {
      if (document.hidden || cancelled.current) return;
      void load();
    }, intervalMs);

    function onVisibility() {
      if (!document.hidden) void load();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled.current = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (!retryDelay) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) void load();
    }, retryDelay);
    return () => window.clearTimeout(timer);
  }, [retryDelay, load]);

  const orders = (() => {
    if (!bill?.lines?.length) return [] as Array<{ orderNo: string; status: string; total: number }>;
    const map = new Map<string, { orderNo: string; status: string; total: number }>();
    for (const line of bill.lines) {
      const existing = map.get(line.orderNo);
      if (existing) {
        existing.total += line.lineTotal;
        // Prefer more advanced kitchen status when lines diverge
        const next = normalizeOrderStatus(line.status);
        const prev = normalizeOrderStatus(existing.status);
        if (statusRank(next) > statusRank(prev)) existing.status = line.status;
      } else {
        map.set(line.orderNo, {
          orderNo: line.orderNo,
          status: line.status,
          total: line.lineTotal,
        });
      }
    }
    return [...map.values()];
  })();

  const focused =
    orders.find((order) => order.orderNo === highlightOrderNo) ?? orders[orders.length - 1] ?? null;
  const focusedStatus = focused ? normalizeOrderStatus(focused.status) : null;

  return (
    <div className={`${qrFrameNarrow} min-h-[100dvh] pb-10 pt-4`} data-testid="qr-order-status-screen">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className={qrIconBtn} aria-label="Geri">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">Takip</p>
          <h1 className="truncate text-lg font-black tracking-tight text-slate-950">
            Sipariş durumu · {context.tableLabel}
          </h1>
        </div>
        <button type="button" onClick={() => void load()} className={qrGhostCta} data-testid="qr-status-refresh">
          Yenile
        </button>
      </header>

      {loading && !bill ? (
        <div className="mt-6 space-y-3">
          <div className="h-28 animate-pulse rounded-[28px] bg-white/70 motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-[28px] bg-white/70 motion-reduce:animate-none" />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 rounded-[24px] bg-rose-50 px-4 py-4 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}

      {focused ? (
        <div className={`${qrCard} mt-5 p-5`}>
          <p className="text-sm font-black text-slate-950">{focused.orderNo}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{formatTry(focused.total)}</p>
          <ol className="mt-5 space-y-2.5">
            {TRACK_STEPS.map((step) => {
              const active = focusedStatus === step;
              const reached =
                focusedStatus === "CANCELLED"
                  ? false
                  : statusRank(focusedStatus) >= statusRank(step);
              return (
                <li
                  key={step}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold ${
                    active ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200" : reached ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                      reached ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                    aria-hidden="true"
                  >
                    {reached ? "✓" : "·"}
                  </span>
                  <span>{orderStatusLabel(step)}</span>
                </li>
              );
            })}
          </ol>
          {focusedStatus === "CANCELLED" ? (
            <p className="mt-3 text-sm font-bold text-rose-700">{orderStatusLabel("CANCELLED")}</p>
          ) : null}
          <p className="mt-3 text-[11px] font-medium text-slate-400">
            Durum restoran sisteminden okunur. Sahte ara adım gösterilmez.
          </p>
        </div>
      ) : null}

      {!loading && orders.length === 0 ? (
        <div className={`${qrCard} mt-6 p-6 text-center`}>
          <p className="text-base font-black text-slate-900">Takip edilecek sipariş yok</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Yeni bir sipariş göndererek başlayabilirsiniz.</p>
        </div>
      ) : null}

      {orders.length > 1 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Masa siparişleri</p>
          {orders.map((order) => (
            <div key={order.orderNo} className={`${qrCard} flex items-center justify-between px-4 py-3`}>
              <div>
                <p className="text-sm font-black text-slate-950">{order.orderNo}</p>
                <p className="text-xs font-semibold text-slate-500">{orderStatusLabel(order.status)}</p>
              </div>
              <p className="text-sm font-black tabular-nums">{formatTry(order.total)}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 space-y-2">
        <button type="button" data-testid="qr-status-new-order" onClick={onNewOrder} className={qrPrimaryCta}>
          Yeni Sipariş Ver
        </button>
        <button type="button" onClick={onViewBill} className={qrGhostCta}>
          Hesabı Gör
        </button>
      </div>
    </div>
  );
}
