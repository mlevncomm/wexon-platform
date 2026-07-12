"use client";

import type { QrOrderSuccess, QrTableContext } from "@/lib/qr-order/types";
import { formatTry } from "@/lib/qr-order/format";

const STEPS = ["Sipariş alındı", "Hazırlanıyor", "Servise hazır", "Masaya getirildi"] as const;

export default function QrCheckoutSuccess({
  context,
  order,
  onBackHome,
  onCallWaiter,
}: {
  context: QrTableContext;
  order: QrOrderSuccess;
  onBackHome: () => void;
  onCallWaiter: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-10 pt-8">
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Başarılı</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950" data-testid="qr-order-success">
          Siparişiniz alındı
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          {order.orderNo} · {context.tableLabel} · {formatTry(order.subtotal)}
        </p>
      </div>

      <ol className="mt-6 space-y-3">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              index === 0
                ? "border-emerald-300 bg-white text-emerald-900"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            {index + 1}. {step}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs font-medium text-slate-400">
        Durum zaman çizelgesi şimdilik bilgilendirme amaçlıdır; canlı takip yakında.
      </p>

      <div className="mt-auto space-y-2 pt-8">
        <button
          type="button"
          data-testid="qr-success-home"
          onClick={onBackHome}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#10b981] text-sm font-black text-white"
        >
          Ana ekrana dön
        </button>
        <button
          type="button"
          onClick={onCallWaiter}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
        >
          Garson çağır
        </button>
      </div>
    </div>
  );
}
