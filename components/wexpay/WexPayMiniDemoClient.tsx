"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatLira,
  OrderStatusBadge,
  WexPayErrorNotice,
} from "@/components/wexpay/WexPayBusinessUI";

type DemoScreen = "menu" | "order-status" | "payment" | "payment-done";

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

function RestaurantHeader({ badge, restaurantName }: { badge: string; restaurantName: string }) {
  return (
    <header className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">WexPay · QR Menü</p>
          <p className="mt-1 text-xs font-semibold text-[#10b981]">{restaurantName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Masa 12</h1>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
          {badge}
        </span>
      </div>
    </header>
  );
}

function QuantityControl({
  quantity,
  onMinus,
  onPlus,
}: {
  quantity: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onMinus}
        disabled={quantity === 0}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
        aria-label="Azalt"
      >
        −
      </button>
      <span className="min-w-6 text-center text-sm font-bold text-slate-950">{quantity}</span>
      <button
        type="button"
        onClick={onPlus}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#10b981] text-lg font-bold text-white"
        aria-label="Artır"
      >
        +
      </button>
    </div>
  );
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
  const [paymentRef, setPaymentRef] = useState<string | null>(null);

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
    if (activeCategory === "Popüler") return products.filter((item) => item.isPopular);
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

      const payment = (await response.json()) as { id: string; transactionId?: string | null };
      setPaymentRef(payment.transactionId ?? payment.id);
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
    setPaymentRef(null);
    setActionError(null);
  }

  return (
    <main className="min-h-dvh bg-[#f6f8f7] px-4 py-6 text-slate-950 sm:px-6">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/80">
          <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto overflow-x-hidden rounded-[26px] border border-slate-200 bg-[#fbfcfb] p-5">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-200" aria-hidden />

            {screen === "menu" ? (
              <section>
                <RestaurantHeader badge="QR menü" restaurantName={restaurantName} />

                <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-relaxed text-emerald-700">
                  QR okutuldu · Menüden seç, sepete ekle, siparişi gönder, ödemeyi simüle et. Gerçek ödeme alınmaz.
                </p>

                {loading ? (
                  <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                    Menü yükleniyor...
                  </p>
                ) : loadError ? (
                  <WexPayErrorNotice message={loadError} />
                ) : (
                  <>
                    <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
                      {categories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setActiveCategory(category)}
                          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                            activeCategory === category
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-600"
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
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5"
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h2 className="text-sm font-bold text-slate-950">{product.name}</h2>
                                {product.description ? (
                                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                    {product.description}
                                  </p>
                                ) : null}
                              </div>
                              <p className="shrink-0 text-sm font-black text-slate-950">{formatLira(product.price)}</p>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-slate-500">
                                {quantity > 0 ? `${quantity} adet sepette` : "Sepete ekle"}
                              </span>
                              <QuantityControl
                                quantity={quantity}
                                onMinus={() => updateCart(product.id, -1)}
                                onPlus={() => updateCart(product.id, 1)}
                              />
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <h3 className="mb-3 text-sm font-bold text-slate-950">Sepet</h3>
                      {cartLines.length === 0 ? (
                        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Henüz ürün seçilmedi.</p>
                      ) : (
                        <ul className="space-y-2">
                          {cartLines.map((line) => (
                            <li key={line.product.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="min-w-0 truncate font-semibold text-slate-950">{line.product.name}</span>
                              <span className="shrink-0 font-bold text-slate-950">
                                {formatLira(line.product.price * line.quantity)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <input
                        value={orderNote}
                        onChange={(event) => setOrderNote(event.target.value)}
                        placeholder="Sipariş notu ekleyin"
                        className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
                      />
                      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                        <span className="text-sm font-semibold text-slate-500">Sepet toplamı</span>
                        <span className="text-xl font-black text-slate-950">{formatLira(cartTotal)}</span>
                      </div>
                      {actionError ? <div className="mt-4"><WexPayErrorNotice message={actionError} /></div> : null}
                      <button
                        type="button"
                        onClick={() => void submitOrder()}
                        disabled={submitting || cartCount === 0}
                        className="mt-4 w-full rounded-2xl bg-[#10b981] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        {submitting ? "Sipariş gönderiliyor..." : "Siparişi Gönder"}
                      </button>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            {screen === "order-status" && order ? (
              <section className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-[#10b981]">
                  ✓
                </div>
                <h2 className="text-2xl font-black text-slate-950">Sipariş alındı</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Sipariş mutfağa iletildi. Aynı QR ekranından ödemeye geçebilirsiniz.
                </p>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-950">{order.orderNumber}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{order.table.name}</p>
                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {order.items.map((item) => (
                      <li key={`${item.name}-${item.quantity}`} className="flex justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-semibold text-slate-700">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="shrink-0 font-bold text-slate-950">{formatLira(item.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-semibold text-slate-500">Toplam</span>
                    <span className="text-lg font-black text-emerald-600">{formatLira(order.totalAmount)}</span>
                  </div>
                </div>
                {actionError ? <div className="mt-4"><WexPayErrorNotice message={actionError} /></div> : null}
                <div className="mt-6 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setScreen("payment");
                    }}
                    className="w-full rounded-2xl bg-[#10b981] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
                  >
                    Ödemeyi Simüle Et
                  </button>
                  <button
                    type="button"
                    onClick={restartDemo}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700"
                  >
                    Yeni Demo
                  </button>
                </div>
              </section>
            ) : null}

            {screen === "payment" && order ? (
              <section>
                <RestaurantHeader badge="Güvenli ödeme" restaurantName={restaurantName} />
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Demo checkout</p>
                  <p className="text-sm font-bold text-slate-950">Ödeme simülasyonu</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Gerçek kart bilgisi alınmaz. WexPay tek QR ödeme akışını test edersiniz.
                  </p>
                  <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-500">Sipariş</span>
                      <span className="font-bold text-slate-950">{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-500">Masa</span>
                      <span className="font-bold text-slate-950">{order.table.name}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-3 text-sm">
                      <span className="font-semibold text-slate-500">Ödenecek tutar</span>
                      <span className="text-lg font-black text-emerald-600">{formatLira(order.totalAmount)}</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 rounded-2xl border border-dashed border-slate-200 p-3 text-left text-xs font-semibold text-slate-500">
                    <p>Kart: **** **** **** 4821</p>
                    <p>Simülasyon · WexPay Demo</p>
                  </div>
                </div>
                {actionError ? <div className="mt-4"><WexPayErrorNotice message={actionError} /></div> : null}
                <button
                  type="button"
                  onClick={() => void simulatePayment()}
                  disabled={submitting}
                  className="mt-5 w-full rounded-2xl bg-[#10b981] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  {submitting ? "Ödeme tamamlanıyor..." : "Ödemeyi Tamamla"}
                </button>
                <button
                  type="button"
                  onClick={() => setScreen("order-status")}
                  className="mt-2 w-full rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600"
                >
                  Geri
                </button>
              </section>
            ) : null}

            {screen === "payment-done" && order ? (
              <section className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-[#10b981]">
                  ✓
                </div>
                <h2 className="text-2xl font-black text-slate-950">Ödeme tamamlandı</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Ödeme simülasyonu başarıyla kaydedildi.
                </p>
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Sipariş</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{order.orderNumber}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-emerald-700">Tutar</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">{formatLira(order.totalAmount)}</p>
                  {paymentRef ? (
                    <>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-emerald-700">Ödeme ref</p>
                      <p className="mt-1 break-all text-xs font-semibold text-slate-600">{paymentRef}</p>
                    </>
                  ) : null}
                </div>
                <div className="mt-6 space-y-2">
                  <button
                    type="button"
                    onClick={restartDemo}
                    className="w-full rounded-2xl bg-[#10b981] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20"
                  >
                    Tekrar Dene
                  </button>
                  <Link
                    href="/demo-request"
                    className="block w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700"
                  >
                    Demo Talep Et
                  </Link>
                  <Link href="/links" className="block text-xs font-semibold text-slate-500 hover:text-emerald-700">
                    WexPay bağlantılarına dön
                  </Link>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <p className="mt-4 px-2 text-center text-[11px] font-semibold leading-relaxed text-slate-400">
          WexPay public demo · Gerçek ödeme ve webhook tetiklenmez.
        </p>
      </div>
    </main>
  );
}
