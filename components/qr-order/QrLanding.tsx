"use client";

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
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-8 pt-6">
      <header className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">WexPay · QR</p>
        <h1 className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950">
          {context.restaurantName}
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {context.branchName} · {context.tableLabel}
        </p>
        <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
          Masa oturumunuz hazır
        </p>
        <p className="mt-3 text-[11px] font-semibold text-slate-400">TR / EN yakında</p>
      </header>

      <section className="mt-8 flex-1 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <h2 className="text-xl font-black leading-snug tracking-tight text-slate-950">
          Masadan hızlıca sipariş ver veya ödeme yap
        </h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">
          Siparişiniz doğrudan restoran ekranına düşer. Ödeme yapmak isterseniz masa hesabınızı
          görüntüleyebilirsiniz.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            data-testid="qr-cta-order"
            onClick={onOrder}
            disabled={menuEmpty}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#10b981] px-5 text-base font-black text-white shadow-sm shadow-emerald-500/25 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Sipariş vermek istiyorum
          </button>
          <button
            type="button"
            data-testid="qr-cta-pay"
            onClick={onPay}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base font-black text-slate-900"
          >
            Ödeme yapmak istiyorum
          </button>
        </div>

        {menuEmpty ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            Menü şu anda boş. Personelden yardım isteyebilirsiniz.
          </p>
        ) : null}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <button
          type="button"
          data-testid="qr-cta-waiter"
          onClick={onCallWaiter}
          className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
        >
          Garson çağır
        </button>
        <button
          type="button"
          data-testid="qr-cta-browse"
          onClick={onBrowseMenu}
          disabled={menuEmpty}
          className="flex min-h-12 items-center justify-center rounded-2xl border border-transparent text-sm font-bold text-slate-500 disabled:opacity-40"
        >
          Menüyü sadece görüntüle
        </button>
        <p className="px-2 text-center text-xs font-medium text-slate-400">
          Yardım için personelinize danışın veya garson çağırın.
        </p>
      </div>
    </div>
  );
}
