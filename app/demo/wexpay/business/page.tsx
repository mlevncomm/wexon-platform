"use client";

import { useEffect, useState } from "react";
type BusinessTab =
  | "genel"
  | "masalar"
  | "siparisler"
  | "menu"
  | "odemeler"
  | "raporlar"
  | "lisans"
  | "ayarlar";

type OrderStatus = "Yeni" | "Hazırlanıyor" | "Servis Edildi" | "İptal Edildi";
type ApiOrderStatus = "NEW" | "PREPARING" | "SERVED" | "CANCELLED";
type PaymentStatus = "Başarılı" | "Bekliyor" | "Başarısız" | "İade";
type TableStatus =
  | "Boş"
  | "Dolu"
  | "Sipariş Var"
  | "Ödeme Bekliyor"
  | "Kısmi Ödendi"
  | "Ödendi"
  | "Fiş Talep Edildi";
type OrderFilter = "Tümü" | OrderStatus;
type TableFilter = "Tümü" | TableStatus;
type ProductCategoryFilter = "Tümü" | string;
type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface DemoNotification {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  time: string;
}

interface OrderLine {
  id?: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  lineTotal?: number;
}

interface Order {
  id: string;
  orderNumber: string;
  table: string;
  time: string;
  status: OrderStatus;
  apiStatus: ApiOrderStatus;
  items: OrderLine[];
  note: string;
  receiptRequested: boolean;
  totalAmount?: number;
  createdAt?: string;
}

interface Payment {
  id: string;
  amount: number;
  status: PaymentStatus;
  apiStatus: string;
  provider: string;
  transactionId: string;
  receiptRequested: boolean;
  createdAt: string;
  time: string;
  table: string;
  orderNumber: string | null;
}

interface RestaurantTable {
  id: string;
  name: string;
  code: string;
  status: TableStatus;
  apiStatus: string;
  qrToken: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  receiptRequested: boolean;
  activeOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    note: string | null;
    createdAt: string;
    items: OrderLine[];
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    provider: string | null;
    transactionId: string | null;
    receiptRequested: boolean;
    createdAt: string;
  }>;
}

interface Product {
  id: string;
  name: string;
  categoryId?: string;
  category: string;
  description: string | null;
  price: number;
  active: boolean;
  inStock: boolean;
  imageUrl?: string;
  popular?: boolean;
}

interface ProductForm {
  name: string;
  category: string;
  description: string;
  price: string;
  imageUrl: string;
  isPopular: boolean;
}

interface BusinessSettingsForm {
  restaurantName: string;
  branchName: string;
  phone: string;
  address: string;
  serviceFeeRate: string;
  qrOrderEnabled: boolean;
  qrPaymentEnabled: boolean;
  receiptRequestEnabled: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  active: boolean;
  sortOrder?: number;
}

interface ApiMenuResponse {
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
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
    categoryId: string;
    categoryName: string;
    price: number;
    imageUrl: string | null;
    isActive: boolean;
    inStock: boolean;
    isPopular: boolean;
  }>;
}

interface ApiOrdersResponse {
  orders: ApiOrder[];
}

interface ApiPaymentsResponse {
  payments: ApiPayment[];
}

interface ApiTablesResponse {
  tables: ApiTable[];
}

interface ApiNotificationsResponse {
  notifications: ApiNotification[];
}

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface ApiOrder {
  id: string;
  orderNumber: string;
  status: ApiOrderStatus;
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

interface ApiPayment {
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

interface ApiTable {
  id: string;
  name: string;
  code: string;
  status: string;
  qrToken: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  receiptRequested: boolean;
  activeOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    note: string | null;
    createdAt: string;
    items: Array<{
      id: string;
      productId: string;
      name: string;
      quantity: number;
      price: number;
      lineTotal: number;
    }>;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    provider: string | null;
    transactionId: string | null;
    receiptRequested: boolean;
    createdAt: string;
  }>;
}

const tabs: { label: string; value: BusinessTab }[] = [
  { label: "Genel Bakış", value: "genel" },
  { label: "Masalar", value: "masalar" },
  { label: "Siparişler", value: "siparisler" },
  { label: "Menü", value: "menu" },
  { label: "Ödemeler", value: "odemeler" },
  { label: "Raporlar", value: "raporlar" },
  { label: "Paket / Lisans", value: "lisans" },
  { label: "Ayarlar", value: "ayarlar" },
];

const overviewMetrics = [
  { label: "Bugünkü toplam ödeme", value: "18.740 TL", detail: "124 işlem" },
  { label: "Aktif masalar", value: "14", detail: "75 masa limitinden" },
  { label: "Fiş talepleri", value: "5", detail: "Panelden işlem bekliyor" },
  { label: "Ortalama adisyon", value: "420 TL", detail: "Bugünkü ortalama" },
];

const topProducts = [
  { name: "Izgara Tavuk", count: "32 satış", amount: "12.480 TL" },
  { name: "Avokado Tost", count: "24 satış", amount: "7.440 TL" },
  { name: "Türk Kahvesi", count: "41 satış", amount: "3.690 TL" },
  { name: "San Sebastian", count: "18 satış", amount: "3.960 TL" },
];

const apiOrderStatusMap: Record<ApiOrderStatus, OrderStatus> = {
  NEW: "Yeni",
  PREPARING: "Hazırlanıyor",
  SERVED: "Servis Edildi",
  CANCELLED: "İptal Edildi",
};

const orderStatusApiMap: Record<OrderStatus, ApiOrderStatus> = {
  Yeni: "NEW",
  Hazırlanıyor: "PREPARING",
  "Servis Edildi": "SERVED",
  "İptal Edildi": "CANCELLED",
};

function mapPaymentStatus(status: string): PaymentStatus {
  if (status === "PAID" || status === "SUCCEEDED") return "Başarılı";
  if (status === "PENDING") return "Bekliyor";
  if (status === "FAILED") return "Başarısız";
  if (status === "REFUNDED") return "İade";
  return "Bekliyor";
}

function mapTableStatus(status: string): TableStatus {
  if (status === "EMPTY") return "Boş";
  if (status === "OCCUPIED") return "Dolu";
  if (status === "ORDERING") return "Sipariş Var";
  if (status === "PAYMENT_PENDING") return "Ödeme Bekliyor";
  if (status === "PARTIALLY_PAID") return "Kısmi Ödendi";
  if (status === "PAID") return "Ödendi";
  if (status === "RECEIPT_REQUESTED") return "Fiş Talep Edildi";
  return "Boş";
}

function mapNotificationType(type: string) {
  if (type === "ORDER_CREATED" || type === "ORDER_UPDATED" || type === "ORDER") return "Sipariş";
  if (type === "PAYMENT_RECEIVED" || type === "PAYMENT") return "Ödeme";
  if (type === "RECEIPT_REQUESTED" || type === "RECEIPT") return "Fiş";
  if (type === "MENU_UPDATED" || type === "MENU") return "Menü";
  if (type === "TABLE_UPDATED" || type === "SYSTEM") return "Sistem";
  return type;
}

const initialOrders: Order[] = [
  {
    id: "WX-1248",
    orderNumber: "WX-1248",
    table: "Masa 12",
    time: "18:32",
    status: "Yeni",
    apiStatus: "NEW",
    items: [
      { name: "Izgara Tavuk", quantity: 2, price: 390 },
      { name: "Limonata", quantity: 2, price: 95 },
    ],
    note: "Tavuklardan biri sossuz olsun.",
    receiptRequested: true,
  },
  {
    id: "WX-1247",
    orderNumber: "WX-1247",
    table: "Masa 03",
    time: "18:28",
    status: "Hazırlanıyor",
    apiStatus: "PREPARING",
    items: [
      { name: "Mercimek Çorbası", quantity: 2, price: 120 },
      { name: "Mevsim Salata", quantity: 1, price: 160 },
    ],
    note: "Çorbalar çok sıcak gelsin.",
    receiptRequested: false,
  },
  {
    id: "WX-1246",
    orderNumber: "WX-1246",
    table: "Masa 07",
    time: "18:21",
    status: "Yeni",
    apiStatus: "NEW",
    items: [
      { name: "Avokado Tost", quantity: 1, price: 310 },
      { name: "Türk Kahvesi", quantity: 2, price: 90 },
    ],
    note: "Kahveler az şekerli.",
    receiptRequested: false,
  },
  {
    id: "WX-1245",
    orderNumber: "WX-1245",
    table: "Masa 16",
    time: "18:15",
    status: "Servis Edildi",
    apiStatus: "SERVED",
    items: [
      { name: "San Sebastian", quantity: 2, price: 220 },
      { name: "Limonata", quantity: 1, price: 95 },
    ],
    note: "Tatlılar servis sonrası gelsin.",
    receiptRequested: true,
  },
  {
    id: "WX-1244",
    orderNumber: "WX-1244",
    table: "Masa 12",
    time: "18:08",
    status: "Hazırlanıyor",
    apiStatus: "PREPARING",
    items: [
      { name: "Mercimek Çorbası", quantity: 1, price: 120 },
      { name: "Izgara Tavuk", quantity: 1, price: 390 },
    ],
    note: "Ekmek ilave edilsin.",
    receiptRequested: false,
  },
  {
    id: "WX-1243",
    orderNumber: "WX-1243",
    table: "Masa 03",
    time: "17:54",
    status: "İptal Edildi",
    apiStatus: "CANCELLED",
    items: [{ name: "Türk Kahvesi", quantity: 3, price: 90 }],
    note: "Müşteri masadan ayrıldı.",
    receiptRequested: false,
  },
  {
    id: "WX-1242",
    orderNumber: "WX-1242",
    table: "Masa 07",
    time: "17:42",
    status: "Servis Edildi",
    apiStatus: "SERVED",
    items: [
      { name: "Avokado Tost", quantity: 2, price: 310 },
      { name: "Mevsim Salata", quantity: 1, price: 160 },
    ],
    note: "Salata sosu ayrı gelsin.",
    receiptRequested: true,
  },
  {
    id: "WX-1241",
    orderNumber: "WX-1241",
    table: "Masa 16",
    time: "17:36",
    status: "Yeni",
    apiStatus: "NEW",
    items: [
      { name: "San Sebastian", quantity: 1, price: 220 },
      { name: "Türk Kahvesi", quantity: 2, price: 90 },
      { name: "Limonata", quantity: 1, price: 95 },
    ],
    note: "Tatlı ortaya servis edilsin.",
    receiptRequested: false,
  },
];

const initialCategories: MenuCategory[] = [
  { id: "starters", name: "Başlangıçlar", active: true },
  { id: "mains", name: "Ana Yemekler", active: true },
  { id: "drinks", name: "İçecekler", active: true },
  { id: "desserts", name: "Tatlılar", active: true },
  { id: "breakfast", name: "Kahvaltı", active: true },
];

const emptyProductForm: ProductForm = {
  name: "",
  category: "Ana Yemekler",
  description: "",
  price: "",
  imageUrl: "",
  isPopular: false,
};

const initialProducts: Product[] = [
  {
    id: "soup",
    name: "Mercimek Çorbası",
    category: "Başlangıçlar",
    description: "Günlük hazırlanmış sıcak başlangıç.",
    price: 120,
    active: true,
    inStock: true,
    imageUrl: "",
    popular: true,
  },
  {
    id: "grilled-chicken",
    name: "Izgara Tavuk",
    category: "Ana Yemekler",
    description: "Mevsim garnitürü ve özel sos ile servis edilir.",
    price: 390,
    active: true,
    inStock: true,
    imageUrl: "",
    popular: true,
  },
  {
    id: "avocado-toast",
    name: "Avokado Tost",
    category: "Ana Yemekler",
    description: "Ekşi mayalı ekmek, avokado ve taze yeşillikler.",
    price: 310,
    active: true,
    inStock: true,
    imageUrl: "",
    popular: true,
  },
  {
    id: "salad",
    name: "Mevsim Salata",
    category: "Başlangıçlar",
    description: "Taze yeşillikler, domates, salatalık ve zeytinyağı.",
    price: 160,
    active: true,
    inStock: true,
  },
  {
    id: "coffee",
    name: "Türk Kahvesi",
    category: "İçecekler",
    description: "Geleneksel fincanda, lokum ile servis edilir.",
    price: 90,
    active: true,
    inStock: true,
    popular: true,
  },
  {
    id: "lemonade",
    name: "Limonata",
    category: "İçecekler",
    description: "Ev yapımı ferah limonata.",
    price: 95,
    active: true,
    inStock: true,
  },
  {
    id: "san-sebastian",
    name: "San Sebastian",
    category: "Tatlılar",
    description: "Kremamsı cheesecake, çikolata sos ile.",
    price: 220,
    active: true,
    inStock: true,
    popular: true,
  },
  {
    id: "cheeseburger",
    name: "Cheeseburger",
    category: "Ana Yemekler",
    description: "Dana köfte, cheddar ve özel burger sosu.",
    price: 340,
    active: true,
    inStock: false,
  },
  {
    id: "truffle-fries",
    name: "Trüflü Patates",
    category: "Başlangıçlar",
    description: "Trüf aromalı çıtır patates ve parmesan.",
    price: 210,
    active: false,
    inStock: true,
  },
  {
    id: "iced-tea",
    name: "Soğuk Çay",
    category: "İçecekler",
    description: "Şeftali aromalı soğuk çay.",
    price: 85,
    active: true,
    inStock: true,
  },
];

function isToday(dateValue: string) {
  const date = new Date(dateValue);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function mapApiMenu(data: ApiMenuResponse) {
  return {
    categories: data.categories.map((category) => ({
      id: category.id,
      name: category.name,
      active: category.isActive,
      sortOrder: category.sortOrder,
    })),
    products: data.products.map((product) => ({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      category: product.categoryName,
      description: product.description,
      price: product.price,
      active: product.isActive,
      inStock: product.inStock,
      imageUrl: product.imageUrl ?? "",
      popular: product.isPopular,
    })),
  };
}

function formatOrderTime(createdAt: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function mapApiOrder(order: ApiOrder): Order {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    table: order.table.name,
    time: formatOrderTime(order.createdAt),
    status: apiOrderStatusMap[order.status],
    apiStatus: order.status,
    note: order.note ?? "Not yok",
    receiptRequested: order.receiptRequested,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      lineTotal: item.lineTotal,
    })),
  };
}

