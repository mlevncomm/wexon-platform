"use client";

import {
  qrCard,
  qrFocusRing,
  qrFrame,
  qrGhostCta,
  qrPageShellLanding,
} from "@/components/qr-order/qr-theme";
import QrEmptyState from "@/components/qr-order/ui/QrEmptyState";
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
    <div className={`${qrPageShellLanding} items-center`} data-testid="qr-landing-screen">
      <div className={`${qrFrame} flex w-full flex-1 flex-col justify-center py-6 sm:py-10`}>
        <header className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-wx-ink-faint">
            WexPay · Masa siparişi
          </p>
          <h1 className="mt-3 truncate text-2xl font-black tracking-tight text-wx-ink sm:text-3xl">
            {context.restaurantName}
          </h1>
          <p className="mt-1 text-sm font-semibold text-wx-ink-muted">
            <span className="truncate">{context.tableLabel}</span>
            <span className="text-wx-hairline"> · </span>
            <span className="truncate">{context.branchName}</span>
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-wx-ink-muted">
            Masaya hoş geldiniz. Sipariş verin veya hesabınızı görüntüleyin.
          </p>
        </header>

        {menuEmpty ? (
          <div className="mt-8">
            <QrEmptyState
              title="Menü henüz hazır değil"
              description="Personelden yardım isteyebilirsiniz. Hesabınızı görüntüleyebilir veya garson çağırabilirsiniz."
              actionLabel="Hesabı gör"
              onAction={onPay}
            />
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              data-testid="qr-cta-order"
              onClick={onBrowseMenu}
              className={`${qrCard} ${qrFocusRing} flex w-full flex-col items-start gap-1.5 p-5 text-left transition hover:border-emerald-200 hover:shadow-[var(--wx-shadow-lift)] active:scale-[0.99] motion-reduce:active:scale-100 sm:p-6`}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-wx-accent">
                Sipariş
              </span>
              <span className="text-lg font-black tracking-tight text-wx-ink sm:text-xl">
                Sipariş Vermek İstiyorum
              </span>
              <span className="text-sm font-medium leading-relaxed text-wx-ink-muted">
                Menüyü görüntüleyin ve masanızdan sipariş verin.
              </span>
            </button>

            <button
              type="button"
              data-testid="qr-cta-pay"
              onClick={onPay}
              className={`${qrCard} ${qrFocusRing} flex w-full flex-col items-start gap-1.5 p-5 text-left transition hover:border-emerald-200 hover:shadow-[var(--wx-shadow-lift)] active:scale-[0.99] motion-reduce:active:scale-100 sm:p-6`}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-wx-ink-faint">
                Hesap
              </span>
              <span className="text-lg font-black tracking-tight text-wx-ink sm:text-xl">
                Ödeme Yapmak İstiyorum
              </span>
              <span className="text-sm font-medium leading-relaxed text-wx-ink-muted">
                Masa hesabınızı görüntüleyin ve ödeme seçeneklerine ulaşın.
              </span>
            </button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            data-testid="qr-cta-waiter"
            onClick={onCallWaiter}
            className={`${qrGhostCta} text-wx-ink-muted`}
          >
            Garson çağır
          </button>
          <p className="text-center text-[11px] font-semibold text-wx-ink-faint">
            Powered by Wexon · WexPay
          </p>
        </div>
      </div>
    </div>
  );
}
