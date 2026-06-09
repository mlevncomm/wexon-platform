"use client";

import { useMemo, useState } from "react";
import { createOrderAction } from "@/lib/wexpay-actions";

type TableOption = { id: string; label: string };
type ProductOption = { id: string; name: string; price: number; categoryName: string };
type Line = { key: string; productId: string; quantity: number };

function formatTry(value: number) {
  return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
}

export default function WexPayOrderComposer({
  branchId,
  redirectTo,
  tables,
  products,
}: {
  branchId: string;
  redirectTo: string;
  tables: TableOption[];
  products: ProductOption[];
}) {
  const [lines, setLines] = useState<Line[]>([
    { key: crypto.randomUUID(), productId: products[0]?.id ?? "", quantity: 1 },
  ]);

  const priceMap = useMemo(() => new Map(products.map((product) => [product.id, product.price])), [products]);
  const validLines = lines.filter((line) => line.productId && line.quantity > 0);
  const subtotal = validLines.reduce((sum, line) => sum + (priceMap.get(line.productId) ?? 0) * line.quantity, 0);
  const itemsPayload = JSON.stringify(validLines.map((line) => ({ productId: line.productId, quantity: line.quantity })));

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, { key: crypto.randomUUID(), productId: products[0]?.id ?? "", quantity: 1 }]);
  }

  function removeLine(key: string) {
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.key !== key)));
  }

  return (
    <form action={createOrderAction} className="grid min-w-0 gap-4">
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="items" value={itemsPayload} />

      <label className="block min-w-0">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Masa</span>
        <select
          name="tableId"
          required
          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 md:max-w-xs"
        >
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.label}
            </option>
          ))}
        </select>
      </label>

      <div className="min-w-0 space-y-2">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Sipariş kalemleri</span>
        {lines.map((line) => (
          <div
            key={line.key}
            className="grid min-w-0 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:grid-cols-[minmax(0,1fr)_86px_96px_auto] sm:items-center"
          >
            <select
              value={line.productId}
              onChange={(event) => updateLine(line.key, { productId: event.target.value })}
              className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-emerald-400"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {formatTry(product.price)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={999}
              value={line.quantity}
              onChange={(event) => updateLine(line.key, { quantity: Math.max(1, Number(event.target.value) || 1) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-emerald-400"
            />
            <span className="rounded-xl bg-white px-3 py-2 text-right text-sm font-bold text-slate-600 ring-1 ring-slate-200">
              {formatTry((priceMap.get(line.productId) ?? 0) * line.quantity)}
            </span>
            <button
              type="button"
              onClick={() => removeLine(line.key)}
              disabled={lines.length <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Kalemi kaldır"
            >
              Kaldır
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addLine}
          className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700"
        >
          + Ürün ekle
        </button>
      </div>

      <label className="block min-w-0">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Not (opsiyonel)</span>
        <input
          name="note"
          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          placeholder="Sipariş notu"
        />
      </label>

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold text-slate-600">Ara toplam (sunucu tarafında doğrulanır)</span>
        <span className="text-lg font-black text-slate-950">{formatTry(subtotal)}</span>
      </div>

      <div>
        <button
          type="submit"
          disabled={validLines.length === 0}
          className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
        >
          Sipariş oluştur
        </button>
      </div>
    </form>
  );
}
