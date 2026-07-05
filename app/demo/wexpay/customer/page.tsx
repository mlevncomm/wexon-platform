"use client";

import { useEffect, useMemo, useState } from "react";

type Screen = "welcome" | "menu" | "orderSuccess" | "payment" | "paymentForm" | "paymentSuccess";
type PaymentMode = "selected" | "full";
type TipOption = 0 | 5 | 10;
type Category = string;

interface BillItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  paid: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId?: string;
  categories: Category[];
  imageUrl?: string;
  inStock: boolean;
}

interface MenuRestaurant {
  id: string;
  name: string;
  slug: string;
}

interface ApiMenuResponse {
  restaurant: MenuRestaurant;
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    isActive: boolean;
    inStock: boolean;
    isPopular: boolean;
    categoryId: string;
    categoryName: string;
  }>;
}

interface CreatedOrderResponse {
  id: string;
  orderNumber: string;
  status: string;
  note: string | null;
  totalAmount: number;
  receiptRequested: boolean;
  createdAt: string;
  table: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
  }>;
}

interface CreatedPaymentResponse {
  id: string;
  amount: number;
  status: string;
  provider: string | null;
  transactionId: string | null;
  receiptRequested: boolean;
  createdAt: string;
  table: {
    id: string;
    name: string;
  };
  order: {
    id: string;
    orderNumber: string;
  } | null;
}

const defaultRestaurant: MenuRestaurant = {
  id: "demo",
  name: "Mavi Bahçe Restaurant",
  slug: "mavi-bahce-restaurant",
};

const initialBillItems: BillItem[] = [
  { id: "grilled-chicken", name: "Izgara Tavuk", quantity: 2, price: 390, paid: false },
  { id: "soup", name: "Mercimek Çorbası", quantity: 1, price: 120, paid: false },
  { id: "salad", name: "Mevsim Salata", quantity: 1, price: 160, paid: false },
  { id: "coffee", name: "Türk Kahvesi", quantity: 2, price: 90, paid: false },
  { id: "water", name: "Su", quantity: 2, price: 35, paid: true },
];

