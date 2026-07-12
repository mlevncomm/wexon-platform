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
      className={`${qrCard} relative flex gap-3.5 p-3.5 transition active:scale-[0.995]`}
    >
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex gap-3.5">
          <QrProductMedia name={product.name} imageUrl={product.imageUrl} className="h-[5.5rem] w-[5.5rem]" />
          <div className="min-w-0 flex-1 pb-1 pr-10">
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
            <h3 className="break-words text-[15px] font-black leading-snug tracking-tight text-slate-950">
              {product.name}
            </h3>
            {product.description ? (
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                {product.description}
              </p>
            ) : null}
            <p className="mt-2.5 text-[15px] font-black tabular-nums text-slate-950">
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
        className="absolute bottom-3.5 right-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#10b981] text-xl font-black text-white shadow-[0_10px_22px_rgba(16,185,129,0.4)] transition active:scale-95"
      >
        +
      </button>
    </article>
  );
}
