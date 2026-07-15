"use client";

import { useEffect, useId, useRef, useState } from "react";
import QrModalShell from "@/components/qr-order/QrModalShell";
import { qrCard, qrGhostCta, qrPrimaryCta } from "@/components/qr-order/qr-theme";
import { WAITER_REASON_LABELS, type WaiterReason } from "@/lib/qr-order/types";

const REASONS = Object.keys(WAITER_REASON_LABELS) as WaiterReason[];
const COOLDOWN_MS = 20_000;

export default function QrWaiterCall({
  qrCode,
  open,
  onClose,
}: {
  qrCode: string;
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const [reason, setReason] = useState<WaiterReason>("order_help");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const cooldownTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
    };
  }, []);

  async function submit() {
    if (pending || coolingDown) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/wexpay/public/${encodeURIComponent(qrCode)}/call-waiter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note: note.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Garson çağrılamadı. Lütfen tekrar deneyin.");
        return;
      }
      setSuccess(true);
      setCoolingDown(true);
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current);
      cooldownTimer.current = window.setTimeout(() => setCoolingDown(false), COOLDOWN_MS);
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <QrModalShell open={open} titleId={titleId} onClose={onClose}>
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/95 p-5 shadow-2xl backdrop-blur-md sm:max-w-lg sm:p-6">
        {success ? (
          <div className="text-center" data-testid="qr-waiter-success">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">
              ✓
            </div>
            <p id={titleId} className="mt-4 text-xl font-black text-slate-950">
              Garson çağrınız restorana iletildi.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Bu bir bildirimdir. Çağrı kabul veya takip durumu bu ekranda gösterilmez.
            </p>
            <button
              type="button"
              data-testid="qr-waiter-success-close"
              onClick={() => {
                setSuccess(false);
                setNote("");
                onClose();
              }}
              className={`${qrPrimaryCta} mt-6`}
            >
              Tamam
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p id={titleId} className="text-xl font-black text-slate-950">
                  Garson çağır
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Talebiniz restorana iletilir. Durum takibi yoktur.
                </p>
              </div>
              <button
                type="button"
                data-qr-modal-close
                onClick={onClose}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-slate-200 text-sm font-bold text-slate-600"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {REASONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setReason(item)}
                  className={`flex min-h-12 w-full items-center rounded-2xl border px-4 text-left text-sm font-bold transition ${
                    reason === item
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : `${qrCard} !shadow-none text-slate-800`
                  }`}
                >
                  {WAITER_REASON_LABELS[item]}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Not (opsiyonel)
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={200}
                className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus-visible:border-emerald-300 focus-visible:ring-4 focus-visible:ring-emerald-100"
              />
            </label>

            {error ? (
              <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="qr-waiter-submit"
              onClick={() => void submit()}
              disabled={pending || coolingDown}
              className={`${qrPrimaryCta} mt-4`}
            >
              {pending ? "Gönderiliyor…" : coolingDown ? "Lütfen biraz bekleyin…" : "Garsonu çağır"}
            </button>
            <button type="button" onClick={onClose} className={`${qrGhostCta} mt-2`}>
              Vazgeç
            </button>
          </>
        )}
      </div>
    </QrModalShell>
  );
}
