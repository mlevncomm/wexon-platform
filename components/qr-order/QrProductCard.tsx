"use client";

import QrProductMedia from "@/components/qr-order/QrProductMedia";
import { qrCard } from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import type { QrProduct } from "@/lib/qr-order/types";

const BADGE_LABEL: Record<string, string> = {
  popular: "Popüler",
  spicy: "Acılı",
  vegetarian: "Vejetaryen",
  new: "Yeni",
};

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
      className={`${qrCard} relative flex h-full gap-3.5 p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(15,23,42,0.1)] active:scale-[0.995] sm:gap-4 sm:p-4`}
    >
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex gap-3.5 sm:gap-4">
          <QrProductMedia
            name={product.name}
            imageUrl={product.imageUrl}
            className="h-[5.25rem] w-[5.25rem] sm:h-28 sm:w-28"
          />
          <div className="min-w-0 flex-1 pb-1 pr-10 sm:pr-12">
            {(product.badges ?? []).length > 0 ? (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {(product.badges ?? []).map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/60"
                  >
                    {BADGE_LABEL[badge] ?? badge}
                  </span>
                ))}
              </div>
            ) : null}
            <h3 className="break-words text-[15px] font-black leading-snug tracking-tight text-slate-950 sm:text-base">
              {product.name}
            </h3>
            {product.description ? (
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500 sm:text-[13px]">
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
        className="absolute bottom-3.5 right-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#10b981] text-xl font-black text-white shadow-[0_10px_22px_rgba(16,185,129,0.4)] transition hover:bg-emerald-600 hover:shadow-lg active:scale-95 sm:bottom-4 sm:right-4 sm:h-12 sm:w-12"
      >
        +
      </button>
    </article>
  );
}