function mapApiPayment(payment: ApiPayment): Payment {
  return {
    id: payment.id,
    amount: payment.amount,
    status: mapPaymentStatus(payment.status),
    apiStatus: payment.status,
    provider: payment.provider ?? "MOCK",
    transactionId: payment.transactionId ?? payment.id,
    receiptRequested: payment.receiptRequested,
    createdAt: payment.createdAt,
    time: formatOrderTime(payment.createdAt),
    table: payment.table.name,
    orderNumber: payment.order?.orderNumber ?? null,
  };
}

function mapApiTable(table: ApiTable): RestaurantTable {
  return {
    id: table.id,
    name: table.name,
    code: table.code,
    status: table.receiptRequested ? "Fiş Talep Edildi" : mapTableStatus(table.status),
    apiStatus: table.status,
    qrToken: table.qrToken,
    totalAmount: table.totalAmount,
    paidAmount: table.paidAmount,
    remainingAmount: table.remainingAmount,
    receiptRequested: table.receiptRequested,
    activeOrders: table.activeOrders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        lineTotal: item.lineTotal,
      })),
    })),
    payments: table.payments,
  };
}

function mapApiNotification(notification: ApiNotification): DemoNotification {
  return {
    id: notification.id,
    type: notification.type,
    typeLabel: mapNotificationType(notification.type),
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    time: formatOrderTime(notification.createdAt),
  };
}

