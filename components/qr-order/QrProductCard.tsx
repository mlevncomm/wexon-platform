"use client";

import QrProductMedia from "@/components/qr-order/QrProductMedia";
import { qrCard } from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import type { QrProduct } from "@/lib/qr-order/types";

export default function QrProductCard({
  product,
  onOpen,
  onQuickAdd,
}: {
  product: QrProduct;
  onOpen: () => void;
  onQuickAdd: () => void;
}) {
  return (
    <article
      className={`${qrCard} relative flex h-full gap-3.5 p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(15,23,42,0.1)] active:scale-[0.995] motion-reduce:transform-none sm:gap-4 sm:p-4`}
    >
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
        <div className="flex gap-3.5 sm:gap-4">
          <QrProductMedia
            name={product.name}
            imageUrl={product.imageUrl}
            className="aspect-square h-[5.25rem] w-[5.25rem] sm:h-28 sm:w-28"
          />
          <div className="min-w-0 flex-1 pb-1 pr-10 sm:pr-12">
            {product.isPopular ? (
              <span className="mb-1.5 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/60">
                Öne çıkan
              </span>
            ) : null}
            <h3 className="break-words text-[15px] font-black leading-snug tracking-tight text-slate-950 sm:text-base">
              {product.name}
            </h3>
            {product.description ? (
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500 sm:line-clamp-3 sm:text-[13px]">
                {product.description}
              </p>
            ) : null}
            <p className="mt-2.5 text-[15px] font-black tabular-nums text-slate-950 sm:text-base">
              {formatTry(product.price)}
            </p>
          </div>
        </div>
      </button>
      <button
        type="button"
        data-testid={`qr-quick-add-${product.id}`}
        onClick={onQuickAdd}
        aria-label={`${product.name} sepete ekle`}
        className="absolute bottom-3.5 right-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#0f9f6e] text-xl font-black text-white shadow-[0_10px_22px_rgba(15,159,110,0.4)] transition hover:bg-emerald-700 active:scale-95 motion-reduce:active:scale-100 sm:bottom-4 sm:right-4 sm:h-12 sm:w-12"
      >
        +
      </button>
    </article>
  );
}
