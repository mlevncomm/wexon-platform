"use client";

import { useEffect, useState } from "react";
import { formatTry } from "@/lib/qr-order/format";
import type { QrBillSnapshot, QrTableContext } from "@/lib/qr-order/types";

export default function QrBillScreen({
  context,
  onBack,
  onCallWaiter,
}: {
  context: QrTableContext;
  onBack: () => void;
  onCallWaiter: () => void;
}) {
  const [bill, setBill] = useState<QrBillSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/wexpay/public/${encodeURIComponent(context.qrCode)}/bill`);
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          bill?: QrBillSnapshot;
        };
        if (!response.ok) {
          if (!cancelled) setError(payload.error ?? "Hesap yüklenemedi.");
          return;
        }
        if (!cancelled) setBill(payload.bill ?? null);
      } catch {
        if (!cancelled) setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [context.qrCode]);

  async function requestPayment(mode: string) {
    if (requestPending) return;
    setRequestPending(true);
    setRequestError(null);
    try {
      const response = await fetch(
        `/api/wexpay/public/${encodeURIComponent(context.qrCode)}/payment-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setRequestError(payload.error ?? "Ödeme talebi gönderilemedi.");
        return;
      }
      setRequestSuccess(true);
    } catch {
      setRequestError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setRequestPending(false);
    }
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-10 pt-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-bold"
          aria-label="Geri"
        >
          ←
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Masa hesabı</p>
          <h1 className="truncate text-lg font-black text-slate-950">
            {context.restaurantName} · {context.tableLabel}
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="mt-6 space-y-3" data-testid="qr-bill-loading">
          <div className="h-24 animate-pulse rounded-[22px] bg-slate-200/70" />
          <div className="h-40 animate-pulse rounded-[22px] bg-slate-200/70" />
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}

      {bill && !loading ? (
        <div className="mt-5 space-y-4" data-testid="qr-bill-screen">
          {bill.empty ? (
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">
              Bu masa için henüz açık hesap yok. Önce sipariş verebilirsiniz.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {bill.lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-start justify-between gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">
                        {line.quantity}× {line.name}
                      </p>
                      <p className="text-xs font-semibold text-slate-400">
                        {line.orderNo} · {line.status}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-slate-950">
                      {formatTry(line.lineTotal)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="flex justify-between text-sm font-bold text-slate-600">
                  <span>Toplam</span>
                  <span>{formatTry(bill.totalAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm font-bold text-slate-600">
                  <span>Ödenen</span>
                  <span>{formatTry(bill.paidAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between text-base font-black text-slate-950">
                  <span>Kalan</span>
                  <span data-testid="qr-bill-remaining">{formatTry(bill.remainingAmount)}</span>
                </div>
              </div>
            </>
          )}

          <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4" data-testid="qr-online-pay-soon">
            <p className="text-sm font-black text-amber-900">Online ödeme yakında</p>
            <p className="mt-1 text-xs font-semibold text-amber-800">
              Bu ekrandan kart ile ödeme başlatılmıyor. Garsona ödeme yapabilir veya ödeme talebi
              gönderebilirsiniz.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Bölüşerek ödeme
            </p>
            <button
              type="button"
              disabled
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-400"
            >
              Tüm hesabı öde (yakında)
            </button>
            <button
              type="button"
              disabled
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-400"
            >
              Kendi ürünlerimi öde (yakında)
            </button>
            <button
              type="button"
              disabled
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-400"
            >
              Tutar girerek öde (yakında)
            </button>
          </div>

          {requestSuccess ? (
            <div
              className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4"
              data-testid="qr-payment-request-success"
            >
              <p className="text-sm font-black text-emerald-900">Ödeme talebi restorana iletildi</p>
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                Garson ödeme için yönlendirilecek.
              </p>
            </div>
          ) : (
            <button
              type="button"
              data-testid="qr-payment-request"
              onClick={() => void requestPayment("full_bill")}
              disabled={requestPending}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#10b981] text-sm font-black text-white disabled:bg-slate-300"
            >
              {requestPending ? "Gönderiliyor..." : "Garsona ödeme talebi gönder"}
            </button>
          )}

          {requestError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
              {requestError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onCallWaiter}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
          >
            Garson çağır
          </button>
        </div>
      ) : null}
    </div>
  );
}
