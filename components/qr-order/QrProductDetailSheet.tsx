"use client";

import { useState } from "react";
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
    <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-[28px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="qr-product-detail-title" className="text-xl font-black text-slate-950">
            {product.name}
          </h2>
          <p className="mt-1 text-sm font-black text-slate-950">{formatTry(product.price)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
          aria-label="Kapat"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 h-40 overflow-hidden rounded-[22px] bg-gradient-to-br from-emerald-100 via-slate-100 to-slate-200">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      {product.description ? (
        <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-500">{product.description}</p>
      ) : null}
      <p className="mt-2 text-xs font-medium text-slate-400">Alerjen bilgisi için personelinize sorun.</p>

      {groups.map((group) => (
        <div key={group.id} className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
            {group.label}
            {group.required ? " · zorunlu" : ""}
          </p>
          <div className="mt-2 space-y-2">
            {group.choices.map((choice) => {
              const selected = (selectedOptions[group.id] ?? []).includes(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  data-testid={`qr-option-${group.id}-${choice.id}`}
                  onClick={() => toggleChoice(group, choice.id)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-bold ${
                    selected
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-800"
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

      <label className="mt-5 block">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Ürün notu</span>
        <textarea
          data-testid="qr-product-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Örn. Soğansız olsun"
          className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
        />
      </label>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-lg font-black"
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
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-lg font-black"
            aria-label="Adet arttır"
          >
            +
          </button>
        </div>
        <p className="text-sm font-bold text-slate-500">
          Satır: {formatTry(lineTotal({ key: "", product, quantity, selectedOptions, note }, groups))}
        </p>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        data-testid="qr-add-to-cart"
        onClick={submit}
        className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#10b981] px-4 text-sm font-black text-white"
      >
        Sepete ekle — {formatTry(total)}
      </button>
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4"
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