export default function WexPayBusinessDemoPage() {
  const [activeTab, setActiveTab] = useState<BusinessTab>("genel");
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrders[0].id);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("Tümü");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState(false);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [tableFilter, setTableFilter] = useState<TableFilter>("Tümü");
  const [tableSearch, setTableSearch] = useState("");
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState(false);
  const [tableActionLoading, setTableActionLoading] = useState<"receipt" | "close" | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedProductId, setSelectedProductId] = useState(initialProducts[0].id);
  const [productFilter, setProductFilter] = useState<ProductCategoryFilter>("Tümü");
  const [productSearch, setProductSearch] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategories[0].id);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [notifications, setNotifications] = useState<DemoNotification[]>([]);
  const [notificationsError, setNotificationsError] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsForm>({
    restaurantName: "Mavi Bahçe Restaurant",
    branchName: "Merkez Şube",
    phone: "+90 212 555 10 20",
    address: "Bağdat Caddesi No: 128, Kadıköy / İstanbul",
    serviceFeeRate: "10",
    qrOrderEnabled: true,
    qrPaymentEnabled: true,
    receiptRequestEnabled: true,
  });

  const pendingOrderCount = orders.filter(
    (order) => order.status === "Yeni" || order.status === "Hazırlanıyor",
  ).length;
  const successfulPayments = payments.filter((payment) => payment.status === "Başarılı");
  const todayPaymentTotal = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const receiptRequestCount = payments.filter((payment) => payment.receiptRequested).length;
  const activeTableCount = tables.filter((table) => table.status !== "Boş").length;
  const tableReceiptRequestCount = tables.filter((table) => table.receiptRequested).length;

  async function loadOrdersData() {
    try {
      setOrdersLoading(true);
      setOrdersError(false);

      const response = await fetch("/api/wexpay/demo/orders");
      if (!response.ok) throw new Error("Siparişler alınamadı.");

      const data = (await response.json()) as ApiOrdersResponse;
      const mappedOrders = data.orders.map(mapApiOrder);
      setOrders(mappedOrders);
      setSelectedOrderId((current) => mappedOrders.some((order) => order.id === current) ? current : mappedOrders[0]?.id ?? "");
    } catch {
      setOrdersError(true);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadNotifications({ notify = false }: { notify?: boolean } = {}) {
    try {
      setNotificationsError(false);

      const response = await fetch("/api/wexpay/demo/notifications");
      if (!response.ok) throw new Error("Bildirimler alınamadı.");

      const data = (await response.json()) as ApiNotificationsResponse;
      setNotifications(data.notifications.map(mapApiNotification));

      if (notify) showToast("success", "Bildirimler güncellendi.");
    } catch {
      setNotificationsError(true);
      if (notify) showToast("error", "İşlem sırasında bir sorun oluştu.");
    }
  }

  async function loadTablesData({ notify = false }: { notify?: boolean } = {}) {
    try {
      setTablesLoading(true);
      setTablesError(false);

      const response = await fetch("/api/wexpay/demo/tables");
      if (!response.ok) throw new Error("Masa verileri alınamadı.");

      const data = (await response.json()) as ApiTablesResponse;
      const mappedTables = data.tables.map(mapApiTable);
      setTables(mappedTables);
      setSelectedTableId((current) => mappedTables.some((table) => table.id === current) ? current : mappedTables[0]?.id ?? "");

      if (notify) showToast("success", "Masa verileri güncellendi.");
    } catch {
      setTablesError(true);
      if (notify) showToast("error", "İşlem sırasında bir sorun oluştu.");
    } finally {
      setTablesLoading(false);
    }
  }

  function updateTableState(table: RestaurantTable) {
    setTables((current) => current.map((item) => (item.id === table.id ? table : item)));
    setSelectedTableId(table.id);
  }

  async function markTableReceiptPrinted(tableId: string) {
    try {
      setTableActionLoading("receipt");

      const response = await fetch(`/api/wexpay/demo/tables/${tableId}/receipt-printed`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Fiş işlemi başarısız.");

      const table = mapApiTable((await response.json()) as ApiTable);
      updateTableState(table);
      await loadNotifications();
      showToast("success", "Fiş yazdırıldı olarak işaretlendi.");
    } catch {
      showToast("error", "Fiş işlemi sırasında bir sorun oluştu.");
    } finally {
      setTableActionLoading(null);
    }
  }

  async function closeTable(tableId: string) {
    try {
      setTableActionLoading("close");

      const response = await fetch(`/api/wexpay/demo/tables/${tableId}/close`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Masa kapatılamadı.");

      const table = mapApiTable((await response.json()) as ApiTable);
      updateTableState(table);
      await loadNotifications();
      showToast("success", "Masa kapatıldı.");
    } catch {
      showToast("error", "Masa kapatılırken bir sorun oluştu.");
    } finally {
      setTableActionLoading(null);
    }
  }

  async function loadPaymentsData({ notify = false }: { notify?: boolean } = {}) {
    try {
      setPaymentsLoading(true);
      setPaymentsError(false);

      const response = await fetch("/api/wexpay/demo/payments");
      if (!response.ok) throw new Error("Ödemeler alınamadı.");

      const data = (await response.json()) as ApiPaymentsResponse;
      setPayments(data.payments.map(mapApiPayment));

      if (notify) await loadNotifications();
      if (notify) showToast("success", "Ödemeler güncellendi.");
    } catch {
      setPaymentsError(true);
      if (notify) showToast("error", "İşlem sırasında bir sorun oluştu.");
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    try {
      const response = await fetch(`/api/wexpay/demo/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: orderStatusApiMap[status] }),
      });
      if (!response.ok) throw new Error("Sipariş durumu güncellenemedi.");

      const updatedOrder = mapApiOrder((await response.json()) as ApiOrder);
      setOrders((current) => current.map((item) => (item.id === orderId ? updatedOrder : item)));
      setSelectedOrderId(updatedOrder.id);
      await loadNotifications();
      showToast("success", "Sipariş durumu güncellendi.");
    } catch {
      showToast("error", "İşlem sırasında bir sorun oluştu.");
    }
  }

  function showToast(type: ToastType, message: string) {
    setToast({ id: Date.now(), type, message });
  }

  function updateBusinessSettings(field: keyof BusinessSettingsForm, value: string | boolean) {
    setBusinessSettings((current) => ({ ...current, [field]: value }));
  }

  function saveBusinessSettings() {
    const createdAt = new Date().toISOString();

    setNotifications((current) => [
      {
        id: `local-settings-${Date.now()}`,
        type: "SYSTEM",
        typeLabel: "Sistem",
        title: "İşletme ayarları güncellendi.",
        message: "İşletme ayarları güncellendi.",
        isRead: false,
        createdAt,
        time: formatOrderTime(createdAt),
      },
      ...current.slice(0, 19),
    ]);
    showToast("success", "İşletme ayarları kaydedildi.");
  }

  async function resetDemoData() {
    const confirmed = window.confirm(
      "Demo siparişleri, ödemeleri, fiş talepleri ve bildirimleri sıfırlanacak. Devam etmek istiyor musunuz?",
    );
    if (!confirmed) return;

    try {
      const response = await fetch("/api/wexpay/demo/reset", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Demo verileri sıfırlanamadı.");

      await Promise.all([
        loadNotifications(),
        refreshReportsData(),
      ]);
      showToast("success", "Demo verileri sıfırlandı.");
    } catch {
      showToast("error", "Demo verileri sıfırlanırken bir sorun oluştu.");
    }
  }

  async function refreshReportsData({ notify = false }: { notify?: boolean } = {}) {
    await Promise.all([
      loadOrdersData(),
      loadPaymentsData(),
      loadTablesData(),
      loadMenuData(),
    ]);
    if (notify) showToast("success", "Raporlar güncellendi.");
  }

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrdersFromApi() {
      try {
        setOrdersLoading(true);
        setOrdersError(false);

        const response = await fetch("/api/wexpay/demo/orders");
        if (!response.ok) throw new Error("Siparişler alınamadı.");

        const data = (await response.json()) as ApiOrdersResponse;
        const mappedOrders = data.orders.map(mapApiOrder);

        if (cancelled) return;
        setOrders(mappedOrders);
        setSelectedOrderId((current) => mappedOrders.some((order) => order.id === current) ? current : mappedOrders[0]?.id ?? "");
      } catch {
        if (!cancelled) setOrdersError(true);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }

    async function loadPaymentsFromApi() {
      try {
        setPaymentsLoading(true);
        setPaymentsError(false);

        const response = await fetch("/api/wexpay/demo/payments");
        if (!response.ok) throw new Error("Ödemeler alınamadı.");

        const data = (await response.json()) as ApiPaymentsResponse;

        if (cancelled) return;
        setPayments(data.payments.map(mapApiPayment));
      } catch {
        if (!cancelled) setPaymentsError(true);
      } finally {
        if (!cancelled) setPaymentsLoading(false);
      }
    }

    async function loadTablesFromApi() {
      try {
        setTablesLoading(true);
        setTablesError(false);

        const response = await fetch("/api/wexpay/demo/tables");
        if (!response.ok) throw new Error("Masa verileri alınamadı.");

        const data = (await response.json()) as ApiTablesResponse;
        const mappedTables = data.tables.map(mapApiTable);

        if (cancelled) return;
        setTables(mappedTables);
        setSelectedTableId((current) => mappedTables.some((table) => table.id === current) ? current : mappedTables[0]?.id ?? "");
      } catch {
        if (!cancelled) setTablesError(true);
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    }

    async function loadNotificationsFromApi() {
      try {
        setNotificationsError(false);

        const response = await fetch("/api/wexpay/demo/notifications");
        if (!response.ok) throw new Error("Bildirimler alınamadı.");

        const data = (await response.json()) as ApiNotificationsResponse;

        if (cancelled) return;
        setNotifications(data.notifications.map(mapApiNotification));
      } catch {
        if (!cancelled) setNotificationsError(true);
      }
    }

    void loadOrdersFromApi();
    void loadPaymentsFromApi();
    void loadTablesFromApi();
    void loadNotificationsFromApi();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "siparisler") return;

    let cancelled = false;
    async function refreshOrdersFromApi() {
      try {
        setOrdersLoading(true);
        setOrdersError(false);

        const response = await fetch("/api/wexpay/demo/orders");
        if (!response.ok) throw new Error("Siparişler alınamadı.");

        const data = (await response.json()) as ApiOrdersResponse;
        const mappedOrders = data.orders.map(mapApiOrder);

        if (cancelled) return;
        setOrders(mappedOrders);
        setSelectedOrderId((current) => mappedOrders.some((order) => order.id === current) ? current : mappedOrders[0]?.id ?? "");
      } catch {
        if (!cancelled) setOrdersError(true);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }

    void refreshOrdersFromApi();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "odemeler") return;

    let cancelled = false;
    async function refreshPaymentsFromApi() {
      try {
        setPaymentsLoading(true);
        setPaymentsError(false);

        const response = await fetch("/api/wexpay/demo/payments");
        if (!response.ok) throw new Error("Ödemeler alınamadı.");

        const data = (await response.json()) as ApiPaymentsResponse;

        if (cancelled) return;
        setPayments(data.payments.map(mapApiPayment));
      } catch {
        if (!cancelled) setPaymentsError(true);
      } finally {
        if (!cancelled) setPaymentsLoading(false);
      }
    }

    void refreshPaymentsFromApi();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "masalar") return;

    let cancelled = false;
    async function refreshTablesFromApi() {
      try {
        setTablesLoading(true);
        setTablesError(false);

        const response = await fetch("/api/wexpay/demo/tables");
        if (!response.ok) throw new Error("Masa verileri alınamadı.");

        const data = (await response.json()) as ApiTablesResponse;
        const mappedTables = data.tables.map(mapApiTable);

        if (cancelled) return;
        setTables(mappedTables);
        setSelectedTableId((current) => mappedTables.some((table) => table.id === current) ? current : mappedTables[0]?.id ?? "");
      } catch {
        if (!cancelled) setTablesError(true);
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    }

    void refreshTablesFromApi();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "raporlar") return;

    let cancelled = false;
    async function refreshReportsFromApi() {
      try {
        setOrdersLoading(true);
        setOrdersError(false);
        const response = await fetch("/api/wexpay/demo/orders");
        if (!response.ok) throw new Error("Siparişler alınamadı.");
        const data = (await response.json()) as ApiOrdersResponse;
        const mappedOrders = data.orders.map(mapApiOrder);
        if (cancelled) return;
        setOrders(mappedOrders);
        setSelectedOrderId((current) => mappedOrders.some((order) => order.id === current) ? current : mappedOrders[0]?.id ?? "");
      } catch {
        if (!cancelled) setOrdersError(true);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }

      try {
        setPaymentsLoading(true);
        setPaymentsError(false);
        const response = await fetch("/api/wexpay/demo/payments");
        if (!response.ok) throw new Error("Ödemeler alınamadı.");
        const data = (await response.json()) as ApiPaymentsResponse;
        if (cancelled) return;
        setPayments(data.payments.map(mapApiPayment));
      } catch {
        if (!cancelled) setPaymentsError(true);
      } finally {
        if (!cancelled) setPaymentsLoading(false);
      }

      try {
        setTablesLoading(true);
        setTablesError(false);
        const response = await fetch("/api/wexpay/demo/tables");
        if (!response.ok) throw new Error("Masa verileri alınamadı.");
        const data = (await response.json()) as ApiTablesResponse;
        const mappedTables = data.tables.map(mapApiTable);
        if (cancelled) return;
        setTables(mappedTables);
        setSelectedTableId((current) => mappedTables.some((table) => table.id === current) ? current : mappedTables[0]?.id ?? "");
      } catch {
        if (!cancelled) setTablesError(true);
      } finally {
        if (!cancelled) setTablesLoading(false);
      }

      try {
        setMenuLoading(true);
        setMenuError(false);
        const response = await fetch("/api/wexpay/demo/menu");
        if (!response.ok) throw new Error("Menü alınamadı.");
        const data = (await response.json()) as ApiMenuResponse;
        const mapped = mapApiMenu(data);
        if (cancelled) return;
        setCategories(mapped.categories);
        setProducts(mapped.products);
        setSelectedCategoryId((current) => mapped.categories.some((category) => category.id === current) ? current : mapped.categories[0]?.id ?? "");
        setSelectedProductId((current) => mapped.products.some((product) => product.id === current) ? current : mapped.products[0]?.id ?? "");
      } catch {
        if (!cancelled) setMenuError(true);
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    }

    void refreshReportsFromApi();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  async function loadMenuData() {
    try {
      setMenuLoading(true);
      setMenuError(false);

      const response = await fetch("/api/wexpay/demo/menu");
      if (!response.ok) throw new Error("Menü alınamadı.");

      const data = (await response.json()) as ApiMenuResponse;
      const mapped = mapApiMenu(data);

      setCategories(mapped.categories);
      setProducts(mapped.products);
      setSelectedCategoryId((current) => mapped.categories.some((category) => category.id === current) ? current : mapped.categories[0]?.id ?? "");
      setSelectedProductId((current) => mapped.products.some((product) => product.id === current) ? current : mapped.products[0]?.id ?? "");
    } catch {
      setMenuError(true);
    } finally {
      setMenuLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "menu") return;

    let cancelled = false;
    async function loadMenuFromApi() {
      try {
        setMenuLoading(true);
        setMenuError(false);

        const response = await fetch("/api/wexpay/demo/menu");
        if (!response.ok) throw new Error("Menü alınamadı.");

        const data = (await response.json()) as ApiMenuResponse;
        const mapped = mapApiMenu(data);

        if (cancelled) return;
        setCategories(mapped.categories);
        setProducts(mapped.products);
        setSelectedCategoryId((current) => mapped.categories.some((category) => category.id === current) ? current : mapped.categories[0]?.id ?? "");
        setSelectedProductId((current) => mapped.products.some((product) => product.id === current) ? current : mapped.products[0]?.id ?? "");
      } catch {
        if (!cancelled) setMenuError(true);
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    }

    void loadMenuFromApi();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  async function addProduct(form: ProductForm) {
    const price = Number(form.price);
    if (!form.name.trim() || !form.description.trim() || Number.isNaN(price) || price <= 0) return false;
    const category = categories.find((item) => item.name === form.category);
    if (!category) return false;

    try {
      const response = await fetch("/api/wexpay/demo/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          categoryId: category.id,
          price,
          imageUrl: form.imageUrl.trim() || undefined,
          isPopular: form.isPopular,
        }),
      });
      if (!response.ok) throw new Error("Ürün kaydedilemedi.");

      const product = (await response.json()) as ApiMenuResponse["products"][number];
      setSelectedProductId(product.id);
      setShowAddProduct(false);
      await loadNotifications();
      showToast("success", "Ürün kaydedildi.");
      await loadMenuData();
      return true;
    } catch {
      showToast("error", "İşlem sırasında bir sorun oluştu.");
      return false;
    }
  }

  async function updateProduct(productId: string, form: ProductForm) {
    const product = products.find((item) => item.id === productId);
    const price = Number(form.price);
    if (!product || !form.name.trim() || !form.description.trim() || Number.isNaN(price) || price <= 0) return;
    const category = categories.find((item) => item.name === form.category);
    if (!category) return;

    try {
      const response = await fetch(`/api/wexpay/demo/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          categoryId: category.id,
          price,
          imageUrl: form.imageUrl.trim(),
          isPopular: form.isPopular,
        }),
      });
      if (!response.ok) throw new Error("Ürün güncellenemedi.");

      await loadNotifications();
      showToast("success", product.price !== price ? "Fiyat güncellendi." : "Ürün değişiklikleri kaydedildi.");
      await loadMenuData();
    } catch {
      showToast("error", "İşlem sırasında bir sorun oluştu.");
    }
  }

  async function toggleProductActive(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const nextActive = !product.active;
    try {
      const response = await fetch(`/api/wexpay/demo/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!response.ok) throw new Error("Ürün durumu güncellenemedi.");

      await loadNotifications();
      showToast("success", "Ürün durumu güncellendi.");
      await loadMenuData();
    } catch {
      showToast("error", "İşlem sırasında bir sorun oluştu.");
    }
  }

  async function toggleProductStock(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const nextInStock = !product.inStock;
    try {
      const response = await fetch(`/api/wexpay/demo/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inStock: nextInStock }),
      });
      if (!response.ok) throw new Error("Stok durumu güncellenemedi.");

      await loadNotifications();
      showToast("success", "Stok durumu güncellendi.");
      await loadMenuData();
    } catch {
      showToast("error", "İşlem sırasında bir sorun oluştu.");
    }
  }

  async function addCategory(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return false;

    try {
      const response = await fetch("/api/wexpay/demo/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) throw new Error("Kategori kaydedilemedi.");

      const category = (await response.json()) as { id: string; name: string };
      setSelectedCategoryId(category.id);
      setShowAddCategory(false);
      await loadNotifications();
      showToast("success", "Kategori kaydedildi.");
      await loadMenuData();
      return true;
    } catch {
      showToast("error", "İşlem sırasında bir sorun oluştu.");
      return false;
    }
  }

  function updateCategory(categoryId: string, name: string) {
    const trimmedName = name.trim();
    const category = categories.find((item) => item.id === categoryId);
    if (!category || !trimmedName) return;

    const nextCategories = categories.map((item) =>
      item.id === categoryId ? { ...item, name: trimmedName } : item,
    );
    const nextProducts = products.map((product) =>
        product.categoryId === category.id || product.category === category.name
          ? { ...product, category: trimmedName, categoryId: category.id }
          : product,
      );
    setCategories(nextCategories);
    setProducts(nextProducts);
    if (productFilter === category.name) {
      setProductFilter(trimmedName);
    }
    showToast("success", "Kategori değişiklikleri kaydedildi.");
  }

  function toggleCategoryActive(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;

    const nextCategories = categories.map((item) =>
      item.id === categoryId ? { ...item, active: !item.active } : item,
    );
    setCategories(nextCategories);
    showToast("success", "Kategori durumu güncellendi.");
  }

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-slate-950">
      {toast && <ToastAlert toast={toast} />}

      <header className="border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1760px] px-4 py-5 sm:px-6 lg:px-8 2xl:px-10">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="mb-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                WexPay İşletme Paneli
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Mavi Bahçe Restaurant operasyon merkezi
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                QR menü, sipariş, masa, ödeme, fiş talebi, rapor ve lisans yönetimini tek panelde
                takip edin.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              Paket durumu: WexPay Standard / Aylık / Aktif
            </div>
          </div>

          <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  activeTab === tab.value
                    ? "border-emerald-200 bg-[#5dff65] text-white shadow-sm shadow-[#5dff65]/20"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1760px] px-4 py-5 sm:px-6 lg:px-8 2xl:px-10">
          {activeTab === "genel" && (
            <OverviewTab
              pendingOrderCount={pendingOrderCount}
              todayPaymentTotal={todayPaymentTotal}
              activeTableCount={activeTableCount}
              receiptRequestCount={Math.max(receiptRequestCount, tableReceiptRequestCount)}
              notifications={notifications}
              notificationsError={notificationsError}
              onRefreshNotifications={() => loadNotifications({ notify: true })}
            />
          )}
          {activeTab === "masalar" && (
            <TablesTab
              tables={tables}
              selectedTableId={selectedTableId}
              tableFilter={tableFilter}
              tableSearch={tableSearch}
              loading={tablesLoading}
              hasError={tablesError}
              actionLoading={tableActionLoading}
              onSelectTable={setSelectedTableId}
              onFilterChange={setTableFilter}
              onSearchChange={setTableSearch}
              onRefresh={() => loadTablesData({ notify: true })}
              onCloseTable={closeTable}
              onReceiptPrinted={markTableReceiptPrinted}
            />
          )}
          {activeTab === "siparisler" && (
            <OrdersTab
              orders={orders}
              selectedOrderId={selectedOrderId}
              orderFilter={orderFilter}
              loading={ordersLoading}
              hasError={ordersError}
              onSelectOrder={setSelectedOrderId}
              onFilterChange={setOrderFilter}
              onUpdateStatus={updateOrderStatus}
            />
          )}
          {activeTab === "menu" && (
            <MenuProductsTab
              categories={categories}
              products={products}
              selectedCategoryId={selectedCategoryId}
              selectedProductId={selectedProductId}
              productFilter={productFilter}
              productSearch={productSearch}
              showAddProduct={showAddProduct}
              showAddCategory={showAddCategory}
              loading={menuLoading}
              hasError={menuError}
              onSelectCategory={setSelectedCategoryId}
              onSelectProduct={setSelectedProductId}
              onFilterChange={setProductFilter}
              onSearchChange={setProductSearch}
              onToggleAddProduct={() => setShowAddProduct((value) => !value)}
              onToggleAddCategory={() => setShowAddCategory((value) => !value)}
              onAddCategory={addCategory}
              onUpdateCategory={updateCategory}
              onToggleCategoryActive={toggleCategoryActive}
              onAddProduct={addProduct}
              onUpdateProduct={updateProduct}
              onToggleActive={toggleProductActive}
              onToggleStock={toggleProductStock}
            />
          )}
          {activeTab === "odemeler" && (
            <PaymentsTab
              payments={payments}
              loading={paymentsLoading}
              hasError={paymentsError}
              onRefresh={() => loadPaymentsData({ notify: true })}
              onReceiptPrinted={() => showToast("success", "Fiş yazdırıldı olarak işaretlendi.")}
            />
          )}
          {activeTab === "raporlar" && (
            <ReportsTab
              orders={orders}
              payments={payments}
              tables={tables}
              products={products}
              loading={ordersLoading || paymentsLoading || tablesLoading || menuLoading}
              hasError={ordersError || paymentsError || tablesError || menuError}
              onRefresh={() => refreshReportsData({ notify: true })}
            />
          )}
          {activeTab === "lisans" && (
            <LicenseTab
              usedTables={tables.length}
              usedProducts={products.filter((product) => product.active).length}
            />
          )}
          {activeTab === "ayarlar" && (
            <SettingsTab
              settings={businessSettings}
              onUpdateSettings={updateBusinessSettings}
              onSaveSettings={saveBusinessSettings}
              onResetDemoData={resetDemoData}
            />
          )}
        </main>
    </div>
  );
}

