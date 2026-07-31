"use client";

import { useId } from "react";
import QrEmptyState from "@/components/qr-order/ui/QrEmptyState";
import QrProductMedia from "@/components/qr-order/QrProductMedia";
import {
  qrCard,
  qrFrameNarrow,
  qrIconBtn,
  qrPageShellFlush,
  qrPrice,
  qrPrimaryCta,
  qrStickyHeaderBar,
} from "@/components/qr-order/qr-theme";
import { formatTry } from "@/lib/qr-order/format";
import { describeSelectedModifiers } from "@/lib/qr-order/modifiers";
import { cartSubtotal, lineTotal, lineUnitPrice } from "@/lib/qr-order/pricing";
import type { QrCartLine, QrTableContext } from "@/lib/qr-order/types";

export default function QrCartSheet({
  context,
  lines,
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
  generalNote: string;
  error: string | null;
  pending: boolean;
  onGeneralNoteChange: (value: string) => void;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const noteId = useId();
  const errorId = useId();
  const subtotal = cartSubtotal(lines);

  return (
    <div className={`${qrPageShellFlush} items-center`}>
      <div className={`${qrFrameNarrow} ${qrStickyHeaderBar}`}>
        <header className="flex items-center gap-2.5 sm:gap-3">
          <button type="button" onClick={onBack} className={qrIconBtn} aria-label="Geri">
            ←
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Sepet</p>
            <h1 className="truncate text-base font-black tracking-tight text-slate-950 sm:text-xl">
              {context.restaurantName} · {context.tableLabel}
            </h1>
          </div>
        </header>
      </div>

      <div className={`${qrFrameNarrow} w-full pb-10 pt-4`}>
        {lines.length === 0 ? (
          <QrEmptyState
            title="Sepetiniz boş"
            description="Menüden ürün ekleyerek başlayın."
            actionLabel="Menüye dön"
            onAction={onBack}
            testId="qr-cart-empty"
          />
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.key} className={`${qrCard} p-3.5 sm:p-4`}>
                <div className="flex gap-3">
                  <QrProductMedia
                    name={line.product.name}
                    imageUrl={line.product.imageUrl}
                    className="h-16 w-16 shrink-0 rounded-2xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-black text-slate-950">{line.product.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {formatTry(lineUnitPrice(line))} × {line.quantity}
                        </p>
                      </div>
                      <p className={`shrink-0 ${qrPrice}`}>{formatTry(lineTotal(line))}</p>
                    </div>
                    {describeSelectedModifiers(line.product, line.modifierOptionIds ?? []).map((row) => (
                      <p
                        key={`${line.key}-${row.groupName}-${row.optionName}`}
                        className="mt-1 text-xs font-medium text-slate-500"
                        data-testid="qr-cart-modifier"
                      >
                        {row.groupName}: {row.optionName}
                        {row.priceDelta !== 0
                          ? ` (${row.priceDelta > 0 ? "+" : ""}${formatTry(row.priceDelta)})`
                          : ""}
                      </p>
                    ))}
                    {line.note ? (
                      <p className="mt-1 text-xs font-medium text-slate-400">Not: {line.note}</p>
                    ) : null}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-1">
                        <button
                          type="button"
                          onClick={() => onQuantityChange(line.key, line.quantity - 1)}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white font-black shadow-sm"
                          aria-label={`${line.product.name} adet azalt`}
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-black" aria-live="polite">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onQuantityChange(line.key, line.quantity + 1)}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white font-black shadow-sm"
                          aria-label={`${line.product.name} adet arttır`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(line.key)}
                        className="min-h-11 px-2 text-xs font-bold text-rose-600"
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <label className={`${qrCard} block p-4 sm:p-5`} htmlFor={noteId}>
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Sipariş notu
              </span>
              <textarea
                id={noteId}
                data-testid="qr-order-note"
                value={generalNote}
                onChange={(event) => onGeneralNoteChange(event.target.value)}
                rows={3}
                maxLength={500}
                className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold outline-none focus-visible:border-wx-accent/40 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-wx-accent/15"
                aria-describedby={error ? errorId : undefined}
              />
            </label>

            <div className={`${qrCard} p-4 sm:p-5`}>
              <div className="flex items-center justify-between text-sm font-bold text-slate-600">
                <span>Ara toplam</span>
                <span data-testid="qr-cart-subtotal" className="tabular-nums">
                  {formatTry(subtotal)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-lg font-black text-slate-950">
                <span>Toplam</span>
                <span className={`tabular-nums ${qrPrice}`}>{formatTry(subtotal)}</span>
              </div>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-400">
                Gösterilen tutar güncel katalog fiyatıdır. Nihai tutar sunucuda yeniden hesaplanır.
              </p>
            </div>

            {error ? (
              <p
                id={errorId}
                role="alert"
                className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200"
              >
                {error}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="qr-submit-order"
              onClick={onSubmit}
              disabled={pending || lines.length === 0}
              className={qrPrimaryCta}
            >
              {pending ? "Siparişiniz restorana iletiliyor…" : "Siparişi Gönder"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