const explanationCards = [
  {
    title: "QR ile menü ve sipariş",
    description: "Müşteri masadaki QR kodu okutarak menüyü inceler ve sipariş oluşturur.",
  },
  {
    title: "Masa hesabını aynı ekrandan öde",
    description: "Aynı müşteri deneyimi içinde seçili ürün veya tüm hesap ödemesi yapılır.",
  },
  {
    title: "Sipariş ve fiş talepleri işletme paneline düşer",
    description: "Siparişler, ödeme bilgisi ve fiş talepleri restoran paneline iletilir.",
  },
];

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("tr-TR").format(value)} TL`;
}

export default function WexPayCustomerDemoPage() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [restaurant, setRestaurant] = useState<MenuRestaurant>(defaultRestaurant);
  const [activeCategory, setActiveCategory] = useState<Category>("Popüler");
  const [menuCategories, setMenuCategories] = useState<Category[]>([]);
  const [customerMenuItems, setCustomerMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNote, setOrderNote] = useState("");
  const [orderError, setOrderError] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<CreatedOrderResponse | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(["grilled-chicken", "soup"]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("selected");
  const [tip, setTip] = useState<TipOption>(0);
  const [receiptRequested, setReceiptRequested] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<CreatedPaymentResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        setMenuLoading(true);
        setMenuError(false);

        const response = await fetch("/api/wexpay/demo/menu");
        if (!response.ok) throw new Error("Menü alınamadı.");

        const data = (await response.json()) as ApiMenuResponse;
        const activeCategories = data.categories
          .filter((category) => category.isActive)
          .map((category) => category.name);
        const products = data.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          categoryId: product.categoryId,
          imageUrl: product.imageUrl ?? undefined,
          inStock: product.inStock,
          categories: [
            ...(product.isPopular ? ["Popüler"] : []),
            product.categoryName,
          ],
        }));
        const categoryTabs = [
          ...(products.some((product) => product.categories.includes("Popüler")) ? ["Popüler"] : []),
          ...activeCategories,
        ];

        if (cancelled) return;

        setRestaurant(data.restaurant);
        setMenuCategories(categoryTabs);
        setCustomerMenuItems(products);
        setActiveCategory(categoryTabs[0] ?? "");
      } catch {
        if (cancelled) return;
        setMenuError(true);
        setMenuCategories([]);
        setCustomerMenuItems([]);
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    }

    loadMenu();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleMenuItems = customerMenuItems.filter((item) => item.categories.includes(activeCategory));
  const cartItems = customerMenuItems
    .map((item) => ({ ...item, quantity: cart[item.id] ?? 0 }))
    .filter((item) => item.quantity > 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const unpaidItems = useMemo(() => initialBillItems.filter((item) => !item.paid), []);
  const selectedItems = unpaidItems.filter((item) => selectedItemIds.includes(item.id));
  const subtotal = selectedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const fullBillTotal = unpaidItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const tipAmount = Math.round((subtotal * tip) / 100);
  const payableTotal = subtotal + tipAmount;
  const remainingTotal = Math.max(fullBillTotal - subtotal, 0);

  function updateCart(itemId: string, change: number) {
    setOrderError("");
    setCart((previous) => {
      const nextQuantity = Math.max((previous[itemId] ?? 0) + change, 0);
      const next = { ...previous };

      if (nextQuantity === 0) {
        delete next[itemId];
      } else {
        next[itemId] = nextQuantity;
      }

      return next;
    });
  }

  async function sendOrder() {
    if (cartItems.length === 0) {
      setOrderError("Sipariş göndermek için en az bir ürün seçmelisiniz.");
      return;
    }

    try {
      setOrderSubmitting(true);
      setOrderError("");

      const response = await fetch("/api/wexpay/demo/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: "Masa 12",
          note: orderNote.trim(),
          receiptRequested: false,
          items: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (!response.ok) throw new Error("Sipariş gönderilemedi.");

      const order = (await response.json()) as CreatedOrderResponse;
      setSubmittedOrder(order);
      setScreen("orderSuccess");
    } catch {
      setOrderError("Sipariş gönderilirken bir sorun oluştu.");
    } finally {
      setOrderSubmitting(false);
    }
  }

  function handlePaymentModeChange(mode: PaymentMode) {
    setPaymentMode(mode);
    setPaymentError("");

    if (mode === "full") {
      setSelectedItemIds(unpaidItems.map((item) => item.id));
    }
  }

  function toggleBillItem(itemId: string) {
    if (paymentMode === "full") {
      setPaymentMode("selected");
    }

    setPaymentError("");
    setSelectedItemIds((previous) =>
      previous.includes(itemId)
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId],
    );
  }

  function openPaymentForm() {
    if (selectedItems.length === 0) {
      setPaymentError("Ödeme yapmak için en az bir ürün seçmelisiniz.");
      return;
    }

    setPaymentError("");
    setScreen("paymentForm");
  }

  async function completePayment() {
    if (payableTotal <= 0) {
      setPaymentError("Ödeme yapmak için geçerli bir tutar olmalıdır.");
      return;
    }

    try {
      setPaymentSubmitting(true);
      setPaymentError("");

      const response = await fetch("/api/wexpay/demo/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: "Masa 12",
          orderId: submittedOrder?.id,
          amount: payableTotal,
          receiptRequested,
        }),
      });

      if (!response.ok) throw new Error("Ödeme tamamlanamadı.");

      const payment = (await response.json()) as CreatedPaymentResponse;
      setCompletedPayment(payment);
      setScreen("paymentSuccess");
    } catch {
      setPaymentError("Ödeme işlemi sırasında bir sorun oluştu.");
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function resetDemo() {
    setScreen("welcome");
    setActiveCategory(menuCategories[0] ?? "Popüler");
    setCart({});
    setOrderNote("");
    setOrderError("");
    setOrderSubmitting(false);
    setSubmittedOrder(null);
    setSelectedItemIds(["grilled-chicken", "soup"]);
    setPaymentMode("selected");
    setTip(0);
    setReceiptRequested(false);
    setPaymentError("");
    setPaymentSubmitting(false);
    setCompletedPayment(null);
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1180px] gap-8 lg:grid-cols-[430px_1fr] lg:items-center">
        <section className="mx-auto w-full max-w-[430px] rounded-[32px] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/80 lg:mx-0">
          <div className="max-h-[calc(100vh-3.5rem)] overflow-y-auto rounded-[26px] border border-slate-200 bg-[#fbfcfb] p-5">
            <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-slate-200" />

            {screen === "welcome" && (
              <WelcomeScreen
                restaurantName={restaurant.name}
                onOrder={() => setScreen("menu")}
                onPayment={() => setScreen("payment")}
              />
            )}

            {screen === "menu" && (
              <MenuScreen
                activeCategory={activeCategory}
                cart={cart}
                cartItems={cartItems}
                cartTotal={cartTotal}
                categories={menuCategories}
                loading={menuLoading}
                hasError={menuError}
                restaurantName={restaurant.name}
                orderError={orderError}
                orderSubmitting={orderSubmitting}
                orderNote={orderNote}
                visibleMenuItems={visibleMenuItems}
                onBack={() => setScreen("welcome")}
                onCategoryChange={setActiveCategory}
                onNoteChange={setOrderNote}
                onQuantityChange={updateCart}
                onSendOrder={sendOrder}
              />
            )}

            {screen === "orderSuccess" && (
              <OrderSuccessScreen
                orderNumber={submittedOrder?.orderNumber}
                onHome={resetDemo}
                onPayment={() => setScreen("payment")}
              />
            )}

            {screen === "payment" && (
              <PaymentScreen
                paymentMode={paymentMode}
                selectedItemIds={selectedItemIds}
                tip={tip}
                receiptRequested={receiptRequested}
                subtotal={subtotal}
                tipAmount={tipAmount}
                payableTotal={payableTotal}
                remainingTotal={remainingTotal}
                paymentError={paymentError}
                restaurantName={restaurant.name}
                onBack={() => setScreen("welcome")}
                onModeChange={handlePaymentModeChange}
                onToggleItem={toggleBillItem}
                onTipChange={setTip}
                onReceiptChange={() => setReceiptRequested((value) => !value)}
                onSecurePayment={openPaymentForm}
              />
            )}

            {screen === "paymentForm" && (
              <PaymentFormScreen
                payableTotal={payableTotal}
                paymentError={paymentError}
                submitting={paymentSubmitting}
                restaurantName={restaurant.name}
                onBack={() => setScreen("payment")}
                onConfirm={completePayment}
              />
            )}

            {screen === "paymentSuccess" && (
              <PaymentSuccessScreen
                payment={completedPayment}
                payableTotal={completedPayment?.amount ?? payableTotal}
                receiptRequested={completedPayment?.receiptRequested ?? receiptRequested}
                onReset={resetDemo}
              />
            )}
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="mb-8">
            <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
              WexPay müşteri demosu
            </span>
            <h2 className="mb-4 max-w-xl text-4xl font-bold tracking-tight text-slate-950">
              QR menü, sipariş ve ödeme deneyimini tek akışta gösterin
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">
              Bu demo, QR kod okutan müşterinin karşılama ekranından menüye, siparişten masa
              hesabı ödemesine kadar tüm WexPay deneyimini gösterir.
            </p>
          </div>

          <div className="grid gap-4">
            {explanationCards.map((card) => (
              <div key={card.title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 h-2 w-10 rounded-full bg-[#5dff65]" />
                <h3 className="mb-2 text-lg font-bold text-slate-950">{card.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{card.description}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

function RestaurantHeader({ badge, restaurantName }: { badge: string; restaurantName: string }) {
  return (
    <header className="mb-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#5dff65]">{restaurantName}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Masa 12</h1>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {badge}
        </span>
      </div>
    </header>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center text-sm font-semibold text-slate-500 transition-colors hover:text-slate-950"
    >
      ← {label}
    </button>
  );
}

function WelcomeScreen({
  restaurantName,
  onOrder,
  onPayment,
}: {
  restaurantName: string;
  onOrder: () => void;
  onPayment: () => void;
}) {
  return (
    <section>
      <RestaurantHeader badge="WexPay QR Menü ve Ödeme" restaurantName={restaurantName} />
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-3 text-xs font-semibold text-[#5dff65]">WexPay</p>
        <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-950">Hoş geldiniz</h2>
        <p className="mb-8 text-sm leading-relaxed text-slate-600">
          Menüyü inceleyebilir, sipariş oluşturabilir veya mevcut masa hesabınızı güvenli şekilde
          ödeyebilirsiniz.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={onOrder}
            className="w-full rounded-2xl bg-[#5dff65] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#5dff65]/20 transition-colors hover:bg-[#48e050]"
          >
            Sipariş Vermek İstiyorum
          </button>
          <button
            type="button"
            onClick={onPayment}
            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
          >
            Hesap Ödemek İstiyorum
          </button>
        </div>
      </div>
    </section>
  );
}

function MenuScreen({
  activeCategory,
  cart,
  cartItems,
  cartTotal,
  categories,
  loading,
  hasError,
  restaurantName,
  orderError,
  orderSubmitting,
  orderNote,
  visibleMenuItems,
  onBack,
  onCategoryChange,
  onNoteChange,
  onQuantityChange,
  onSendOrder,
}: {
  activeCategory: Category;
  cart: Record<string, number>;
  cartItems: Array<MenuItem & { quantity: number }>;
  cartTotal: number;
  categories: Category[];
  loading: boolean;
  hasError: boolean;
  restaurantName: string;
  orderError: string;
  orderSubmitting: boolean;
  orderNote: string;
  visibleMenuItems: MenuItem[];
  onBack: () => void;
  onCategoryChange: (category: Category) => void;
  onNoteChange: (note: string) => void;
  onQuantityChange: (itemId: string, change: number) => void;
  onSendOrder: () => void;
}) {
  return (
    <section>
      <BackButton label="Ana ekrana dön" onClick={onBack} />
      <RestaurantHeader badge="QR menü" restaurantName={restaurantName} />
      <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
        Menü verileri işletme panelindeki canlı demo verilerinden okunur.
      </p>
      {loading && (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
          Menü yükleniyor...
        </p>
      )}
      {hasError && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          Menü yüklenirken bir sorun oluştu.
        </p>
      )}
      {!loading && !hasError && (
        <>
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onCategoryChange(category)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${
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
        {visibleMenuItems.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
            Bu kategoride gösterilecek ürün bulunmuyor.
          </p>
        )}
        {visibleMenuItems.map((item) => {
          const quantity = cart[item.id] ?? 0;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
                item.inStock ? "" : "opacity-60"
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <MenuItemThumbnail item={item} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-950">{item.name}</h2>
                      {!item.inStock && (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700">
                          Stokta Yok
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold text-slate-950">{formatPrice(item.price)}</p>
              </div>
              <QuantityControl
                quantity={quantity}
                onMinus={() => onQuantityChange(item.id, -1)}
                onPlus={() => onQuantityChange(item.id, 1)}
                disabled={!item.inStock}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-950">Sepet</h3>
        {cartItems.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Henüz ürün seçilmedi.</p>
        ) : (
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-950">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.quantity} adet</p>
                </div>
                <p className="font-bold text-slate-950">{formatPrice(item.quantity * item.price)}</p>
              </div>
            ))}
          </div>
        )}
        <input
          value={orderNote}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Sipariş notu ekleyin"
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
        />
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="text-sm font-semibold text-slate-500">Sepet toplamı</span>
          <span className="text-xl font-bold text-slate-950">{formatPrice(cartTotal)}</span>
        </div>
        {orderError && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {orderError}
          </p>
        )}
        <button
          type="button"
          onClick={onSendOrder}
          disabled={orderSubmitting}
          className="mt-4 w-full rounded-2xl bg-[#5dff65] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#5dff65]/20 transition-colors hover:bg-[#48e050] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {orderSubmitting ? "Sipariş gönderiliyor..." : "Siparişi Gönder"}
        </button>
      </div>
        </>
      )}
    </section>
  );
}

function QuantityControl({
  quantity,
  onMinus,
  onPlus,
  disabled,
}: {
  quantity: number;
  onMinus: () => void;
  onPlus: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onMinus}
        disabled={quantity === 0 || disabled}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
      >
        -
      </button>
      <span className="min-w-6 text-center text-sm font-bold text-slate-950">{quantity}</span>
      <button
        type="button"
        onClick={onPlus}
        disabled={disabled}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5dff65] text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        +
      </button>
    </div>
  );
}

function MenuItemThumbnail({ item }: { item: MenuItem }) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
          Görsel yok
        </div>
      )}
    </div>
  );
}

function OrderSuccessScreen({
  orderNumber,
  onHome,
  onPayment,
}: {
  orderNumber?: string;
  onHome: () => void;
  onPayment: () => void;
}) {
  return (
    <section className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-[#5dff65]">
        ✓
      </div>
      <h2 className="mb-2 text-2xl font-bold text-slate-950">Siparişiniz Alındı</h2>
      <p className="mb-5 text-sm leading-relaxed text-slate-600">
        Siparişiniz Mavi Bahçe Restaurant paneline iletildi.
      </p>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-950">
        Sipariş No: {orderNumber ?? "Oluşturuldu"}
      </div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={onHome}
          className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
        >
          Ana Ekrana Dön
        </button>
        <button
          type="button"
          onClick={onPayment}
          className="w-full rounded-2xl bg-[#5dff65] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#5dff65]/20 transition-colors hover:bg-[#48e050]"
        >
          Hesabı Öde
        </button>
      </div>
    </section>
  );
}

function PaymentScreen({
  paymentMode,
  selectedItemIds,
  tip,
  receiptRequested,
  subtotal,
  tipAmount,
  payableTotal,
  remainingTotal,
  paymentError,
  restaurantName,
  onBack,
  onModeChange,
  onToggleItem,
  onTipChange,
  onReceiptChange,
  onSecurePayment,
}: {
  paymentMode: PaymentMode;
  selectedItemIds: string[];
  tip: TipOption;
  receiptRequested: boolean;
  subtotal: number;
  tipAmount: number;
  payableTotal: number;
  remainingTotal: number;
  paymentError: string;
  restaurantName: string;
  onBack: () => void;
  onModeChange: (mode: PaymentMode) => void;
  onToggleItem: (itemId: string) => void;
  onTipChange: (tip: TipOption) => void;
  onReceiptChange: () => void;
  onSecurePayment: () => void;
}) {
  return (
    <section>
      <BackButton label="Ana ekrana dön" onClick={onBack} />
      <RestaurantHeader badge="QR ödeme" restaurantName={restaurantName} />
      <div className="mb-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onModeChange("selected")}
          className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
            paymentMode === "selected"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Seçili ürünleri öde
        </button>
        <button
          type="button"
          onClick={() => onModeChange("full")}
          className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
            paymentMode === "full"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Tüm hesabı öde
        </button>
      </div>

      <div className="space-y-3">
        {initialBillItems.map((item) => {
          const selected = selectedItemIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => !item.paid && onToggleItem(item.id)}
              disabled={item.paid}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors ${
                item.paid
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : selected
                    ? "border-emerald-200 bg-emerald-50/70 text-slate-950"
                    : "border-slate-200 bg-white text-slate-950 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                    selected ? "border-[#5dff65] bg-[#5dff65] text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {selected ? "✓" : ""}
                </span>
                <div>
                  <p className="text-sm font-bold">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.quantity} adet {item.paid ? "· Ödendi" : ""}
                  </p>
                </div>
              </div>
              <p className="text-sm font-bold">{formatPrice(item.quantity * item.price)}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
          Bahşiş / servis
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([0, 5, 10] as TipOption[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onTipChange(option)}
              className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold ${
                tip === option
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {option === 0 ? "Bahşiş yok" : `%${option}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-950">Fiş istiyorum</span>
          <button
            type="button"
            onClick={onReceiptChange}
            className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${
              receiptRequested ? "bg-[#5dff65]" : "bg-slate-200"
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white transition-transform ${
                receiptRequested ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
        {receiptRequested && (
          <p className="text-xs text-slate-500">Fiş talebiniz işletme paneline bildirilir.</p>
        )}
      </div>

      <PaymentSummary
        subtotal={subtotal}
        tipAmount={tipAmount}
        payableTotal={payableTotal}
        remainingTotal={remainingTotal}
      />

      {paymentError && (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {paymentError}
        </p>
      )}

      <button
        type="button"
        onClick={onSecurePayment}
        className="mt-5 w-full rounded-2xl bg-[#5dff65] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#5dff65]/20 transition-colors hover:bg-[#48e050]"
      >
        Güvenli Ödeme Yap
      </button>
    </section>
  );
}

