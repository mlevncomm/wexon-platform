"use client";

import { useMemo, useState, useTransition } from "react";

type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
};

type PublicCategory = {
  id: string;
  name: string;
  products: PublicProduct[];
};

type CartLine = {
  product: PublicProduct;
  quantity: number;
};

function formatTry(value: number) {
  return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;
}

export default function WexPayPublicOrderClient({
  qrCode,
  categories,
}: {
  qrCode: string;
  categories: PublicCategory[];
}) {
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNo: string; subtotal: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const lines = useMemo(() => Object.values(cart), [cart]);
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  function changeQuantity(product: PublicProduct, delta: number) {
    setSuccess(null);
    setError(null);
    setCart((current) => {
      const existing = current[product.id]?.quantity ?? 0;
      const nextQuantity = Math.max(0, existing + delta);
      if (nextQuantity === 0) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }
      return { ...current, [product.id]: { product, quantity: nextQuantity } };
    });
  }

  function submitOrder() {
    setError(null);
    setSuccess(null);
    if (lines.length === 0) {
      setError("Sipariş göndermek için sepete ürün ekleyin.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/wexpay/public/${encodeURIComponent(qrCode)}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note,
          items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; orderNo?: string; subtotal?: number };
      if (!response.ok) {
        setError(payload.error ?? "Sipariş gönderilemedi. Lütfen personelden destek isteyin.");
        return;
      }

      setCart({});
      setNote("");
      setSuccess({ orderNo: payload.orderNo ?? "-", subtotal: Number(payload.subtotal ?? subtotal) });
    });
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        {categories.map((category) => (
          <section key={category.id} className="rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <h2 className="mb-3 text-base font-black tracking-tight text-slate-950">{category.name}</h2>
            {category.products.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Bu kategoride ürün yok.
              </p>
            ) : (
              <div className="space-y-3">
                {category.products.map((product) => {
                  const quantity = cart[product.id]?.quantity ?? 0;
                  return (
                    <div key={product.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black text-slate-950">{product.name}</p>
                          {product.description && (
                            <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                              {product.description}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-sm font-black text-slate-950">{formatTry(product.price)}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-500">{quantity > 0 ? `${quantity} adet sepette` : "Sepete ekle"}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changeQuantity(product, -1)}
                            disabled={quantity === 0}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`${product.name} azalt`}
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-sm font-black text-slate-950">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(product, 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10b981] text-lg font-black text-white shadow-sm shadow-emerald-500/25"
                            aria-label={`${product.name} arttır`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <aside className="min-w-0 rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:sticky lg:top-5 lg:self-start">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Sepet</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{totalQuantity} ürün</h2>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Sepetiniz boş. Menüden ürün ekleyin.
          </p>
        ) : (
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.product.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{line.product.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{line.quantity} adet</p>
                </div>
                <p className="shrink-0 text-sm font-black text-slate-950">{formatTry(line.product.price * line.quantity)}</p>
              </div>
            ))}
          </div>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Not</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Örn. Soğansız, az acılı..."
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-bold text-slate-600">Ara toplam</span>
          <span className="text-lg font-black text-slate-950">{formatTry(subtotal)}</span>
        </div>

        {error && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            Siparişiniz alındı: {success.orderNo} · {formatTry(success.subtotal)}
          </div>
        )}

        <button
          type="button"
          onClick={submitOrder}
          disabled={isPending || lines.length === 0}
          className="mt-4 w-full rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPending ? "Gönderiliyor..." : "Siparişi Gönder"}
        </button>
      </aside>
    </div>
  );
}

