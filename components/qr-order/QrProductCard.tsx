"use client";

import QrProductMedia from "@/components/qr-order/QrProductMedia";
import { qrAccentAdd, qrCard, qrFocusRing, qrPrice } from "@/components/qr-order/qr-theme";
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
      className={`${qrCard} relative flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(21,34,56,0.1)] active:scale-[0.995] motion-reduce:transform-none`}
    >
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-w-0 flex-1 flex-col text-left ${qrFocusRing}`}
      >
        <div className="relative bg-slate-50 px-3 pt-3">
          {product.isPopular ? (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-[#152238] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
              Popüler
            </span>
          ) : null}
          <QrProductMedia
            name={product.name}
            imageUrl={product.imageUrl}
            className="mx-auto aspect-square h-28 w-28 sm:h-32 sm:w-32"
          />
        </div>
        <div className="flex flex-1 flex-col p-3.5 pb-12 sm:p-4 sm:pb-14">
          <h3 className="line-clamp-2 text-[14px] font-black leading-snug tracking-tight text-slate-950 sm:text-[15px]">
            {product.name}
          </h3>
          {product.description ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
              {product.description}
            </p>
          ) : null}
          <p className={`mt-auto pt-2.5 ${qrPrice}`}>{formatTry(product.price)}</p>
        </div>
      </button>
      <button
        type="button"
        data-testid={`qr-quick-add-${product.id}`}
        onClick={onQuickAdd}
        aria-label={`${product.name} sepete ekle`}
        className={`${qrAccentAdd} absolute bottom-3.5 right-3.5 sm:bottom-4 sm:right-4`}
      >
        +
      </button>
    </article>
  );
}
