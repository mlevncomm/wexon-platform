"use client";

import { qrCard, qrGhostCta, qrGlass, qrPrimaryCta } from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import type { QrOrderSuccess, QrTableContext } from "@/lib/qr-order/types";

const STEPS = ["Sipariş alındı", "Hazırlanıyor", "Servise hazır", "Masaya geliyor"] as const;

export default function QrCheckoutSuccess({
  context,
  order,
  onBackHome,
  onCallWaiter,
  onViewBill,
}: {
  context: QrTableContext;
  order: QrOrderSuccess;
  onBackHome: () => void;
  onCallWaiter: () => void;
  onViewBill?: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-10 pt-8">
      <div className={`${qrGlass} rounded-[32px] p-7 text-center`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-500 text-3xl font-black text-white shadow-[0_12px_28px_rgba(16,185,129,0.4)]">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950" data-testid="qr-order-success">
          Siparişiniz alındı
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          <span className="font-black text-slate-900">{order.orderNo}</span>
          {" · "}
          {context.tableLabel}
          {" · "}
          {formatTry(order.subtotal)}
        </p>
      </div>

      <ol className="mt-6 space-y-2.5">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={`${qrCard} flex items-center gap-3 px-4 py-3.5 text-sm font-bold ${
              index === 0 ? "ring-2 ring-emerald-300/80" : "text-slate-500"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                index === 0 ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-3 px-1 text-xs font-medium text-slate-400">
        Durum zaman çizelgesi bilgilendirme amaçlıdır; canlı takip yakında.
      </p>

      <div className="mt-auto space-y-2 pt-8">
        <button type="button" data-testid="qr-success-home" onClick={onBackHome} className={qrPrimaryCta}>
          Menüye dön
        </button>
        {onViewBill ? (
          <button type="button" onClick={onViewBill} className={qrGhostCta}>
            Hesabı görüntüle
          </button>
        ) : null}
        <button type="button" onClick={onCallWaiter} className={qrGhostCta}>
          Garson çağır
        </button>
      </div>
    </div>
  );
}
