"use client";

import { formatTry } from "@/lib/qr-order/format";

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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 p-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Sepetim</p>
          <p className="truncate text-sm font-bold text-slate-700">
            {itemCount} ürün · {formatTry(subtotal)}
          </p>
        </div>
        <button
          type="button"
          data-testid="qr-cart-continue"
          onClick={onContinue}
          className="flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-[#10b981] px-5 text-sm font-black text-white"
        >
          Devam et
        </button>
      </div>
    </div>
  );
}
