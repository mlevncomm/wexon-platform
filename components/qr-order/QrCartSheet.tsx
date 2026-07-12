"use client";

import { formatTry } from "@/lib/qr-order/format";
import { describeSelectedOptions, lineTotal } from "@/lib/qr-order/pricing";
import type { QrCartLine, QrOptionGroup, QrTableContext } from "@/lib/qr-order/types";

export default function QrCartSheet({
  context,
  lines,
  groupsByProductId,
  generalNote,
  error,
  pending,
  onGeneralNoteChange,
  onQuantityChange,
  onRemove,
  onBack,
  onSubmit,
}: {
  context: QrTableContext;
  lines: QrCartLine[];
  groupsByProductId: Record<string, QrOptionGroup[]>;
  generalNote: string;
  error: string | null;
  pending: boolean;
  onGeneralNoteChange: (value: string) => void;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const subtotal = lines.reduce(
    (sum, line) => sum + lineTotal(line, groupsByProductId[line.product.id] ?? []),
    0,
  );

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-10 pt-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-bold"
          aria-label="Geri"
        >
          ←
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Sepet</p>
          <h1 className="truncate text-lg font-black text-slate-950">
            {context.restaurantName} · {context.tableLabel}
          </h1>
        </div>
      </header>

      {lines.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-sm font-bold text-slate-600">Sepetiniz boş.</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 min-h-12 rounded-2xl bg-[#10b981] px-5 text-sm font-black text-white"
          >
            Menüye dön
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {lines.map((line) => {
            const groups = groupsByProductId[line.product.id] ?? [];
            const optionText = describeSelectedOptions(line.selectedOptions, groups);
            return (
              <div key={line.key} className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">{line.product.name}</p>
                    {optionText ? (
                      <p className="mt-1 text-xs font-semibold text-slate-500">{optionText}</p>
                    ) : null}
                    {line.note ? (
                      <p className="mt-1 text-xs font-medium text-slate-400">Not: {line.note}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-black text-slate-950">
                    {formatTry(lineTotal(line, groups))}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuantityChange(line.key, line.quantity - 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 font-black"
                      aria-label="Azalt"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-black">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onQuantityChange(line.key, line.quantity + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 font-black"
                      aria-label="Arttır"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(line.key)}
                    className="text-xs font-bold text-rose-600"
                  >
                    Sil
                  </button>
                </div>
              </div>
            );
          })}

          <label className="block rounded-[22px] border border-slate-200 bg-white p-4">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Ek notunuz var mı?
            </span>
            <textarea
              data-testid="qr-order-note"
              value={generalNote}
              onChange={(event) => onGeneralNoteChange(event.target.value)}
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <div className="rounded-[22px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm font-bold text-slate-600">
              <span>Ara toplam</span>
              <span data-testid="qr-cart-subtotal">{formatTry(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-base font-black text-slate-950">
              <span>Toplam</span>
              <span>{formatTry(subtotal)}</span>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-400">
              Sunucu tarafında katalog fiyatı üzerinden yeniden hesaplanır. Mock ekstralar nota yazılır.
            </p>
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            data-testid="qr-submit-order"
            onClick={onSubmit}
            disabled={pending || lines.length === 0}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#10b981] px-4 text-sm font-black text-white disabled:bg-slate-300"
          >
            {pending ? "Siparişiniz restorana iletiliyor..." : "Siparişi gönder"}
          </button>
        </div>
      )}
    </div>
  );
}
