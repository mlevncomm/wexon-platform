"use client";

import QrStatusBadge from "@/components/qr-order/QrStatusBadge";
import { qrCard, qrFrame, qrGhostCta, qrGlass, qrPrimaryCta, qrSecondaryCta } from "@/components/qr-order/qr-theme";
import type { QrTableContext } from "@/lib/qr-order/types";

export default function QrLanding({
  context,
  menuEmpty,
  onBrowseMenu,
  onPay,
  onCallWaiter,
}: {
  context: QrTableContext;
  menuEmpty: boolean;
  onBrowseMenu: () => void;
  onPay: () => void;
  onCallWaiter: () => void;
}) {
  return (
    <div className={`relative flex min-h-[100dvh] flex-col pb-10 pt-6 sm:pt-10 ${qrFrame}`}>
      <header className="relative z-10 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800/90 sm:text-[11px]">
          WexPay · Masa siparişi
        </p>
        <h1 className="mt-3 break-words text-[1.85rem] font-black leading-tight tracking-[-0.03em] text-slate-950 sm:text-4xl md:text-5xl">
          {context.restaurantName}
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-500 sm:text-base">
          {context.branchName}
          {" · "}
          <span className="text-slate-800">{context.tableLabel}</span>
        </p>
        <div className="mt-4 flex justify-center">
          <QrStatusBadge tone="mint">Masaya hoş geldiniz</QrStatusBadge>
        </div>
      </header>

      <section
        className={`relative z-10 mt-7 sm:mt-10 ${qrGlass} rounded-[28px] p-5 sm:rounded-[36px] sm:p-8 lg:p-10`}
      >
        <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-12">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-800">
              Hoş geldiniz
            </p>
            <h2 className="mt-3 text-[1.4rem] font-black leading-snug tracking-[-0.03em] text-slate-950 sm:text-3xl">
              Menüyü inceleyin, siparişinizi masadan gönderin
            </h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-slate-500 sm:text-[15px]">
              Kayıt olmadan sipariş verebilirsiniz. Siparişiniz restoran ekranına düşer; garson
              çağrısı ve ödeme talebi masanıza bağlı iletilir.
            </p>
          </div>

          <div className="mt-6 space-y-3 lg:mt-0">
            <button
              type="button"
              data-testid="qr-cta-order"
              onClick={onBrowseMenu}
              disabled={menuEmpty}
              className={`${qrPrimaryCta} flex-col gap-1 !items-stretch !justify-start px-5 py-4 text-left sm:py-5`}
            >
              <span className="text-[15px] font-black leading-none sm:text-base">Menüyü İncele</span>
              <span className="text-xs font-semibold text-emerald-50/95 sm:text-[13px]">
                Kategoriler, ürünler ve sepet — tek akışta sipariş
              </span>
            </button>

            <button
              type="button"
              data-testid="qr-cta-pay"
              onClick={onPay}
              className={`${qrSecondaryCta} flex-col gap-1 !items-stretch !justify-start px-5 py-4 text-left`}
            >
              <span className="text-[15px] font-black leading-none text-slate-950 sm:text-base">
                Hesabı Gör / Ödeme Talebi
              </span>
              <span className="text-xs font-semibold text-slate-500 sm:text-[13px]">
                Hesabı görüntüle veya restorana ödeme talebi ilet
              </span>
            </button>

            <button
              type="button"
              data-testid="qr-cta-waiter"
              onClick={onCallWaiter}
              className={`${qrCard} flex min-h-12 w-full items-center justify-center rounded-[20px] px-5 text-sm font-black text-slate-800 transition hover:border-emerald-200`}
            >
              Garson Çağır
            </button>
          </div>
        </div>

        {menuEmpty ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200/80">
            Menü şu anda boş. Personelden yardım isteyebilirsiniz.
          </p>
        ) : null}
      </section>

      <div className="relative z-10 mt-5 flex flex-wrap gap-2 sm:mt-6">
        <button
          type="button"
          data-testid="qr-cta-browse"
          onClick={onBrowseMenu}
          disabled={menuEmpty}
          className={`${qrGhostCta} max-w-xs disabled:opacity-40`}
        >
          Menüyü İncele
        </button>
        <button type="button" onClick={onCallWaiter} className={`${qrGhostCta} max-w-xs`}>
          Garson Çağır
        </button>
        <button type="button" onClick={onPay} className={`${qrGhostCta} max-w-xs`}>
          Hesabı Gör
        </button>
      </div>

      <p className="relative z-10 mt-auto pt-8 text-center text-[11px] font-semibold text-slate-400 sm:pt-12">
        Powered by Wexon · WexPay
      </p>
    </div>
  );
}
