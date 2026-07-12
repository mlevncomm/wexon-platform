"use client";

import { useState } from "react";
import { WAITER_REASON_LABELS, type WaiterReason } from "@/lib/qr-order/types";

const REASONS = Object.keys(WAITER_REASON_LABELS) as WaiterReason[];

export default function QrWaiterCall({
  qrCode,
  open,
  onClose,
}: {
  qrCode: string;
  open: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<WaiterReason>("order_help");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  async function submit() {
    if (pending) return;
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
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="qr-waiter-title">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl">
        {success ? (
          <div className="text-center">
            <p id="qr-waiter-title" className="text-lg font-black text-slate-950">
              Garson çağrıldı
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Personel en kısa sürede masanıza gelecek.
            </p>
            <button
              type="button"
              data-testid="qr-waiter-success-close"
              onClick={() => {
                setSuccess(false);
                setNote("");
                onClose();
              }}
              className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#10b981] px-4 text-sm font-black text-white"
            >
              Tamam
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p id="qr-waiter-title" className="text-lg font-black text-slate-950">
                  Garson çağır
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Nasıl yardımcı olalım?</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
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
                  className={`flex min-h-12 w-full items-center rounded-2xl border px-4 text-left text-sm font-bold ${
                    reason === item
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  {WAITER_REASON_LABELS[item]}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Not (opsiyonel)</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            {error ? (
              <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="qr-waiter-submit"
              onClick={() => void submit()}
              disabled={pending}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#10b981] px-4 text-sm font-black text-white disabled:bg-slate-300"
            >
              {pending ? "Gönderiliyor..." : "Garsonu çağır"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
