"use client";

import { formatTry } from "@/lib/qr-order/format";
import { qrPrimaryCta } from "@/components/qr-order/qr-theme";

export default function QrCartBar({
  itemCount,
  subtotal,
  onContinue,
}: {
  itemCount: number;
  subtotal: number;
  onContinue: () => void;
}) {
  if (itemCount <= 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 rounded-[24px] border border-white/70 bg-white/85 p-2.5 pl-4 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-md sm:rounded-[28px] sm:p-3 sm:pl-5">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">Sepetim</p>
          <p className="truncate text-sm font-black text-slate-900 sm:text-base">
            {itemCount} ürün · {formatTry(subtotal)}
          </p>
        </div>
        <button
          type="button"
          data-testid="qr-cart-continue"
          onClick={onContinue}
          className={`${qrPrimaryCta} !min-h-11 w-auto shrink-0 !rounded-2xl px-5 sm:!min-h-12 sm:px-6`}
        >
          Sepeti Gör
        </button>
      </div>
    </div>
  );
}
