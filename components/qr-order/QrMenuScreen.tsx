"use client";

import { useMemo, useState } from "react";
import QrCartBar from "@/components/qr-order/QrCartBar";
import QrCategoryTabs from "@/components/qr-order/QrCategoryTabs";
import QrProductCard from "@/components/qr-order/QrProductCard";
import QrProductDetailSheet from "@/components/qr-order/QrProductDetailSheet";
import { getMockOptionGroups } from "@/lib/qr-order/mock-options";
import { cartItemCount, cartSubtotal, enrichProductBadges } from "@/lib/qr-order/pricing";
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
  const enriched = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        products: category.products.map(enrichProductBadges),
      })),
    [categories],
  );

  const popularProducts = useMemo(
    () =>
      enriched
        .flatMap((category) => category.products)
        .filter((product) => product.isPopular || (product.badges ?? []).includes("popular")),
    [enriched],
  );

  const tabs = useMemo(() => {
    const base = enriched.map((category) => ({ id: category.id, name: category.name }));
    if (popularProducts.length > 0) {
      return [{ id: POPULAR_ID, name: "Popüler" }, ...base];
    }
    return base;
  }, [enriched, popularProducts.length]);

  const [activeCategoryId, setActiveCategoryId] = useState(tabs[0]?.id ?? "");
  const [detailProduct, setDetailProduct] = useState<QrProduct | null>(null);

  const visibleProducts = useMemo(() => {
    if (activeCategoryId === POPULAR_ID) return popularProducts;
    return enriched.find((category) => category.id === activeCategoryId)?.products ?? [];
  }, [activeCategoryId, enriched, popularProducts]);

  const groupsByProductId = useMemo(() => {
    const map: Record<string, ReturnType<typeof getMockOptionGroups>> = {};
    for (const category of enriched) {
      for (const product of category.products) {
        map[product.id] = getMockOptionGroups(product.name);
      }
    }
    return map;
  }, [enriched]);

  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines, groupsByProductId);

  function quickAdd(product: QrProduct) {
    const groups = groupsByProductId[product.id] ?? [];
    if (groups.some((group) => group.required)) {
      setDetailProduct(product);
      return;
    }
    onAddLine({
      key: `${product.id}::::`,
      product,
      quantity: 1,
      selectedOptions: {},
      note: "",
    });
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-28 pt-3">
      <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200/80 bg-[#f6f8f7]/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold"
            aria-label="Geri"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-950">{context.restaurantName}</p>
            <p className="truncate text-xs font-semibold text-slate-500">
              {context.tableLabel} · Masaya servis
            </p>
          </div>
          <button
            type="button"
            data-testid="qr-cart-badge"
            onClick={onOpenCart}
            className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-black"
            aria-label="Sepet"
          >
            ☰
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#10b981] px-1 text-[10px] font-black text-white">
                {itemCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      {tabs.length > 0 ? (
        <QrCategoryTabs
          categories={tabs}
          activeId={activeCategoryId || tabs[0].id}
          onSelect={setActiveCategoryId}
        />
      ) : null}

      <div className="mt-4 space-y-3" data-testid="qr-menu-screen">
        {visibleProducts.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">
            Bu kategoride ürün yok.
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

      <button
        type="button"
        onClick={onCallWaiter}
        className="mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
      >
        Garson çağır
      </button>

      <QrCartBar itemCount={itemCount} subtotal={subtotal} onContinue={onOpenCart} />

      <QrProductDetailSheet
        product={detailProduct}
        groups={detailProduct ? groupsByProductId[detailProduct.id] ?? [] : []}
        open={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        onAdd={onAddLine}
      />
    </div>
  );
}
