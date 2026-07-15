"use client";

import { useEffect, useId, useRef, useState } from "react";
import QrModalShell from "@/components/qr-order/QrModalShell";
import { qrCard, qrFrameNarrow, qrGhostCta, qrGlassSoft, qrIconBtn, qrPrimaryCta } from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import { orderStatusLabel, type QrBillSnapshot, type QrTableContext } from "@/lib/qr-order/types";

const COOLDOWN_MS = 20_000;

export default function QrBillScreen({
  context,
  onBack,
  onCallWaiter,
  onTrackOrders,
}: {
  context: QrTableContext;
  onBack: () => void;
  onCallWaiter: () => void;
  onTrackOrders?: () => void;
}) {
  const [bill, setBill] = useState<QrBillSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const titleId = useId();
  const inFlight = useRef(false);
  const cooldownTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    inFlight.current = true;
    (async () => {
      try {
        const response = await fetch(`/api/wexpay/public/${encodeURIComponent(context.qrCode)}/bill`);
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          bill?: QrBillSnapshot;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error ?? "Hesap yüklenemedi.");
          return;
        }
        setBill(payload.bill ?? null);
        setError(null);
      } catch {
        if (!cancelled) setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      } finally {
        if (!cancelled) setLoading(false);
        inFlight.current = false;
      }
    })();
    return () => {
      cancelled = true;
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
    };
  }, [context.qrCode]);

  async function requestPayment() {
    if (requestPending || coolingDown) return;
    setRequestPending(true);
    setRequestError(null);
    try {
      const response = await fetch(
        `/api/wexpay/public/${encodeURIComponent(context.qrCode)}/payment-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "full_bill" }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        charged?: boolean;
      };
      if (!response.ok) {
        setRequestError(payload.error ?? "Ödeme talebi gönderilemedi.");
        return;
      }
      setRequestSuccess(true);
      setConfirmOpen(false);
      setCoolingDown(true);
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
      cooldownTimer.current = window.setTimeout(() => setCoolingDown(false), COOLDOWN_MS);
    } catch {
      setRequestError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setRequestPending(false);
    }
  }

  return (
    <div className={`${qrFrameNarrow} min-h-[100dvh] pb-10 pt-4`}>
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className={qrIconBtn} aria-label="Geri">
          ←
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">
            Masa hesabı
          </p>
          <h1 className="truncate text-lg font-black tracking-tight text-slate-950">
            {context.restaurantName} · {context.tableLabel}
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="mt-6 space-y-3" data-testid="qr-bill-loading">
          <div className="h-28 animate-pulse rounded-[28px] bg-white/70 motion-reduce:animate-none" />
          <div className="h-44 animate-pulse rounded-[28px] bg-white/70 motion-reduce:animate-none" />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 rounded-[24px] bg-rose-50 px-4 py-4 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}

      {bill && !loading ? (
        <div className="mt-5 space-y-4" data-testid="qr-bill-screen">
          {bill.empty ? (
            <div className={`${qrCard} p-6 text-center`}>
              <p className="text-base font-black text-slate-900">Açık hesap yok</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Bu masa için henüz ücretlendirilecek sipariş bulunmuyor.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3" data-testid="qr-bill-waves">
                {(() => {
                  const waves = new Map<
                    string,
                    { orderNo: string; status: string; lines: typeof bill.lines; total: number }
                  >();
                  for (const line of bill.lines) {
                    const current = waves.get(line.orderNo);
                    if (current) {
                      current.lines.push(line);
                      current.total += line.lineTotal;
                    } else {
                      waves.set(line.orderNo, {
                        orderNo: line.orderNo,
                        status: line.status,
                        lines: [line],
                        total: line.lineTotal,
                      });
                    }
                  }
                  return [...waves.values()].map((wave, index) => (
                    <div key={wave.orderNo} className={`${qrCard} p-4`} data-testid="qr-bill-wave">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                          Sipariş {index + 1} · {wave.orderNo}
                        </p>
                        <p className="text-xs font-bold text-slate-500">{orderStatusLabel(wave.status)}</p>
                      </div>
                      <ul className="space-y-2">
                        {wave.lines.map((line) => (
                          <li key={line.id} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-950">
                                {line.quantity}× {line.name}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-slate-400">
                                @{formatTry(line.unitPrice)}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-black tabular-nums text-slate-950">
                              {formatTry(line.lineTotal)}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-right text-sm font-black text-slate-950">
                        {formatTry(wave.total)}
                      </p>
                    </div>
                  ));
                })()}
              </div>

              <div className={`${qrGlassSoft} rounded-[28px] p-5`}>
                <div className="flex justify-between text-sm font-bold text-slate-600">
                  <span>Toplam</span>
                  <span className="tabular-nums">{formatTry(bill.totalAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm font-bold text-slate-600">
                  <span>Ödenen</span>
                  <span className="tabular-nums">{formatTry(bill.paidAmount)}</span>
                </div>
                <div className="mt-3 flex justify-between border-t border-emerald-100/80 pt-3 text-lg font-black text-slate-950">
                  <span>Kalan</span>
                  <span data-testid="qr-bill-remaining" className="tabular-nums text-emerald-800">
                    {formatTry(bill.remainingAmount)}
                  </span>
                </div>
              </div>
            </>
          )}

          <div
            className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5"
            data-testid="qr-pay-in-restaurant"
          >
            <p className="text-sm font-black text-slate-950">Ödeme restoranda alınır</p>
            <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-500">
              Bu ekrandan kart veya online tahsilat başlatılmaz. Ödeme talebi yalnızca restorana
              bildirim gönderir; tutar tahsil edilmiş sayılmaz.
            </p>
          </div>

          {requestSuccess ? (
            <div
              className={`${qrCard} border-emerald-200 bg-emerald-50/80 p-5`}
              data-testid="qr-payment-request-success"
            >
              <p className="text-sm font-black text-emerald-950">
                Ödeme talebiniz restorana iletildi.
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                Bu bir tahsilat değildir. Personel masanıza yönlendirilebilir.
              </p>
            </div>
          ) : (
            <button
              type="button"
              data-testid="qr-payment-request"
              onClick={() => setConfirmOpen(true)}
              disabled={requestPending || coolingDown}
              className={qrPrimaryCta}
            >
              {coolingDown ? "Lütfen biraz bekleyin…" : "Ödeme talebi gönder"}
            </button>
          )}

          {requestError ? (
            <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
              {requestError}
            </p>
          ) : null}

          {onTrackOrders ? (
            <button type="button" onClick={onTrackOrders} className={qrGhostCta}>
              Siparişleri takip et
            </button>
          ) : null}

          <button type="button" onClick={onCallWaiter} className={qrGhostCta}>
            Garson çağır
          </button>
        </div>
      ) : null}

      <QrModalShell open={confirmOpen} titleId={titleId} onClose={() => setConfirmOpen(false)}>
        <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-6 shadow-2xl">
          <h2 id={titleId} className="text-xl font-black text-slate-950">
            Ödeme talebi gönderilsin mi?
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Restorana bildirim gider. Karttan veya cüzdandan otomatik tahsilat yapılmaz.
          </p>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              data-testid="qr-payment-request-confirm"
              onClick={() => void requestPayment()}
              disabled={requestPending}
              className={qrPrimaryCta}
            >
              {requestPending ? "Gönderiliyor…" : "Evet, talep gönder"}
            </button>
            <button type="button" data-qr-modal-close onClick={() => setConfirmOpen(false)} className={qrGhostCta}>
              Vazgeç
            </button>
          </div>
        </div>
      </QrModalShell>
    </div>
  );
}
