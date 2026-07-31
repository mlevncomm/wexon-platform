"use client";

import { useMemo, useRef, useState } from "react";
import QrCartBar from "@/components/qr-order/QrCartBar";
import QrProductCard from "@/components/qr-order/QrProductCard";
import QrProductDetailSheet from "@/components/qr-order/QrProductDetailSheet";
import QrChipRow from "@/components/qr-order/ui/QrChipRow";
import QrEmptyState from "@/components/qr-order/ui/QrEmptyState";
import QrSearchField from "@/components/qr-order/ui/QrSearchField";
import QrSectionHeader from "@/components/qr-order/ui/QrSectionHeader";
import { qrFrame, qrIconBtn, qrPageShellFlush } from "@/components/qr-order/qr-theme";
import { productHasModifiers, productRequiresModifierSelection } from "@/lib/qr-order/modifiers";
import { buildCartLineKey, cartItemCount, cartSubtotal } from "@/lib/qr-order/pricing";
import type { QrCartLine, QrCategory, QrProduct, QrTableContext } from "@/lib/qr-order/types";

const POPULAR_ID = "__popular__";
const ALL_ID = "__all__";

export default function QrMenuScreen({
  context,
  categories,
  lines,
  onAddLine,
  onOpenCart,
  menuEmpty,
}: {
  context: QrTableContext;
  categories: QrCategory[];
  lines: QrCartLine[];
  onAddLine: (line: QrCartLine) => void;
  onOpenCart: () => void;
  menuEmpty?: boolean;
}) {
  const popularProducts = useMemo(
    () => categories.flatMap((category) => category.products).filter((product) => product.isPopular),
    [categories],
  );

  const allProducts = useMemo(
    () => categories.flatMap((category) => category.products),
    [categories],
  );

  const chips = useMemo(() => {
    const base = categories.map((category) => ({ id: category.id, name: category.name }));
    const withAll = [{ id: ALL_ID, name: "Tümü" }, ...base];
    if (popularProducts.length > 0) {
      return [{ id: POPULAR_ID, name: "Popüler" }, ...withAll];
    }
    return withAll;
  }, [categories, popularProducts.length]);

  const [activeCategoryId, setActiveCategoryId] = useState(chips[0]?.id ?? ALL_ID);
  const [detailProduct, setDetailProduct] = useState<QrProduct | null>(null);
  const [query, setQuery] = useState("");
  const quickAddLock = useRef(false);

  const visibleProducts = useMemo(() => {
    let base: QrProduct[];
    if (activeCategoryId === POPULAR_ID) base = popularProducts;
    else if (activeCategoryId === ALL_ID) base = allProducts;
    else base = categories.find((category) => category.id === activeCategoryId)?.products ?? [];

    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.description ?? "").toLowerCase().includes(q),
    );
  }, [activeCategoryId, allProducts, categories, popularProducts, query]);

  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  function quickAdd(product: QrProduct) {
    if (quickAddLock.current) return;
    if (productRequiresModifierSelection(product) || productHasModifiers(product)) {
      setDetailProduct(product);
      return;
    }
    quickAddLock.current = true;
    onAddLine({
      key: buildCartLineKey(product.id, "", []),
      product,
      quantity: 1,
      note: "",
      modifierOptionIds: [],
    });
    window.setTimeout(() => {
      quickAddLock.current = false;
    }, 350);
  }

  return (
    <div className={`${qrPageShellFlush} items-center`}>
      <div className={`${qrFrame} w-full overflow-x-hidden pb-24 pt-0`}>
        <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200/60 bg-wx-surface/95 px-4 pb-3 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                WexPay · Masa siparişi
              </p>
              <h1 className="mt-1 truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                {context.restaurantName}
              </h1>
              <p className="mt-0.5 text-sm font-semibold text-slate-500">
                {context.tableLabel}
                <span className="text-slate-300"> · </span>
                {context.branchName}
              </p>
            </div>
            <button
              type="button"
              data-testid="qr-cart-badge"
              onClick={onOpenCart}
              className={`${qrIconBtn} relative`}
              aria-label={`Sepet, ${itemCount} ürün`}
            >
              <svg
                className="h-5 w-5 text-slate-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 6h2l1.2 9.2a2 2 0 0 0 2 1.8h7.4a2 2 0 0 0 2-1.7L20 8H7" />
                <circle cx="10" cy="20" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="17" cy="20" r="1.2" fill="currentColor" stroke="none" />
              </svg>
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-wx-accent px-1 text-[10px] font-black text-white">
                  {itemCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="mt-3">
            <QrSearchField value={query} onChange={setQuery} />
          </div>

          {chips.length > 0 ? (
            <div className="mt-3">
              <QrChipRow
                items={chips}
                activeId={activeCategoryId || chips[0].id}
                onSelect={setActiveCategoryId}
              />
            </div>
          ) : null}
        </header>

        <div className="mt-5" data-testid="qr-menu-screen">
          {menuEmpty ? (
            <QrEmptyState
              title="Menü henüz hazır değil"
              description="Personelden yardım isteyebilir veya biraz sonra tekrar deneyebilirsiniz."
              testId="qr-menu-empty"
            />
          ) : (
            <>
              {activeCategoryId === POPULAR_ID ||
              (activeCategoryId === ALL_ID && popularProducts.length > 0 && !query.trim()) ? (
                <div className="mb-6">
                  <QrSectionHeader title="Popüler Lezzetler" subtitle="Masadan hızlı sipariş için" />
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {(activeCategoryId === POPULAR_ID ? visibleProducts : popularProducts.slice(0, 4)).map(
                      (product) => (
                        <QrProductCard
                          key={`pop-${product.id}`}
                          product={product}
                          onOpen={() => setDetailProduct(product)}
                          onQuickAdd={() => quickAdd(product)}
                        />
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              {activeCategoryId !== POPULAR_ID ? (
                <>
                  <QrSectionHeader
                    title={
                      activeCategoryId === ALL_ID
                        ? "Menü"
                        : (categories.find((c) => c.id === activeCategoryId)?.name ?? "Ürünler")
                    }
                    subtitle={query.trim() ? `"${query.trim()}" sonuçları` : undefined}
                  />
                  {visibleProducts.length === 0 ? (
                    <QrEmptyState
                      title={query.trim() ? "Aramayla eşleşen ürün yok" : "Bu kategoride ürün yok"}
                      description="Başka bir kategori veya arama deneyin."
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                      {visibleProducts.map((product) => (
                        <QrProductCard
                          key={product.id}
                          product={product}
                          onOpen={() => setDetailProduct(product)}
                          onQuickAdd={() => quickAdd(product)}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : visibleProducts.length === 0 ? (
                <QrEmptyState title="Popüler ürün yok" description="Kategorilerden ürün seçebilirsiniz." />
              ) : null}
            </>
          )}
        </div>

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
    </div>
  );
}
