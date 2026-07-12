"use client";

import QrStatusBadge from "@/components/qr-order/QrStatusBadge";
import { qrCard, qrGhostCta, qrGlass, qrPrimaryCta } from "@/components/qr-order/qr-theme";
import type { QrTableContext } from "@/lib/qr-order/types";

export default function QrLanding({
  context,
  menuEmpty,
  onOrder,
  onPay,
  onBrowseMenu,
  onCallWaiter,
}: {
  context: QrTableContext;
  menuEmpty: boolean;
  onOrder: () => void;
  onPay: () => void;
  onBrowseMenu: () => void;
  onCallWaiter: () => void;
}) {
  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col overflow-hidden px-4 pb-10 pt-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-8 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-40 h-40 w-40 rounded-full bg-lime-200/35 blur-3xl"
      />

      <header className="relative z-10 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700/90">
          WexPay · Masa siparişi
        </p>
        <h1 className="mt-3 break-words text-[1.75rem] font-black leading-tight tracking-[-0.03em] text-slate-950">
          {context.restaurantName}
        </h1>
        <p className="mt-1.5 text-sm font-semibold text-slate-500">
          {context.branchName} · <span className="text-slate-800">{context.tableLabel}</span>
        </p>
        <div className="mt-4 flex justify-center">
          <QrStatusBadge tone="mint">Masa oturumunuz hazır</QrStatusBadge>
        </div>
      </header>

      <section className={`relative z-10 mt-8 ${qrGlass} rounded-[32px] p-5 sm:p-6`}>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
          Hoş geldiniz
        </p>
        <h2 className="mt-3 text-[1.45rem] font-black leading-snug tracking-[-0.03em] text-slate-950">
          Masadan hızlıca sipariş ver veya hesabını görüntüle
        </h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">
          Siparişiniz doğrudan restoran ekranına düşer. Ödeme veya yardım talepleriniz masanıza bağlı
          iletilir.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            data-testid="qr-cta-order"
            onClick={onOrder}
            disabled={menuEmpty}
            className={`${qrPrimaryCta} flex-col gap-1 !items-stretch !justify-start px-5 py-4 text-left`}
          >
            <span className="text-[15px] font-black leading-none">Sipariş vermek istiyorum</span>
            <span className="text-xs font-semibold text-emerald-50/95">
              Menüyü aç, sepete ekle, masaya sipariş gönder
            </span>
          </button>

          <button
            type="button"
            data-testid="qr-cta-pay"
            onClick={onPay}
            className={`${qrCard} flex min-h-14 w-full flex-col items-stretch gap-1 rounded-[22px] px-5 py-4 text-left transition active:scale-[0.98]`}
          >
            <span className="text-[15px] font-black leading-none text-slate-950">
              Ödeme yapmak istiyorum
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Masa hesabını görüntüle veya ödeme talebi gönder
            </span>
          </button>
        </div>

        {menuEmpty ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200/80">
            Menü şu anda boş. Personelden yardım isteyebilirsiniz.
          </p>
        ) : null}
      </section>

      <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
        <button type="button" data-testid="qr-cta-waiter" onClick={onCallWaiter} className={qrGhostCta}>
          Garson çağır
        </button>
        <button
          type="button"
          data-testid="qr-cta-browse"
          onClick={onBrowseMenu}
          disabled={menuEmpty}
          className={`${qrGhostCta} disabled:opacity-40`}
        >
          Menüyü gör
        </button>
        <button type="button" onClick={onCallWaiter} className={qrGhostCta}>
          Yardım
        </button>
      </div>

      <p className="relative z-10 mt-auto pt-8 text-center text-[11px] font-semibold text-slate-400">
        Powered by Wexon · WexPay
      </p>
    </div>
  );
}
