"use client";

import { useId, useRef, useState } from "react";
import QrModalShell from "@/components/qr-order/QrModalShell";
import QrProductMedia from "@/components/qr-order/QrProductMedia";
import { qrPrimaryCta } from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import { buildCartLineKey, lineTotal } from "@/lib/qr-order/pricing";
import type { QrCartLine, QrProduct } from "@/lib/qr-order/types";

function ProductDetailForm({
  product,
  onClose,
  onAdd,
}: {
  product: QrProduct;
  onClose: () => void;
  onAdd: (line: QrCartLine) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const noteId = useId();
  const addLock = useRef(false);

  const total = product.price * quantity;

  function submit() {
    if (addLock.current) return;
    addLock.current = true;
    onAdd({
      key: buildCartLineKey(product.id, note),
      product,
      quantity,
      note: note.trim(),
    });
    onClose();
    window.setTimeout(() => {
      addLock.current = false;
    }, 400);
  }

  return (
    <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[32px] border border-white/70 bg-white shadow-2xl sm:max-w-xl sm:rounded-[32px] md:max-w-2xl">
      <div className="relative shrink-0">
        <QrProductMedia
          name={product.name}
          imageUrl={product.imageUrl}
          className="aspect-[16/10] h-auto w-full rounded-none sm:rounded-t-[32px]"
          large
        />
        <button
          type="button"
          data-qr-modal-close
          onClick={onClose}
          className="absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/70 bg-white/85 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-sm"
          aria-label="Kapat"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-5">
        <h2 id="qr-product-detail-title" className="text-2xl font-black tracking-tight text-slate-950">
          {product.name}
        </h2>
        <p className="mt-1 text-lg font-black tabular-nums text-emerald-800" data-testid="qr-product-price">
          {formatTry(product.price)}
        </p>
        {product.description ? (
          <p className="mt-3 line-clamp-3 text-sm font-semibold leading-relaxed text-slate-500">
            {product.description}
          </p>
        ) : null}

        <label className="mt-6 block" htmlFor={noteId}>
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Sipariş notu
          </span>
          <textarea
            id={noteId}
            data-testid="qr-product-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Örn. Soğansız olsun"
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus-visible:border-emerald-300 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-emerald-100"
          />
          <span className="mt-1 block text-[11px] font-medium text-slate-400">
            Notlar personele iletilir; ekstra ürün veya ücret garantisi yoktur.
          </span>
        </label>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-black shadow-sm"
              aria-label="Adet azalt"
            >
              -
            </button>
            <span data-testid="qr-product-qty" className="w-8 text-center text-base font-black" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(99, value + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-black shadow-sm"
              aria-label="Adet arttır"
            >
              +
            </button>
          </div>
          <p className="text-sm font-bold text-slate-500">
            Satır: {formatTry(lineTotal({ key: "", product, quantity, note }))}
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-sm">
        <button type="button" data-testid="qr-add-to-cart" onClick={submit} className={qrPrimaryCta}>
          Sepete ekle — {formatTry(total)}
        </button>
      </div>
    </div>
  );
}

export default function QrProductDetailSheet({
  product,
  open,
  onClose,
  onAdd,
}: {
  product: QrProduct | null;
  open: boolean;
  onClose: () => void;
  onAdd: (line: QrCartLine) => void;
}) {
  return (
    <QrModalShell open={open && Boolean(product)} titleId="qr-product-detail-title" onClose={onClose}>
      {product ? (
        <ProductDetailForm key={product.id} product={product} onClose={onClose} onAdd={onAdd} />
      ) : null}
    </QrModalShell>
  );
}