function PaymentFormScreen({
  payableTotal,
  paymentError,
  submitting,
  restaurantName,
  onBack,
  onConfirm,
}: {
  payableTotal: number;
  paymentError: string;
  submitting: boolean;
  restaurantName: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="space-y-4">
      <BackButton label="Ödeme ekranına dön" onClick={onBack} />
      <RestaurantHeader badge="Güvenli ödeme" restaurantName={restaurantName} />
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-4 text-sm font-bold text-slate-950">Kart bilgileri</p>
        <div className="space-y-3">
          <MockField label="Kart üzerindeki isim" value="MERT YILMAZ" />
          <MockField label="Maskeli kart numarası" value="**** **** **** 4821" />
          <MockField label="Tutar" value={formatPrice(payableTotal)} />
        </div>
      </div>
      {paymentError && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {paymentError}
        </p>
      )}
      <button
        type="button"
        onClick={onConfirm}
        disabled={submitting}
        className="w-full rounded-2xl bg-[#5dff65] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#5dff65]/20 transition-colors hover:bg-[#48e050] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {submitting ? "Ödeme tamamlanıyor..." : "Ödemeyi Tamamla"}
      </button>
    </section>
  );
}

function PaymentSuccessScreen({
  payment,
  payableTotal,
  receiptRequested,
  onReset,
}: {
  payment: CreatedPaymentResponse | null;
  payableTotal: number;
  receiptRequested: boolean;
  onReset: () => void;
}) {
  return (
    <section className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-[#5dff65]">
        ✓
      </div>
      <h2 className="mb-2 text-2xl font-bold text-slate-950">Ödeme Başarılı</h2>
      <p className="mb-5 text-sm text-slate-600">Ödeme bilginiz restoran paneline iletildi.</p>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-left">
        <SummaryRow label="İşlem no" value={payment?.transactionId ?? "Demo ödeme"} />
        <SummaryRow label="Ödenen tutar" value={formatPrice(payableTotal)} strong />
        <SummaryRow label="Fiş talebi" value={receiptRequested ? "Talep edildi" : "Talep edilmedi"} />
      </div>
      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
      >
        Demo Akışını Yeniden Başlat
      </button>
    </section>
  );
}

function PaymentSummary({
  subtotal,
  tipAmount,
  payableTotal,
  remainingTotal,
}: {
  subtotal: number;
  tipAmount: number;
  payableTotal: number;
  remainingTotal: number;
}) {
  return (
    <div className="mt-5 rounded-2xl bg-[#08111f] p-4 text-white">
      <SummaryRow label="Ara toplam" value={formatPrice(subtotal)} dark />
      <SummaryRow label="Bahşiş" value={formatPrice(tipAmount)} dark />
      <div className="my-3 h-px bg-white/10" />
      <SummaryRow label="Ödenecek toplam" value={formatPrice(payableTotal)} dark strong />
      <SummaryRow label="Kalan hesap" value={formatPrice(remainingTotal)} dark />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  dark,
  strong,
}: {
  label: string;
  value: string;
  dark?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm ${dark ? "text-white/60" : "text-slate-500"}`}>{label}</span>
      <span
        className={`text-sm ${
          strong ? "text-lg font-bold" : "font-semibold"
        } ${dark ? "text-white" : "text-slate-950"}`}
      >
        {value}
      </span>
    </div>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}
