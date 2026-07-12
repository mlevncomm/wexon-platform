"use client";

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
    <article className="flex gap-3 rounded-[22px] border border-slate-200/80 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex gap-3">
          <div
            className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-100 via-slate-100 to-slate-200"
            aria-hidden="true"
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1">
              {(product.badges ?? []).map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800"
                >
                  {BADGE_LABEL[badge] ?? badge}
                </span>
              ))}
            </div>
            <h3 className="mt-1 break-words text-sm font-black text-slate-950">{product.name}</h3>
            {product.description ? (
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                {product.description}
              </p>
            ) : null}
            <p className="mt-2 text-sm font-black text-slate-950">{formatTry(product.price)}</p>
          </div>
        </div>
      </button>
      <button
        type="button"
        data-testid={`qr-quick-add-${product.id}`}
        onClick={onQuickAdd}
        aria-label={`${product.name} sepete ekle`}
        className="flex h-11 w-11 shrink-0 self-end items-center justify-center rounded-xl bg-[#10b981] text-xl font-black text-white shadow-sm shadow-emerald-500/25"
      >
        +
      </button>
    </article>
  );
}
