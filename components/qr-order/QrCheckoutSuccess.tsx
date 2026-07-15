"use client";

import { qrCard, qrGhostCta, qrGlass, qrPrimaryCta, qrFrameNarrow } from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import { orderStatusLabel, type QrOrderSuccess, type QrTableContext } from "@/lib/qr-order/types";

export default function QrCheckoutSuccess({
  context,
  order,
  onTrack,
  onNewOrder,
  onCallWaiter,
}: {
  context: QrTableContext;
  order: QrOrderSuccess;
  onTrack: () => void;
  onNewOrder: () => void;
  onCallWaiter: () => void;
}) {
  return (
    <div className={`${qrFrameNarrow} flex min-h-[100dvh] flex-col pb-10 pt-8`}>
      <div className={`${qrGlass} rounded-[32px] p-7 text-center`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-600 text-3xl font-black text-white">
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
        <p className="mt-3 text-sm font-bold text-emerald-900" data-testid="qr-order-status">
          Durum: {orderStatusLabel(order.status)}
        </p>
      </div>

      <div className={`${qrCard} mt-6 p-5`}>
        <p className="text-sm font-semibold leading-relaxed text-slate-600">
          Bu masadan verdiğiniz her yeni sipariş ayrı olarak mutfağa iletilir. Mevcut siparişe ürün
          eklenmez.
        </p>
      </div>

      <div className="mt-auto space-y-2 pt-8">
        <button type="button" data-testid="qr-track-order" onClick={onTrack} className={qrPrimaryCta}>
          Siparişi Takip Et
        </button>
        <button type="button" data-testid="qr-new-order" onClick={onNewOrder} className={qrGhostCta}>
          Yeni Sipariş Ver
        </button>
        <button type="button" onClick={onCallWaiter} className={qrGhostCta}>
          Garson çağır
        </button>
      </div>
    </div>
  );
}
