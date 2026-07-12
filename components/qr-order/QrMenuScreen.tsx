"use client";

import { useMemo, useState } from "react";
import QrCartBar from "@/components/qr-order/QrCartBar";
import QrCategoryTabs from "@/components/qr-order/QrCategoryTabs";
import QrProductCard from "@/components/qr-order/QrProductCard";
import QrProductDetailSheet from "@/components/qr-order/QrProductDetailSheet";
import QrStatusBadge from "@/components/qr-order/QrStatusBadge";
import { qrGhostCta, qrIconBtn, qrFrame } from "@/components/qr-order/qr-theme";
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
    <div className={`${qrFrame} pb-28 pt-3 sm:pb-32`}>
      <header className="sticky top-0 z-20 -mx-4 border-b border-emerald-100/50 bg-[#F6F8F5]/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className={qrIconBtn} aria-label="Geri">
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black tracking-tight text-slate-950 sm:text-base">
              {context.restaurantName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="truncate text-xs font-semibold text-slate-500 sm:text-sm">{context.tableLabel}</p>
              <QrStatusBadge tone="mint">Masaya servis</QrStatusBadge>
            </div>
          </div>
          <button
            type="button"
            data-testid="qr-cart-badge"
            onClick={onOpenCart}
            className={`${qrIconBtn} relative`}
            aria-label="Sepet"
          >
            <span aria-hidden="true" className="text-base font-black text-slate-700">
              ≡
            </span>
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

      <div
        className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2"
        data-testid="qr-menu-screen"
      >
        {visibleProducts.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300/80 bg-white/70 p-8 text-center backdrop-blur-sm md:col-span-2">
            <p className="text-sm font-black text-slate-800">Bu kategoride ürün yok</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Başka bir kategori deneyin.</p>
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

      <button type="button" onClick={onCallWaiter} className={`${qrGhostCta} mt-6 max-w-md`}>
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
