"use client";

import { useMemo, useRef, useState } from "react";
import QrCartBar from "@/components/qr-order/QrCartBar";
import QrCategoryTabs from "@/components/qr-order/QrCategoryTabs";
import QrProductCard from "@/components/qr-order/QrProductCard";
import QrProductDetailSheet from "@/components/qr-order/QrProductDetailSheet";
import QrStatusBadge from "@/components/qr-order/QrStatusBadge";
import { qrGhostCta, qrIconBtn, qrFrame } from "@/components/qr-order/qr-theme";
import { cartItemCount, cartSubtotal } from "@/lib/qr-order/pricing";
import type { QrCartLine, QrCategory, QrProduct, QrTableContext } from "@/lib/qr-order/types";

const POPULAR_ID = "__popular__";

export default function QrMenuScreen({
  context,
  categories,
  lines,
  onAddLine,
  onOpenCart,
  onBack,
  onCallWaiter,
}: {
  context: QrTableContext;
  categories: QrCategory[];
  lines: QrCartLine[];
  onAddLine: (line: QrCartLine) => void;
  onOpenCart: () => void;
  onBack: () => void;
  onCallWaiter: () => void;
}) {
  const popularProducts = useMemo(
    () => categories.flatMap((category) => category.products).filter((product) => product.isPopular),
    [categories],
  );

  const tabs = useMemo(() => {
    const base = categories.map((category) => ({ id: category.id, name: category.name }));
    if (popularProducts.length > 0) {
      return [{ id: POPULAR_ID, name: "Öne çıkanlar" }, ...base];
    }
    return base;
  }, [categories, popularProducts.length]);

  const [activeCategoryId, setActiveCategoryId] = useState(tabs[0]?.id ?? "");
  const [detailProduct, setDetailProduct] = useState<QrProduct | null>(null);
  const [query, setQuery] = useState("");
  const quickAddLock = useRef(false);

  const visibleProducts = useMemo(() => {
    const base =
      activeCategoryId === POPULAR_ID
        ? popularProducts
        : (categories.find((category) => category.id === activeCategoryId)?.products ?? []);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.description ?? "").toLowerCase().includes(q),
    );
  }, [activeCategoryId, categories, popularProducts, query]);

  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  function quickAdd(product: QrProduct) {
    if (quickAddLock.current) return;
    quickAddLock.current = true;
    onAddLine({
      key: `${product.id}::`,
      product,
      quantity: 1,
      note: "",
    });
    window.setTimeout(() => {
      quickAddLock.current = false;
    }, 350);
  }

  return (
    <div className={`${qrFrame} pb-28 pt-3 sm:pb-32 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 lg:items-start`}>
      <div>
        <header className="sticky top-0 z-20 -mx-4 border-b border-emerald-100/50 bg-[#F6F8F5]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className={qrIconBtn} aria-label="Geri">
              ←
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black tracking-tight text-slate-950 sm:text-base">
                {context.restaurantName}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="truncate text-xs font-semibold text-slate-500 sm:text-sm">
                  {context.branchName} · {context.tableLabel}
                </p>
                <QrStatusBadge tone="mint">Masaya servis</QrStatusBadge>
              </div>
            </div>
            <button
              type="button"
              data-testid="qr-cart-badge"
              onClick={onOpenCart}
              className={`${qrIconBtn} relative lg:hidden`}
              aria-label={`Sepet, ${itemCount} ürün`}
            >
              <span aria-hidden="true" className="text-base font-black text-slate-700">
                ≡
              </span>
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0f9f6e] px-1 text-[10px] font-black text-white">
                  {itemCount}
                </span>
              ) : null}
            </button>
          </div>

          <label className="mt-3 block">
            <span className="sr-only">Menüde ara</span>
            <input
              data-testid="qr-menu-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ürün ara…"
              className="min-h-11 w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 text-sm font-semibold text-slate-950 outline-none focus-visible:border-emerald-300 focus-visible:ring-4 focus-visible:ring-emerald-100"
            />
          </label>

          {tabs.length > 0 ? (
            <div className="mt-3 lg:hidden">
              <QrCategoryTabs
                categories={tabs}
                activeId={activeCategoryId || tabs[0].id}
                onSelect={setActiveCategoryId}
                embedded
              />
            </div>
          ) : null}
        </header>

        {tabs.length > 0 ? (
          <div className="hidden lg:block">
            <QrCategoryTabs
              categories={tabs}
              activeId={activeCategoryId || tabs[0].id}
              onSelect={setActiveCategoryId}
            />
          </div>
        ) : null}

        <div
          className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2"
          data-testid="qr-menu-screen"
        >
          {visibleProducts.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300/80 bg-white/70 p-8 text-center backdrop-blur-sm md:col-span-2">
              <p className="text-sm font-black text-slate-800">
                {query.trim() ? "Aramayla eşleşen ürün yok" : "Bu kategoride ürün yok"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Başka bir kategori veya arama deneyin.</p>
            </div>
          ) : (
            visibleProducts.map((product) => (
              <QrProductCard
                key={product.id}
                product={product}
                onOpen={() => setDetailProduct(product)}
                onQuickAdd={() => quickAdd(product)}
              />
            ))
          )}
        </div>

        <button type="button" onClick={onCallWaiter} className={`${qrGhostCta} mt-6 max-w-md lg:hidden`}>
          Garson çağır
        </button>
      </div>

      <aside className="hidden lg:sticky lg:top-6 lg:block" aria-label="Sepet özeti">
        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-800">Sepet</p>
          <p className="mt-2 text-sm font-black text-slate-950" data-testid="qr-desktop-cart-summary">
            {itemCount > 0 ? `${itemCount} ürün · katalog toplamı güncel fiyatlarla` : "Sepet boş"}
          </p>
          {itemCount > 0 ? (
            <button type="button" onClick={onOpenCart} className="mt-4 min-h-11 w-full rounded-2xl bg-[#0f9f6e] text-sm font-black text-white">
              Sepeti Gör
            </button>
          ) : (
            <p className="mt-3 text-xs font-semibold text-slate-500">Ürün ekleyince burada özet görünür.</p>
          )}
          <button type="button" onClick={onCallWaiter} className={`${qrGhostCta} mt-3`}>
            Garson çağır
          </button>
        </div>
      </aside>

      <div className="lg:hidden">
        <QrCartBar itemCount={itemCount} subtotal={subtotal} onContinue={onOpenCart} />
      </div>

      <QrProductDetailSheet
        product={detailProduct}
        open={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        onAdd={onAddLine}
      />
    </div>
  );
}
