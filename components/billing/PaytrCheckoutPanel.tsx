"use client";

import { useEffect, useState, useTransition } from "react";

type Props = {
  planId: string;
  organizationId: string;
  billingInterval: "monthly" | "yearly";
  planLabel: string;
  totalLabel: string;
};

type TokenResponse = {
  iframeToken?: string;
  iframeUrl?: string;
  paymentId?: string;
  merchantOid?: string;
  message?: string;
  error?: string;
};

type StatusResponse = {
  status?: string;
  subscriptionStatus?: string | null;
  paidAt?: string | null;
};

export default function PaytrCheckoutPanel({
  planId,
  organizationId,
  billingInterval,
  planLabel,
  totalLabel,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/billing/paytr/payments/${paymentId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;
        if (data.status) setStatus(data.status);
      } catch {
        // ignore transient poll errors
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [paymentId]);

  function startPaytr() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/paytr/iframe-token", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            organizationId,
            billingInterval,
            // Deliberately send a wrong amount — server must ignore it.
            amount: 1,
          }),
        });
        const data = (await res.json()) as TokenResponse;
        if (!res.ok) {
          setError(data.message || data.error || "PayTR oturumu açılamadı.");
          return;
        }
        if (!data.iframeUrl || !data.paymentId) {
          setError("PayTR token yanıtı eksik.");
          return;
        }
        setIframeUrl(data.iframeUrl);
        setPaymentId(data.paymentId);
        setStatus("PENDING_CALLBACK");
      } catch {
        setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      }
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">
        <p className="font-black">Güvenli ödeme PayTR ile yapılır</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
          {planLabel} · {totalLabel}. Kart bilgileri Wexon’da saklanmaz. Abonelik aktivasyonu yalnızca PayTR
          bildirim URL doğrulamasından sonra yapılır.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      {status === "PAID" ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Ödeme doğrulandı. Aboneliğiniz aktif. Dashboard’a gidebilirsiniz.
        </div>
      ) : null}

      {status === "FAILED" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          Ödeme başarısız. Tekrar deneyebilirsiniz.
        </div>
      ) : null}

      {status === "PENDING_CALLBACK" && iframeUrl ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          Ödeme sonucu doğrulanıyor… Callback sonrası abonelik otomatik aktifleşir.
        </div>
      ) : null}

      {!iframeUrl ? (
        <button
          type="button"
          onClick={startPaytr}
          disabled={pending}
          className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "PayTR oturumu açılıyor…" : `${totalLabel} — PayTR ile öde`}
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <iframe
            title="PayTR güvenli ödeme"
            src={iframeUrl}
            className="h-[520px] w-full bg-white"
            allow="payment *"
          />
        </div>
      )}
    </div>
  );
}
