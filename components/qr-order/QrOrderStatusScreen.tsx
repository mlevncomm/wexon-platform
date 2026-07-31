"use client";

import { useEffect, useRef, useState } from "react";
import { qrCard, qrFrameNarrow, qrGhostCta, qrGhostCtaInline, qrPrimaryCta } from "@/components/qr-order/qr-theme";
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
  onBack: _onBack,
  onNewOrder,
  onViewBill,
}: {
  context: QrTableContext;
  highlightOrderNo: string | null;
  onBack: () => void;
  onNewOrder: () => void;
  onViewBill: () => void;
}) {
  void _onBack;
  const [bill, setBill] = useState<QrBillSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const cancelled = useRef(false);
  const retryMs = useRef(0);

  useEffect(() => {
    cancelled.current = false;
    retryMs.current = 0;

    async function loadBill() {
      if (inFlight.current || cancelled.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      inFlight.current = true;
      try {
        const response = await fetch(`/api/wexpay/public/${encodeURIComponent(context.qrCode)}/bill`);
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          bill?: QrBillSnapshot;
        };
        if (cancelled.current) return;
        if (!response.ok) {
          setError(payload.error ?? "Sipariş durumu yüklenemedi.");
          retryMs.current = Math.min(30_000, retryMs.current ? retryMs.current * 2 : 2_000);
          return;
        }
        setBill(payload.bill ?? null);
        setError(null);
        retryMs.current = 0;
      } catch {
        if (!cancelled.current) {
          setError("Bağlantı hatası. Lütfen yenileyin.");
          retryMs.current = Math.min(30_000, retryMs.current ? retryMs.current * 2 : 2_000);
        }
      } finally {
        if (!cancelled.current) setLoading(false);
        inFlight.current = false;
      }
    }

    const kickoff = window.setTimeout(() => {
      void loadBill();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadBill();
    }, 6_000);

    const retryId = window.setInterval(() => {
      if (retryMs.current > 0 && !document.hidden) {
        void loadBill();
      }
    }, 2_000);

    function onVisibility() {
      if (!document.hidden) void loadBill();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled.current = true;
      window.clearTimeout(kickoff);
      window.clearInterval(intervalId);
      window.clearInterval(retryId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [context.qrCode]);

  async function refresh() {
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
        return;
      }
      setBill(payload.bill ?? null);
      retryMs.current = 0;
    } catch {
      setError("Bağlantı hatası. Lütfen yenileyin.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  const orders = (() => {
    if (!bill?.lines?.length) return [] as Array<{ orderNo: string; status: string; total: number }>;
    const map = new Map<string, { orderNo: string; status: string; total: number }>();
    for (const line of bill.lines) {
      const existing = map.get(line.orderNo);
      if (existing) {
        existing.total += line.lineTotal;
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
    <div
      className={`${qrFrameNarrow} min-h-[100dvh] pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[max(10px,env(safe-area-inset-top))]`}
      data-testid="qr-order-status-screen"
    >
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Siparişlerim</p>
          <h1 className="truncate text-lg font-black tracking-tight text-slate-950">
            Sipariş durumu · {context.tableLabel}
          </h1>
        </div>
        <button type="button" onClick={() => void refresh()} className={qrGhostCtaInline} data-testid="qr-status-refresh">
          Yenile
        </button>
      </header>

      {loading && !bill ? (
        <div className="mt-6 space-y-3">
          <div className="h-28 animate-pulse rounded-[20px] bg-white/80 motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-[20px] bg-white/80 motion-reduce:animate-none" />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 rounded-[20px] bg-rose-50 px-4 py-4 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}

      {focused ? (
        <div className={`${qrCard} mt-5 p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{focused.orderNo}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{formatTry(focused.total)}</p>
            </div>
            <span className="rounded-full bg-wx-ink px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              {orderStatusLabel(focused.status)}
            </span>
          </div>
          <ol className="relative mt-6 space-y-0 border-l-2 border-slate-200 pl-5">
            {TRACK_STEPS.map((step, index) => {
              const active = focusedStatus === step;
              const reached =
                focusedStatus === "CANCELLED"
                  ? false
                  : statusRank(focusedStatus) >= statusRank(step);
              return (
                <li key={step} className={`relative pb-5 last:pb-0 ${active ? "text-slate-950" : reached ? "text-slate-700" : "text-slate-400"}`}>
                  <span
                    className={`absolute -left-[1.55rem] top-0 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${
                      reached ? "bg-wx-ink text-white" : "bg-white text-slate-400 ring-2 ring-slate-200"
                    }`}
                    aria-hidden="true"
                  >
                    {reached ? "✓" : index + 1}
                  </span>
                  <p className={`text-sm font-black ${active ? "text-wx-ink" : ""}`}>
                    {orderStatusLabel(step)}
                  </p>
                  {active ? (
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">Şu anki durum</p>
                  ) : null}
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
