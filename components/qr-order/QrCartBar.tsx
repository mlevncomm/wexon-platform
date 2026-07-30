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
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-3 sm:px-4">
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 rounded-[22px] border border-white/80 bg-[#152238] p-2.5 pl-4 shadow-[0_18px_50px_rgba(21,34,56,0.35)] sm:rounded-[24px] sm:p-3 sm:pl-5">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">Sepetim</p>
          <p className="truncate text-sm font-black text-white sm:text-base">
            {itemCount} ürün · {formatTry(subtotal)}
          </p>
        </div>
        <button
          type="button"
          data-testid="qr-cart-continue"
          onClick={onContinue}
          className={`${qrPrimaryCta} !min-h-11 w-auto shrink-0 !rounded-2xl !bg-[#F97316] !shadow-[0_10px_22px_rgba(249,115,22,0.4)] px-5 hover:!bg-[#EA580C] sm:!min-h-12 sm:px-6`}
        >
          Sepeti Gör
        </button>
      </div>
    </div>
  );
}
