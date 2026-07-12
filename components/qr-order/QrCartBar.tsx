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
    <div className="fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-[24px] border border-white/70 bg-white/80 p-2.5 pl-4 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Sepetim</p>
          <p className="truncate text-sm font-black text-slate-900">
            {itemCount} ürün · {formatTry(subtotal)}
          </p>
        </div>
        <button
          type="button"
          data-testid="qr-cart-continue"
          onClick={onContinue}
          className={`${qrPrimaryCta} !min-h-12 w-auto shrink-0 !rounded-2xl px-5`}
        >
          Sepete git
        </button>
      </div>
    </div>
  );
}
