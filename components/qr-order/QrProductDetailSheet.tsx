"use client";

import { useState } from "react";
import QrProductMedia from "@/components/qr-order/QrProductMedia";
import { qrPrimaryCta } from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import { defaultSelectedOptions } from "@/lib/qr-order/mock-options";
import {
  buildCartLineKey,
  lineTotal,
  optionDeltaTotal,
  validateRequiredOptions,
} from "@/lib/qr-order/pricing";
import type { QrCartLine, QrOptionGroup, QrProduct } from "@/lib/qr-order/types";

function ProductDetailForm({
  product,
  groups,
  onClose,
  onAdd,
}: {
  product: QrProduct;
  groups: QrOptionGroup[];
  onClose: () => void;
  onAdd: (line: QrCartLine) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedOptions, setSelectedOptions] = useState(() => defaultSelectedOptions(groups));
  const [error, setError] = useState<string | null>(null);

  const delta = optionDeltaTotal(selectedOptions, groups);
  const total = (product.price + delta) * quantity;

  function toggleChoice(group: QrOptionGroup, choiceId: string) {
    setSelectedOptions((current) => {
      const existing = current[group.id] ?? [];
      if (group.multi) {
        const next = existing.includes(choiceId)
          ? existing.filter((id) => id !== choiceId)
          : [...existing, choiceId];
        return { ...current, [group.id]: next };
      }
      return { ...current, [group.id]: [choiceId] };
    });
  }

  function submit() {
    const validationError = validateRequiredOptions(selectedOptions, groups);
    if (validationError) {
      setError(validationError);
      return;
    }
    onAdd({
      key: buildCartLineKey(product.id, selectedOptions, note),
      product,
      quantity,
      selectedOptions,
      note: note.trim(),
    });
    onClose();
  }

  return (
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[32px] border border-white/70 bg-white shadow-2xl sm:max-w-xl sm:rounded-[32px] md:max-w-2xl">
      <div className="relative shrink-0">
        <QrProductMedia
          name={product.name}
          imageUrl={product.imageUrl}
          className="h-44 w-full rounded-none sm:h-56 sm:rounded-t-[32px] md:h-64"
          large
        />
        <button
          type="button"
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
        <p className="mt-1 text-lg font-black tabular-nums text-emerald-700">
          {formatTry(product.price)}
        </p>
        {product.description ? (
          <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">{product.description}</p>
        ) : null}
        <p className="mt-2 text-xs font-medium text-slate-400">Alerjen bilgisi için personelinize sorun.</p>

        {groups.map((group) => (
          <div key={group.id} className="mt-6">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              {group.label}
              {group.required ? " · zorunlu" : ""}
            </p>
            <div className="mt-2.5 space-y-2">
              {group.choices.map((choice) => {
                const selected = (selectedOptions[group.id] ?? []).includes(choice.id);
                return (
                  <button
                    key={choice.id}
                    type="button"
                    data-testid={`qr-option-${group.id}-${choice.id}`}
                    onClick={() => toggleChoice(group, choice.id)}
                    className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-bold transition ${
                      selected
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm shadow-emerald-500/10"
                        : "border-slate-200/90 bg-slate-50/80 text-slate-800"
                    }`}
                  >
                    <span>{choice.label}</span>
                    {choice.priceDelta ? <span>+{formatTry(choice.priceDelta)}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <label className="mt-6 block">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Ürün notu
          </span>
          <textarea
            data-testid="qr-product-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Örn. Soğansız olsun"
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />
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
            <span data-testid="qr-product-qty" className="w-8 text-center text-base font-black">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((value) => value + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-black shadow-sm"
              aria-label="Adet arttır"
            >
              +
            </button>
          </div>
          <p className="text-sm font-bold text-slate-500">
            Satır:{" "}
            {formatTry(lineTotal({ key: "", product, quantity, selectedOptions, note }, groups))}
          </p>
        </div>

        {error ? (
          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        ) : null}
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
  groups,
  open,
  onClose,
  onAdd,
}: {
  product: QrProduct | null;
  groups: QrOptionGroup[];
  open: boolean;
  onClose: () => void;
  onAdd: (line: QrCartLine) => void;
}) {
  if (!open || !product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-product-detail-title"
    >
      <ProductDetailForm
        key={product.id}
        product={product}
        groups={groups}
        onClose={onClose}
        onAdd={onAdd}
      />
    </div>
  );
}