function OverviewTab({
  pendingOrderCount,
  todayPaymentTotal,
  activeTableCount,
  receiptRequestCount,
  notifications,
  notificationsError,
  onRefreshNotifications,
}: {
  pendingOrderCount: number;
  todayPaymentTotal: number;
  activeTableCount: number;
  receiptRequestCount: number;
  notifications: DemoNotification[];
  notificationsError: boolean;
  onRefreshNotifications: () => void;
}) {
  const metrics = [
    {
      label: "Bugünkü toplam ödeme",
      value: formatLira(todayPaymentTotal),
      detail: "Demo QR ödemeleri",
    },
    {
      label: "Aktif masalar",
      value: String(activeTableCount),
      detail: "Boş olmayan masalar",
    },
    {
      label: "Bekleyen siparişler",
      value: String(pendingOrderCount),
      detail: "Yeni ve hazırlanıyor durumunda",
    },
    {
      label: "Fiş talepleri",
      value: String(receiptRequestCount),
      detail: "Ödemelerden gelen talepler",
    },
    overviewMetrics[3],
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">{metric.value}</p>
            <p className="mt-2 text-sm text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_360px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-950">En çok satılan ürünler</h2>
          <div className="space-y-3">
            {topProducts.map((product) => (
              <div key={product.name} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-950">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.count}</p>
                </div>
                <p className="text-sm font-bold text-slate-950">{product.amount}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-950">Son canlı olaylar</h2>
            <button
              type="button"
              onClick={onRefreshNotifications}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Bildirimleri Yenile
            </button>
          </div>
          <div className="space-y-3">
            {notificationsError && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                Bildirimler yüklenirken bir sorun oluştu.
              </div>
            )}
            {!notificationsError && notifications.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Henüz canlı olay bulunmuyor.
              </div>
            )}
            {!notificationsError && notifications.map((notification) => (
              <div key={notification.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    {notification.typeLabel}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">{notification.time}</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{notification.title}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{notification.message}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-semibold text-emerald-700">Paket durumu</p>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">WexPay Standard</h2>
          <div className="mt-5 space-y-3 text-sm font-semibold text-slate-700">
            <InfoRow label="Lisans tipi" value="Aylık" />
            <InfoRow label="Durum" value="Aktif" />
            <InfoRow label="Sanal POS" value="Bağlı" />
          </div>
        </section>
      </div>
    </div>
  );
}

function ToastAlert({ toast }: { toast: ToastMessage }) {
  const styles: Record<ToastType, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm sm:right-6">
      <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg shadow-slate-900/10 ${styles[toast.type]}`}>
        {toast.message}
      </div>
    </div>
  );
}

function TablesTab({
  tables,
  selectedTableId,
  tableFilter,
  tableSearch,
  loading,
  hasError,
  actionLoading,
  onSelectTable,
  onFilterChange,
  onSearchChange,
  onRefresh,
  onCloseTable,
  onReceiptPrinted,
}: {
  tables: RestaurantTable[];
  selectedTableId: string;
  tableFilter: TableFilter;
  tableSearch: string;
  loading: boolean;
  hasError: boolean;
  actionLoading: "receipt" | "close" | null;
  onSelectTable: (tableId: string) => void;
  onFilterChange: (filter: TableFilter) => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onCloseTable: (tableId: string) => void;
  onReceiptPrinted: (tableId: string) => void;
}) {
  const filters: TableFilter[] = [
    "Tümü",
    "Boş",
    "Dolu",
    "Ödeme Bekliyor",
    "Kısmi Ödendi",
    "Ödendi",
    "Fiş Talep Edildi",
  ];
  const search = tableSearch.trim().toLowerCase();
  const filteredTables = tables.filter((table) => {
    const matchesFilter = tableFilter === "Tümü" || table.status === tableFilter;
    const matchesSearch =
      !search ||
      table.name.toLowerCase().includes(search) ||
      table.code.toLowerCase().includes(search);

    return matchesFilter && matchesSearch;
  });
  const selectedTable =
    tables.find((table) => table.id === selectedTableId) ?? filteredTables[0] ?? tables[0];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Masalar</h2>
            <p className="text-sm text-slate-500">Masa hesaplarını, siparişleri ve ödeme durumlarını takip edin.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
          >
            Masaları Yenile
          </button>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={tableSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Masa adı veya kod ara"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onFilterChange(filter)}
                className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  tableFilter === filter
                    ? "border-emerald-200 bg-[#5dff65] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <p className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Masa verileri yükleniyor...
          </p>
        )}

        {hasError && (
          <p className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            Masa verileri yüklenirken bir sorun oluştu.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {!loading && !hasError && filteredTables.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500 md:col-span-2 2xl:col-span-3">
              Gösterilecek masa bulunmuyor.
            </p>
          )}
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              selected={table.id === selectedTable?.id}
              onSelect={() => onSelectTable(table.id)}
            />
          ))}
        </div>
      </section>

      {selectedTable ? (
        <TableDetailPanel
          table={selectedTable}
          actionLoading={actionLoading}
          onCloseTable={() => onCloseTable(selectedTable.id)}
          onReceiptPrinted={() => onReceiptPrinted(selectedTable.id)}
        />
      ) : (
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
          Masa detayı için bir masa seçin.
        </aside>
      )}
    </div>
  );
}

function TableCard({
  table,
  selected,
  onSelect,
}: {
  table: RestaurantTable;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        selected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-950">{table.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{table.code}</p>
        </div>
        <TableStatusBadge status={table.status} />
      </div>
      <div className="grid gap-2 text-xs text-slate-600">
        <InfoRow label="Toplam tutar" value={formatLira(table.totalAmount)} />
        <InfoRow label="Ödenen tutar" value={formatLira(table.paidAmount)} />
        <InfoRow label="Kalan tutar" value={formatLira(table.remainingAmount)} />
      </div>
      <div className="mt-3 flex flex-col gap-2 text-xs font-semibold text-slate-500">
        <span>Aktif sipariş: {table.activeOrders.length}</span>
        <span>Fiş talebi: {table.receiptRequested ? "Var" : "Yok"}</span>
      </div>
    </button>
  );
}

function TableDetailPanel({
  table,
  actionLoading,
  onCloseTable,
  onReceiptPrinted,
}: {
  table: RestaurantTable;
  actionLoading: "receipt" | "close" | null;
  onCloseTable: () => void;
  onReceiptPrinted: () => void;
}) {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#5dff65]">Masa detayı</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{table.name}</h2>
          <p className="mt-1 text-sm text-slate-500">QR token: {table.qrToken}</p>
        </div>
        <TableStatusBadge status={table.status} />
      </div>

      <div className="space-y-3">
        <InfoRow label="Toplam hesap" value={formatLira(table.totalAmount)} />
        <InfoRow label="Ödenen tutar" value={formatLira(table.paidAmount)} />
        <InfoRow label="Kalan tutar" value={formatLira(table.remainingAmount)} />
        <InfoRow label="Fiş talebi" value={table.receiptRequested ? "Var" : "Yok"} />
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-bold text-slate-950">Aktif siparişler</h3>
        <div className="space-y-3">
          {table.activeOrders.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              Aktif sipariş bulunmuyor.
            </p>
          )}
          {table.activeOrders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-950">{order.orderNumber}</p>
                  <p className="text-xs text-slate-500">{order.note ?? "Not yok"}</p>
                </div>
                <p className="text-sm font-bold text-slate-950">{formatLira(order.totalAmount)}</p>
              </div>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id ?? item.name} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{formatLira(item.lineTotal ?? item.quantity * item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-bold text-slate-950">Ödemeler</h3>
        <div className="space-y-2">
          {table.payments.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              Ödeme bulunmuyor.
            </p>
          )}
          {table.payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>{payment.transactionId ?? payment.provider ?? "Demo ödeme"}</span>
                <span className="font-bold text-slate-950">{formatLira(payment.amount)}</span>
              </div>
              <p className="mt-1">Fiş talebi: {payment.receiptRequested ? "Var" : "Yok"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          onClick={onReceiptPrinted}
          disabled={actionLoading !== null}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {actionLoading === "receipt" ? "Fiş işleniyor..." : "Fiş Yazdırıldı Olarak İşaretle"}
        </button>
        <button
          type="button"
          onClick={onCloseTable}
          disabled={actionLoading !== null}
          className="rounded-2xl bg-[#5dff65] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {actionLoading === "close" ? "Masa kapatılıyor..." : "Masayı Kapat"}
        </button>
      </div>
    </aside>
  );
}

function TableStatusBadge({ status }: { status: TableStatus }) {
  const styles: Record<TableStatus, string> = {
    Boş: "border-slate-200 bg-slate-100 text-slate-600",
    Dolu: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Sipariş Var": "border-amber-200 bg-amber-50 text-amber-700",
    "Ödeme Bekliyor": "border-sky-200 bg-sky-50 text-sky-700",
    "Kısmi Ödendi": "border-violet-200 bg-violet-50 text-violet-700",
    Ödendi: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Fiş Talep Edildi": "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function MenuProductsTab({
  categories,
  products,
  selectedCategoryId,
  selectedProductId,
  productFilter,
  productSearch,
  showAddProduct,
  showAddCategory,
  loading,
  hasError,
  onSelectCategory,
  onSelectProduct,
  onFilterChange,
  onSearchChange,
  onToggleAddProduct,
  onToggleAddCategory,
  onAddCategory,
  onUpdateCategory,
  onToggleCategoryActive,
  onAddProduct,
  onUpdateProduct,
  onToggleActive,
  onToggleStock,
}: {
  categories: MenuCategory[];
  products: Product[];
  selectedCategoryId: string;
  selectedProductId: string;
  productFilter: ProductCategoryFilter;
  productSearch: string;
  showAddProduct: boolean;
  showAddCategory: boolean;
  loading: boolean;
  hasError: boolean;
  onSelectCategory: (categoryId: string) => void;
  onSelectProduct: (productId: string) => void;
  onFilterChange: (filter: ProductCategoryFilter) => void;
  onSearchChange: (value: string) => void;
  onToggleAddProduct: () => void;
  onToggleAddCategory: () => void;
  onAddCategory: (name: string) => Promise<boolean>;
  onUpdateCategory: (categoryId: string, name: string) => void;
  onToggleCategoryActive: (categoryId: string) => void;
  onAddProduct: (form: ProductForm) => Promise<boolean>;
  onUpdateProduct: (productId: string, form: ProductForm) => void;
  onToggleActive: (productId: string) => void;
  onToggleStock: (productId: string) => void;
}) {
  const search = productSearch.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesCategory = productFilter === "Tümü" || product.category === productFilter;
    const matchesSearch =
      !search ||
      product.name.toLowerCase().includes(search) ||
      (product.description ?? "").toLowerCase().includes(search) ||
      product.category.toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });
  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? filteredProducts[0] ?? products[0];
  const categoryCount = categories.length;
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0];

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Toplam ürün" value={String(products.length)} detail="QR menüde tanımlı" />
        <SummaryCard
          label="Aktif ürün"
          value={String(products.filter((product) => product.active).length)}
          detail="Satışa açık"
        />
        <SummaryCard
          label="Stokta olmayan"
          value={String(products.filter((product) => !product.inStock).length)}
          detail="Geçici kapalı"
        />
        <SummaryCard label="Kategori sayısı" value={String(categoryCount)} detail="Menü grubu" />
      </section>

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold leading-relaxed text-emerald-800">
        QR menü ve temel ürün yönetimi tüm WexPay paketlerinde bulunur. Paket farkları ürün
        limiti, şube, personel, rapor ve entegrasyon seviyesine göre belirlenir.
      </div>

      {showAddProduct && <ProductAddForm categories={categories} onAddProduct={onAddProduct} />}

      {showAddCategory && <CategoryAddForm onAddCategory={onAddCategory} />}

      {loading && (
        <p className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
          Menü verileri yükleniyor...
        </p>
      )}

      {hasError && (
        <p className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 shadow-sm">
          Menü verileri yüklenirken bir sorun oluştu.
        </p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <CategoryPanel
          categories={categories}
          products={products}
          selectedCategoryId={selectedCategory.id}
          onSelectCategory={onSelectCategory}
          onToggleAddCategory={onToggleAddCategory}
          onUpdateCategory={onUpdateCategory}
          onToggleCategoryActive={onToggleCategoryActive}
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Menü / ürünler</h2>
              <p className="text-sm text-slate-500">
                QR menüde görünen ürünleri, fiyatları ve stok durumunu yönetin.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleAddProduct}
              className="inline-flex w-fit items-center justify-center rounded-2xl bg-[#5dff65] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050]"
            >
              Ürün Ekle
            </button>
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              value={productSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Ürün adı, açıklama veya kategori ara"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
            />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["Tümü", ...categories.map((category) => category.name)].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => onFilterChange(category)}
                  className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    productFilter === category
                      ? "border-emerald-200 bg-[#5dff65] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selected={product.id === selectedProduct.id}
                onSelect={() => onSelectProduct(product.id)}
                onToggleActive={() => onToggleActive(product.id)}
                onToggleStock={() => onToggleStock(product.id)}
              />
            ))}
          </div>
        </section>

        <ProductDetailPanel
          key={selectedProduct.id}
          categories={categories}
          product={selectedProduct}
          onUpdateProduct={onUpdateProduct}
          onToggleActive={onToggleActive}
          onToggleStock={onToggleStock}
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function CategoryPanel({
  categories,
  products,
  selectedCategoryId,
  onSelectCategory,
  onToggleAddCategory,
  onUpdateCategory,
  onToggleCategoryActive,
}: {
  categories: MenuCategory[];
  products: Product[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  onToggleAddCategory: () => void;
  onUpdateCategory: (categoryId: string, name: string) => void;
  onToggleCategoryActive: (categoryId: string) => void;
}) {
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Kategoriler</h2>
          <p className="text-sm text-slate-500">QR menü grupları</p>
        </div>
        <button
          type="button"
          onClick={onToggleAddCategory}
          className="rounded-2xl bg-[#5dff65] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#48e050]"
        >
          Kategori Ekle
        </button>
      </div>

      <div className="space-y-3">
        {categories.map((category) => {
          const productCount = products.filter((product) => product.category === category.name).length;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(category.id)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                selectedCategoryId === category.id
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              } ${!category.active ? "opacity-60" : ""}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-950">{category.name}</p>
                  <p className="text-xs text-slate-500">{productCount} ürün</p>
                </div>
                <Badge className={category.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}>
                  {category.active ? "Aktif" : "Pasif"}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCategory && (
        <CategoryEditForm
          key={selectedCategory.id}
          category={selectedCategory}
          onUpdateCategory={onUpdateCategory}
          onToggleCategoryActive={onToggleCategoryActive}
        />
      )}
    </section>
  );
}

function CategoryAddForm({ onAddCategory }: { onAddCategory: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">Yeni kategori ekle</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <ProductInput label="Kategori adı" value={name} onChange={setName} />
        <button
          type="button"
          onClick={async () => {
            const saved = await onAddCategory(name);
            if (saved) setName("");
          }}
          className="rounded-2xl bg-[#5dff65] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050]"
        >
          Kategoriyi Kaydet
        </button>
      </div>
    </section>
  );
}

function CategoryEditForm({
  category,
  onUpdateCategory,
  onToggleCategoryActive,
}: {
  category: MenuCategory;
  onUpdateCategory: (categoryId: string, name: string) => void;
  onToggleCategoryActive: (categoryId: string) => void;
}) {
  const [name, setName] = useState(category.name);

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <ProductInput label="Kategori adı" value={name} onChange={setName} />
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={() => onUpdateCategory(category.id, name)}
          className="rounded-2xl bg-[#5dff65] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050]"
        >
          Kategori Değişikliklerini Kaydet
        </button>
        <button
          type="button"
          onClick={() => onToggleCategoryActive(category.id)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
        >
          {category.active ? "Pasife Al" : "Aktif Et"}
        </button>
      </div>
    </div>
  );
}

function ProductAddForm({
  categories,
  onAddProduct,
}: {
  categories: MenuCategory[];
  onAddProduct: (form: ProductForm) => Promise<boolean>;
}) {
  const [form, setForm] = useState<ProductForm>(emptyProductForm);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">Yeni ürün ekle</h2>
      <div className="grid gap-3 lg:grid-cols-4">
        <ProductInput
          label="Ürün adı"
          value={form.name}
          onChange={(value) => setForm((current) => ({ ...current, name: value }))}
        />
        <ProductSelect
          categories={categories}
          label="Kategori"
          value={form.category}
          onChange={(value) => setForm((current) => ({ ...current, category: value }))}
        />
        <ProductInput
          label="Açıklama"
          value={form.description}
          onChange={(value) => setForm((current) => ({ ...current, description: value }))}
        />
        <ProductInput
          label="Fiyat"
          value={form.price}
          onChange={(value) => setForm((current) => ({ ...current, price: value }))}
          type="number"
        />
        <ProductInput
          label="Ürün görseli URL"
          value={form.imageUrl}
          onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))}
        />
        <ProductCheckbox
          label="Popüler ürün"
          checked={form.isPopular}
          onChange={(value) => setForm((current) => ({ ...current, isPopular: value }))}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Demo sürümde görsel URL ile temsil edilir. Gerçek sistemde dosya yükleme desteklenebilir.
      </p>
      <button
        type="button"
        onClick={async () => {
          const saved = await onAddProduct(form);
          if (saved) setForm(emptyProductForm);
        }}
        className="mt-4 rounded-2xl bg-[#5dff65] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050]"
      >
        Ürünü Kaydet
      </button>
    </section>
  );
}

function ProductCard({
  product,
  selected,
  onSelect,
  onToggleActive,
  onToggleStock,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onToggleActive: () => void;
  onToggleStock: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        selected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
      } ${!product.active ? "opacity-60" : ""}`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <ProductThumbnail product={product} />
            <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-950">{product.name}</h3>
              {product.popular && <Badge className="border-amber-200 bg-amber-50 text-amber-700">Popüler</Badge>}
              <Badge className={product.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}>
                {product.active ? "Aktif" : "Pasif"}
              </Badge>
              <Badge className={product.inStock ? "border-slate-200 bg-white text-slate-600" : "border-rose-200 bg-rose-50 text-rose-700"}>
                {product.inStock ? "Mevcut" : "Stokta Yok"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">{product.category}</p>
            </div>
          </div>
          <p className="text-lg font-bold text-slate-950">{formatLira(product.price)}</p>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">{product.description}</p>
      </button>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onSelect} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          Ürünü Düzenle
        </button>
        <button type="button" onClick={onToggleActive} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          Aktif/Pasif Yap
        </button>
        <button type="button" onClick={onToggleStock} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          {product.inStock ? "Stokta Yok Yap" : "Stokta Var Yap"}
        </button>
      </div>
    </div>
  );
}

function ProductDetailPanel({
  categories,
  product,
  onUpdateProduct,
  onToggleActive,
  onToggleStock,
}: {
  categories: MenuCategory[];
  product: Product;
  onUpdateProduct: (productId: string, form: ProductForm) => void;
  onToggleActive: (productId: string) => void;
  onToggleStock: (productId: string) => void;
}) {
  const [form, setForm] = useState<ProductForm>({
    name: product.name,
    category: product.category,
    description: product.description ?? "",
    price: String(product.price),
    imageUrl: product.imageUrl ?? "",
    isPopular: Boolean(product.popular),
  });

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-5">
      <div className="mb-5">
        <p className="text-xs font-semibold text-[#5dff65]">Ürün detayı</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">{product.name}</h2>
        <p className="mt-1 text-sm text-slate-500">Fiyat Güncelle · Ürünü Düzenle</p>
      </div>

      <ProductImagePreview imageUrl={form.imageUrl} />

      <div className="space-y-3">
        <ProductInput
          label="Ürün adı"
          value={form.name}
          onChange={(value) => setForm((current) => ({ ...current, name: value }))}
        />
        <ProductSelect
          categories={categories}
          label="Kategori"
          value={form.category}
          onChange={(value) => setForm((current) => ({ ...current, category: value }))}
        />
        <ProductInput
          label="Açıklama"
          value={form.description}
          onChange={(value) => setForm((current) => ({ ...current, description: value }))}
        />
        <ProductInput
          label="Fiyat"
          value={form.price}
          onChange={(value) => setForm((current) => ({ ...current, price: value }))}
          type="number"
        />
        <ProductInput
          label="Ürün görseli URL"
          value={form.imageUrl}
          onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))}
        />
        <ProductCheckbox
          label="Popüler ürün"
          checked={form.isPopular}
          onChange={(value) => setForm((current) => ({ ...current, isPopular: value }))}
        />
      </div>

      <button
        type="button"
        onClick={() => onUpdateProduct(product.id, form)}
        className="mt-5 w-full rounded-2xl bg-[#5dff65] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050]"
      >
        Değişiklikleri Kaydet
      </button>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <button
          type="button"
          onClick={() => onToggleActive(product.id)}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
        >
          Aktif/Pasif Yap
        </button>
        <button
          type="button"
          onClick={() => onToggleStock(product.id)}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
        >
          {product.inStock ? "Stokta Yok Yap" : "Stokta Var Yap"}
        </button>
      </div>
    </aside>
  );
}

function ProductInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-300 focus:bg-white"
      />
    </label>
  );
}

function ProductCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-[46px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-[#5dff65] focus:ring-emerald-300"
      />
      {label}
    </label>
  );
}

function ProductSelect({
  categories,
  label,
  value,
  onChange,
}: {
  categories: MenuCategory[];
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-300 focus:bg-white"
      >
        {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function ProductThumbnail({ product }: { product: Product }) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
          Görsel yok
        </div>
      )}
    </div>
  );
}

function ProductImagePreview({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Ürün önizleme" className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center text-sm font-semibold text-slate-400">
          Görsel yok
        </div>
      )}
    </div>
  );
}

function Badge({ className, children }: { className: string; children: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${className}`}>{children}</span>;
}

function OrdersTab({
  orders,
  selectedOrderId,
  orderFilter,
  loading,
  hasError,
  onSelectOrder,
  onFilterChange,
  onUpdateStatus,
}: {
  orders: Order[];
  selectedOrderId: string;
  orderFilter: OrderFilter;
  loading: boolean;
  hasError: boolean;
  onSelectOrder: (orderId: string) => void;
  onFilterChange: (filter: OrderFilter) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}) {
  const filters: OrderFilter[] = ["Tümü", "Yeni", "Hazırlanıyor", "Servis Edildi", "İptal Edildi"];
  const filteredOrders =
    orderFilter === "Tümü" ? orders : orders.filter((order) => order.status === orderFilter);
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? orders[0];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">QR siparişler</h2>
            <p className="text-sm text-slate-500">Müşteri masalarından gelen siparişleri takip edin.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onFilterChange(filter)}
                className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  orderFilter === filter
                    ? "border-emerald-200 bg-[#5dff65] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Siparişler yükleniyor...
          </p>
        )}

        {hasError && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            Siparişler yüklenirken bir sorun oluştu.
          </p>
        )}

        <div className="space-y-3">
          {!loading && !hasError && filteredOrders.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              Gösterilecek sipariş bulunmuyor.
            </p>
          )}
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              selected={order.id === selectedOrder.id}
              onSelect={() => onSelectOrder(order.id)}
            />
          ))}
        </div>
      </section>

      {selectedOrder ? (
        <OrderDetailPanel order={selectedOrder} onUpdateStatus={onUpdateStatus} />
      ) : (
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
          Sipariş detayı için bir sipariş seçin.
        </aside>
      )}
    </div>
  );
}

function OrderCard({
  order,
  selected,
  onSelect,
}: {
  order: Order;
  selected: boolean;
  onSelect: () => void;
}) {
  const total = getOrderTotal(order);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-950">{order.orderNumber}</h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {order.table} · {order.time} · {itemCount} adet
          </p>
        </div>
        <p className="text-lg font-bold text-slate-950">{formatLira(total)}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {order.items.map((item) => (
          <div key={item.name} className="rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-600">
            {item.quantity}x {item.name}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Sipariş notu: {order.note}</span>
        <span>Fiş talebi: {order.receiptRequested ? "Var" : "Yok"}</span>
      </div>
    </button>
  );
}

function OrderDetailPanel({
  order,
  onUpdateStatus,
}: {
  order: Order;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}) {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#5dff65]">Sipariş detayı</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{order.orderNumber}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {order.table} · {order.time}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="space-y-3">
        {order.items.map((item) => (
          <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-sm font-bold text-slate-950">{item.name}</p>
              <p className="text-xs text-slate-500">{item.quantity} adet</p>
            </div>
            <p className="text-sm font-bold text-slate-950">{formatLira(item.quantity * item.price)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <InfoRow label="Sipariş notu" value={order.note} />
        <InfoRow label="Toplam tutar" value={formatLira(getOrderTotal(order))} />
        <InfoRow label="Durum" value={order.status} />
        <InfoRow label="Fiş talebi" value={order.receiptRequested ? "Var" : "Yok"} />
      </div>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          onClick={() => onUpdateStatus(order.id, "Hazırlanıyor")}
          disabled={order.status === "Hazırlanıyor" || order.status === "Servis Edildi" || order.status === "İptal Edildi"}
          className="rounded-2xl bg-[#5dff65] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          Hazırlamaya Al
        </button>
        <button
          type="button"
          onClick={() => onUpdateStatus(order.id, "Servis Edildi")}
          disabled={order.status === "Servis Edildi" || order.status === "İptal Edildi"}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          Servis Edildi
        </button>
        <button
          type="button"
          onClick={() => onUpdateStatus(order.id, "İptal Edildi")}
          disabled={order.status === "Servis Edildi" || order.status === "İptal Edildi"}
          className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          İptal Et
        </button>
      </div>
    </aside>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    Yeni: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Hazırlanıyor: "border-amber-200 bg-amber-50 text-amber-700",
    "Servis Edildi": "border-sky-200 bg-sky-50 text-sky-700",
    "İptal Edildi": "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function PaymentsTab({
  payments,
  loading,
  hasError,
  onRefresh,
  onReceiptPrinted,
}: {
  payments: Payment[];
  loading: boolean;
  hasError: boolean;
  onRefresh: () => void;
  onReceiptPrinted: () => void;
}) {
  const successfulPayments = payments.filter((payment) => payment.status === "Başarılı");
  const todayPayments = successfulPayments.filter((payment) => isToday(payment.createdAt));
  const todayTotal = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const successfulCount = successfulPayments.length;
  const receiptCount = payments.filter((payment) => payment.receiptRequested).length;
  const averagePayment = successfulCount > 0
    ? Math.round(successfulPayments.reduce((sum, payment) => sum + payment.amount, 0) / successfulCount)
    : 0;
  const lastPayment = payments[0];
  const rows = [
    { label: "Bugünkü toplam ödeme", value: formatLira(todayTotal), detail: `${todayPayments.length} işlem` },
    { label: "Başarılı ödeme sayısı", value: String(successfulCount), detail: "Tamamlanan ödeme" },
    { label: "Fiş talebi sayısı", value: String(receiptCount), detail: "Panelde görünür" },
    { label: "Ortalama ödeme", value: formatLira(averagePayment), detail: "Başarılı ödemeler" },
    { label: "Son işlem tutarı", value: lastPayment ? formatLira(lastPayment.amount) : "0 TL", detail: lastPayment?.table ?? "Henüz işlem yok" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Ödeme özeti</h2>
            <p className="text-sm text-slate-500">Bugünkü QR ödeme ve fiş talebi görünümü.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
            >
              Ödemeleri Yenile
            </button>
            <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              Canlı
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onReceiptPrinted}
          className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
        >
          Seçili fişi yazdırıldı olarak işaretle
        </button>

        {loading && (
          <p className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Ödemeler yükleniyor...
          </p>
        )}

        {hasError && (
          <p className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            Ödemeler yüklenirken bir sorun oluştu.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">{row.label}</p>
              <p className="mt-3 text-2xl font-bold text-slate-950">{row.value}</p>
              <p className="mt-1 text-sm text-slate-500">{row.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-slate-950">Son ödeme hareketleri</h2>
        <div className="space-y-3">
          {!loading && !hasError && payments.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              Gösterilecek ödeme bulunmuyor.
            </p>
          )}
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-950">{payment.transactionId}</p>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {payment.table} · {payment.orderNumber ? `Sipariş ${payment.orderNumber}` : "Masa ödemesi"} · {payment.time}
                  </p>
                </div>
                <p className="text-lg font-bold text-slate-950">{formatLira(payment.amount)}</p>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <span>Sağlayıcı: {payment.provider}</span>
                <span>Fiş talebi: {payment.receiptRequested ? "Var" : "Yok"}</span>
                <span>Durum: {payment.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    Başarılı: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Bekliyor: "border-amber-200 bg-amber-50 text-amber-700",
    Başarısız: "border-rose-200 bg-rose-50 text-rose-700",
    İade: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function ReportsTab({
  orders,
  payments,
  tables,
  products,
  loading,
  hasError,
  onRefresh,
}: {
  orders: Order[];
  payments: Payment[];
  tables: RestaurantTable[];
  products: Product[];
  loading: boolean;
  hasError: boolean;
  onRefresh: () => void;
}) {
  const successfulPayments = payments.filter((payment) => payment.status === "Başarılı");
  const dailyRevenue = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const paymentSuccessRate = payments.length > 0 ? Math.round((successfulPayments.length / payments.length) * 100) : 0;
  const averagePayment = successfulPayments.length > 0 ? dailyRevenue / successfulPayments.length : 0;
  const activeTables = tables.filter((table) => table.status !== "Boş").length;
  const activeProducts = products.filter((product) => product.active).length;
  const topProducts = orders
    .flatMap((order) => order.items)
    .reduce<Array<{ name: string; quantity: number }>>((items, item) => {
      const existingItem = items.find((current) => current.name === item.name);
      if (existingItem) {
        existingItem.quantity += item.quantity;
        return items;
      }

      return [...items, { name: item.name, quantity: item.quantity }];
    }, [])
    .sort((first, second) => second.quantity - first.quantity)
    .slice(0, 5);
  const orderStatusRows: Array<{ label: OrderStatus; count: number }> = [
    { label: "Yeni", count: orders.filter((order) => order.apiStatus === "NEW").length },
    { label: "Hazırlanıyor", count: orders.filter((order) => order.apiStatus === "PREPARING").length },
    { label: "Servis Edildi", count: orders.filter((order) => order.apiStatus === "SERVED").length },
    { label: "İptal Edildi", count: orders.filter((order) => order.apiStatus === "CANCELLED").length },
  ];
  const tableStatusRows = [
    { label: "Boş", count: tables.filter((table) => table.status === "Boş").length },
    { label: "Dolu", count: tables.filter((table) => table.status === "Dolu" || table.status === "Sipariş Var").length },
    { label: "Ödeme bekliyor", count: tables.filter((table) => table.status === "Ödeme Bekliyor" || table.status === "Fiş Talep Edildi").length },
    { label: "Kısmi ödendi", count: tables.filter((table) => table.status === "Kısmi Ödendi").length },
    { label: "Ödendi", count: tables.filter((table) => table.status === "Ödendi").length },
  ];
  const reportCards = [
    { title: "Günlük Ciro", value: formatLira(dailyRevenue), detail: "Başarılı ödemelerden hesaplandı" },
    { title: "Toplam Sipariş", value: String(orders.length), detail: "Tüm sipariş kayıtları" },
    { title: "Ödeme Başarı Oranı", value: `%${paymentSuccessRate}`, detail: `${successfulPayments.length}/${payments.length || 0} başarılı ödeme` },
    { title: "Ortalama Ödeme", value: formatLira(Math.round(averagePayment)), detail: "Başarılı ödemeler ortalaması" },
    { title: "Aktif Masa", value: String(activeTables), detail: "Boş olmayan masa sayısı" },
    { title: "Aktif Ürün", value: String(activeProducts), detail: "Menüde yayında olan ürünler" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Raporlar</h2>
            <p className="text-sm text-slate-500">Sipariş, ödeme, masa ve menü verilerinden demo işletme özeti.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="w-fit rounded-2xl bg-[#5dff65] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050]"
          >
            Raporları Yenile
          </button>
        </div>
        {loading && (
          <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Rapor verileri yükleniyor...
          </p>
        )}
        {hasError && (
          <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            Rapor verileri yüklenirken bir sorun oluştu.
          </p>
        )}
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((report) => (
          <div key={report.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">{report.title}</p>
            <p className="mt-4 text-3xl font-bold text-slate-950">{report.value}</p>
            <p className="mt-2 text-sm text-slate-500">{report.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-950">En çok satılan ürünler</h3>
          <div className="space-y-3">
            {topProducts.length === 0 && (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Henüz satış verisi bulunmuyor.
              </p>
            )}
            {topProducts.map((product) => (
              <div key={product.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-950">{product.name}</p>
                <p className="text-sm font-bold text-emerald-700">{product.quantity} adet</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-950">Son ödeme özeti</h3>
          <div className="space-y-3">
            {payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{payment.table}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{payment.time}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentStatusBadge status={payment.status} />
                    <p className="text-sm font-bold text-slate-950">{formatLira(payment.amount)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Fiş talebi: {payment.receiptRequested ? "Var" : "Yok"}
                </p>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Gösterilecek ödeme bulunmuyor.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportBreakdown title="Sipariş durum dağılımı" rows={orderStatusRows} />
        <ReportBreakdown title="Masa doluluk özeti" rows={tableStatusRows} />
      </div>
    </div>
  );
}

function ReportBreakdown({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-slate-950">{title}</h3>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">{row.label}</p>
            <p className="text-lg font-bold text-slate-950">{row.count}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LicenseTab({ usedTables, usedProducts }: { usedTables: number; usedProducts: number }) {
  const packageRows = [
    ["Paket", "WexPay Standard"],
    ["Lisans tipi", "Aylık"],
    ["Durum", "Aktif"],
    ["Sanal POS", "Bağlı"],
    ["Yenileme tarihi", "17 Haziran 2026"],
  ];
  const usageRows = [
    ["Masa limiti", "75"],
    ["Kullanılan masa", String(usedTables)],
    ["Ürün limiti", "250"],
    ["Kullanılan ürün", String(usedProducts)],
    ["Personel limiti", "10"],
    ["Kullanılan personel", "4"],
    ["Şube limiti", "2"],
    ["Kullanılan şube", "1"],
  ];
  const packages = [
    ["Basic", "Küçük işletmeler için temel operasyon ve düşük limitler."],
    ["Standard", "Büyüyen işletmeler için daha yüksek limit ve gelişmiş takip."],
    ["Pro", "Çok şubeli ve yoğun işletmeler için gelişmiş raporlama, yetki ve entegrasyon."],
  ];
  const actions = ["Paketi Yükselt", "Faturaları Gör", "Sanal POS Ayarları"];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-700">Aktif paket</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">WexPay Standard</h2>
          </div>
          <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            Aktif
          </span>
        </div>
        <div className="space-y-3">
          {packageRows.map(([label, value]) => (
            <InfoRow key={label} label={label} value={value} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xl font-bold text-slate-950">Kullanım limitleri</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {usageRows.map(([label, value]) => (
            <InfoRow key={label} label={label} value={value} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
        <h2 className="text-xl font-bold text-slate-950">Paket açıklaması</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-600">
          QR menü ve temel operasyon tüm WexPay paketlerinde bulunur. Paket farkları limit, raporlama,
          yetki, destek ve entegrasyon seviyesine göre belirlenir.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
        <h2 className="mb-5 text-xl font-bold text-slate-950">Paket karşılaştırması</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {packages.map(([name, description]) => (
            <div key={name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">{name}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Lisans işlemleri</h2>
            <p className="mt-2 text-sm text-slate-500">
              Bu alan Wexon Core lisans ve abonelik sistemiyle yönetilecektir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                disabled
                className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsTab({
  settings,
  onUpdateSettings,
  onSaveSettings,
  onResetDemoData,
}: {
  settings: BusinessSettingsForm;
  onUpdateSettings: (field: keyof BusinessSettingsForm, value: string | boolean) => void;
  onSaveSettings: () => void;
  onResetDemoData: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">İşletme ayarları</h2>
            <p className="mt-2 text-sm text-slate-500">QR sipariş, ödeme ve fiş deneyimi için demo işletme bilgileri.</p>
          </div>
          <button
            type="button"
            onClick={onSaveSettings}
            className="w-fit rounded-2xl bg-[#5dff65] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48e050]"
          >
            Ayarları Kaydet
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsInput label="Restoran adı" value={settings.restaurantName} onChange={(value) => onUpdateSettings("restaurantName", value)} />
          <SettingsInput label="Şube adı" value={settings.branchName} onChange={(value) => onUpdateSettings("branchName", value)} />
          <SettingsInput label="Telefon" value={settings.phone} onChange={(value) => onUpdateSettings("phone", value)} />
          <SettingsInput label="Hizmet bedeli yüzdesi" value={settings.serviceFeeRate} onChange={(value) => onUpdateSettings("serviceFeeRate", value)} />
          <label className="flex flex-col gap-2 lg:col-span-2">
            <span className="text-sm font-semibold text-slate-600">Adres</span>
            <textarea
              value={settings.address}
              onChange={(event) => onUpdateSettings("address", event.target.value)}
              rows={3}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-emerald-300 focus:bg-white"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <SettingsToggle
            label="QR sipariş"
            enabled={settings.qrOrderEnabled}
            onToggle={() => onUpdateSettings("qrOrderEnabled", !settings.qrOrderEnabled)}
          />
          <SettingsToggle
            label="QR ödeme"
            enabled={settings.qrPaymentEnabled}
            onToggle={() => onUpdateSettings("qrPaymentEnabled", !settings.qrPaymentEnabled)}
          />
          <SettingsToggle
            label="Fiş talebi"
            enabled={settings.receiptRequestEnabled}
            onToggle={() => onUpdateSettings("receiptRequestEnabled", !settings.receiptRequestEnabled)}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Demo kontrolü</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
              Canlı demo akışında oluşan sipariş, ödeme, fiş talebi ve bildirim kayıtlarını temizler.
              Menü, ürünler, kategoriler, şube ve masa tanımları korunur.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetDemoData}
            className="w-fit rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
          >
            Demo Verisini Sıfırla
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-emerald-300 focus:bg-white"
      />
    </label>
  );
}

function SettingsToggle({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-white"
    >
      <span>
        <span className="block text-sm font-bold text-slate-950">{label}</span>
        <span className="mt-1 block text-xs font-semibold text-slate-500">
          {enabled ? "Aktif" : "Pasif"}
        </span>
      </span>
      <span className={`h-6 w-11 rounded-full p-1 transition-colors ${enabled ? "bg-[#5dff65]" : "bg-slate-300"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-950">{value}</span>
    </div>
  );
}

function getOrderTotal(order: Order) {
  return order.totalAmount ?? order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
}

function formatLira(value: number) {
  return `${new Intl.NumberFormat("tr-TR").format(value)} TL`;
}
