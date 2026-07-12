"use client";

import QrStatusBadge from "@/components/qr-order/QrStatusBadge";
import { qrCard, qrFrame, qrGhostCta, qrGlass, qrPrimaryCta } from "@/components/qr-order/qr-theme";
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
    <div className={`relative flex min-h-[100dvh] flex-col overflow-hidden pb-10 pt-6 sm:pt-10 ${qrFrame}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-8 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl md:h-64 md:w-64"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-40 h-40 w-40 rounded-full bg-lime-200/35 blur-3xl md:top-24 md:h-56 md:w-56"
      />

      <header className="relative z-10 text-center md:mx-auto md:max-w-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700/90 sm:text-[11px]">
          WexPay · Masa siparişi
        </p>
        <h1 className="mt-3 break-words text-[1.75rem] font-black leading-tight tracking-[-0.03em] text-slate-950 sm:text-4xl md:text-5xl">
          {context.restaurantName}
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-500 sm:text-base">
          {context.branchName} · <span className="text-slate-800">{context.tableLabel}</span>
        </p>
        <div className="mt-4 flex justify-center">
          <QrStatusBadge tone="mint">Masa oturumunuz hazır</QrStatusBadge>
        </div>
      </header>

      <section
        className={`relative z-10 mt-7 sm:mt-10 ${qrGlass} rounded-[28px] p-5 sm:rounded-[36px] sm:p-8 md:mx-auto md:max-w-3xl md:p-10`}
      >
        <div className="md:grid md:grid-cols-[1.15fr_1fr] md:items-end md:gap-10">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Hoş geldiniz
            </p>
            <h2 className="mt-3 text-[1.4rem] font-black leading-snug tracking-[-0.03em] text-slate-950 sm:text-3xl md:text-[2rem]">
              Masadan hızlıca sipariş ver veya hesabını görüntüle
            </h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-slate-500 sm:text-[15px]">
              Siparişiniz doğrudan restoran ekranına düşer. Ödeme veya yardım talepleriniz masanıza
              bağlı iletilir.
            </p>
          </div>

          <div className="mt-6 space-y-3 md:mt-0">
            <button
              type="button"
              data-testid="qr-cta-order"
              onClick={onOrder}
              disabled={menuEmpty}
              className={`${qrPrimaryCta} flex-col gap-1 !items-stretch !justify-start px-5 py-4 text-left sm:py-5`}
            >
              <span className="text-[15px] font-black leading-none sm:text-base">
                Sipariş vermek istiyorum
              </span>
              <span className="text-xs font-semibold text-emerald-50/95 sm:text-[13px]">
                Menüyü aç, sepete ekle, masaya sipariş gönder
              </span>
            </button>

            <button
              type="button"
              data-testid="qr-cta-pay"
              onClick={onPay}
              className={`${qrCard} flex min-h-14 w-full flex-col items-stretch gap-1 rounded-[20px] px-5 py-4 text-left transition hover:border-emerald-200 hover:shadow-md active:scale-[0.98] sm:rounded-[22px] sm:py-5`}
            >
              <span className="text-[15px] font-black leading-none text-slate-950 sm:text-base">
                Ödeme yapmak istiyorum
              </span>
              <span className="text-xs font-semibold text-slate-500 sm:text-[13px]">
                Masa hesabını görüntüle veya ödeme talebi gönder
              </span>
            </button>
          </div>
        </div>

        {menuEmpty ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200/80">
            Menü şu anda boş. Personelden yardım isteyebilirsiniz.
          </p>
        ) : null}
      </section>

      <div className="relative z-10 mt-5 grid grid-cols-3 gap-2 sm:mx-auto sm:mt-6 sm:max-w-xl sm:gap-3 md:max-w-2xl">
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

      <p className="relative z-10 mt-auto pt-8 text-center text-[11px] font-semibold text-slate-400 sm:pt-12">
        Powered by Wexon · WexPay
      </p>
    </div>
  );
}
