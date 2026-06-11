"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DemoScreen = "menu" | "order-status" | "payment-done";

type MenuProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryName: string;
  isPopular: boolean;
};

type MenuResponse = {
  restaurant: { id: string; name: string; slug: string };
  categories: Array<{ id: string; name: string; isActive: boolean }>;
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    isPopular: boolean;
    categoryName: string;
  }>;
};

type OrderResponse = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  table: { name: string };
  items: Array<{ name: string; quantity: number; lineTotal: number }>;
};

function formatTry(value: number) {
  return `${value.toLocaleString("tr-TR")} ₺`;
}

export default function WexPayMiniDemoClient() {
  const [screen, setScreen] = useState<DemoScreen>("menu");
  const [restaurantName, setRestaurantName] = useState("WexPay Demo");
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await fetch("/api/wexpay/demo/menu");
        if (!response.ok) throw new Error("Menü yüklenemedi.");

        const data = (await response.json()) as MenuResponse;
        if (cancelled) return;

        const mapped = data.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          categoryName: product.categoryName,
          isPopular: product.isPopular,
        }));

        const tabs = [
          ...(mapped.some((item) => item.isPopular) ? ["Popüler"] : []),
          ...data.categories.filter((c) => c.isActive).map((c) => c.name),
        ];

        setRestaurantName(data.restaurant.name);
        setProducts(mapped);
        setCategories(tabs);
        setActiveCategory(tabs[0] ?? "");
      } catch {
        if (!cancelled) setLoadError("Demo menüsü şu anda yüklenemiyor.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMenu();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    if (activeCategory === "Popüler") {
      return products.filter((item) => item.isPopular);
    }
    return products.filter((item) => item.categoryName === activeCategory);
  }, [activeCategory, products]);

  const cartLines = useMemo(
    () =>
      products
        .map((product) => ({ product, quantity: cart[product.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [cart, products],
  );

  const cartTotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  function updateCart(productId: string, delta: number) {
    setActionError(null);
    setCart((current) => {
      const next = Math.max(0, (current[productId] ?? 0) + delta);
      const updated = { ...current };
      if (next === 0) delete updated[productId];
      else updated[productId] = next;
      return updated;
    });
  }

  async function submitOrder() {
    if (cartLines.length === 0) {
      setActionError("Sepete en az bir ürün ekleyin.");
      return;
    }

    try {
      setSubmitting(true);
      setActionError(null);

      const response = await fetch("/api/wexpay/demo/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: "Masa 12",
          note: orderNote.trim() || undefined,
          items: cartLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
      });

      if (!response.ok) throw new Error("Sipariş oluşturulamadı.");

      const created = (await response.json()) as OrderResponse;
      setOrder(created);
      setScreen("order-status");
    } catch {
      setActionError("Sipariş gönderilirken bir sorun oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function simulatePayment() {
    if (!order) return;

    try {
      setSubmitting(true);
      setActionError(null);

      const response = await fetch("/api/wexpay/demo/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: order.table.name,
          orderId: order.id,
          amount: order.totalAmount,
          receiptRequested: false,
        }),
      });

      if (!response.ok) throw new Error("Ödeme simülasyonu başarısız.");

      const payment = (await response.json()) as { id: string };
      setPaymentId(payment.id);
      setScreen("payment-done");
    } catch {
      setActionError("Ödeme simülasyonu sırasında bir sorun oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  function restartDemo() {
    setScreen("menu");
    setCart({});
    setOrderNote("");
    setOrder(null);
    setPaymentId(null);
    setActionError(null);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">WexPay Demo</p>
            <h1 className="truncate text-base font-black text-white">{restaurantName}</h1>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
            Masa 12 · QR
          </span>
        </div>
      </header>

      {screen === "menu" ? (
        <>
          <div className="flex-1 px-4 pb-28 pt-4">
            <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <p className="text-xs font-semibold leading-relaxed text-emerald-100/90">
                Tek QR ile menü, sipariş ve ödeme. Bu akış gerçek ödeme almaz; WexPay deneyimini simüle eder.
              </p>
            </div>

            {loading ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-slate-400">
                Menü yükleniyor...
              </p>
            ) : loadError ? (
              <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">
                {loadError}
              </p>
            ) : (
              <>
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
                        activeCategory === category
                          ? "bg-emerald-500 text-white"
                          : "border border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {visibleProducts.map((product) => {
                    const quantity = cart[product.id] ?? 0;
                    return (
                      <article
                        key={product.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{product.name}</p>
                            {product.description ? (
                              <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-400">
                                {product.description}
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 text-sm font-black text-emerald-300">{formatTry(product.price)}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">
                            {quantity > 0 ? `${quantity} adet` : "Sepete ekle"}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateCart(product.id, -1)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-bold text-white"
                              aria-label="Azalt"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-bold text-white">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCart(product.id, 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white"
                              aria-label="Artır"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-bold text-slate-400">Sipariş notu (opsiyonel)</span>
                  <textarea
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    rows={2}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/40"
                    placeholder="Örn. Az acılı olsun"
                  />
                </label>
              </>
            )}

            {actionError ? (
              <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-200">
                {actionError}
              </p>
            ) : null}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sepet</p>
                <p className="text-lg font-black text-white">{formatTry(cartTotal)}</p>
                <p className="text-xs font-semibold text-slate-500">{cartCount} ürün</p>
              </div>
              <button
                type="button"
                onClick={() => void submitOrder()}
                disabled={submitting || cartCount === 0}
                className="rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Gönderiliyor..." : "Sipariş Ver"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {screen === "order-status" && order ? (
        <div className="flex flex-1 flex-col px-4 py-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">Sipariş alındı</p>
            <h2 className="mt-2 text-2xl font-black text-white">{order.orderNumber}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {order.table.name} · Durum: {order.status}
            </p>

            <ul className="mt-5 space-y-2 border-t border-white/10 pt-4">
              {order.items.map((item) => (
                <li key={`${item.name}-${item.quantity}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-slate-200">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="shrink-0 font-bold text-white">{formatTry(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-sm font-bold text-slate-400">Toplam</span>
              <span className="text-xl font-black text-emerald-300">{formatTry(order.totalAmount)}</span>
            </div>
          </div>

          <p className="mt-4 text-center text-xs font-medium leading-relaxed text-slate-500">
            Sipariş mutfağa iletildi. Şimdi aynı QR ekranından ödeme simülasyonunu tamamlayın.
          </p>

          {actionError ? (
            <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-200">
              {actionError}
            </p>
          ) : null}

          <div className="mt-auto space-y-2 pt-6">
            <button
              type="button"
              onClick={() => void simulatePayment()}
              disabled={submitting}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-60"
            >
              {submitting ? "Simüle ediliyor..." : "Ödeme Simülasyonunu Başlat"}
            </button>
            <button
              type="button"
              onClick={restartDemo}
              className="w-full rounded-2xl border border-white/10 py-3.5 text-sm font-bold text-slate-300"
            >
              Yeni Demo
            </button>
          </div>
        </div>
      ) : null}

      {screen === "payment-done" && order ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M5 12l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="mt-5 text-2xl font-black text-white">Ödeme simülasyonu tamamlandı</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
            {order.orderNumber} numaralı sipariş için {formatTry(order.totalAmount)} tutarında demo ödeme kaydedildi.
          </p>
          {paymentId ? (
            <p className="mt-2 text-xs font-semibold text-slate-500">Demo ödeme ref: {paymentId.slice(0, 8)}</p>
          ) : null}

          <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={restartDemo}
              className="rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-white hover:bg-emerald-400"
            >
              Tekrar Dene
            </button>
            <Link
              href="/demo-request"
              className="rounded-2xl border border-white/10 py-3.5 text-sm font-bold text-slate-200"
            >
              Demo Talep Et
            </Link>
            <Link href="/links" className="text-xs font-semibold text-slate-500 hover:text-slate-300">
              Tüm bağlantılara dön
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
