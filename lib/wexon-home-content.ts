import type {
  AdminActivityItem,
  AdminMetric,
  AdminOrganizationRow,
  BillingSummary,
  CoreCapability,
  CustomerProductCard,
  EcosystemProduct,
  FaqItem,
  FlowStep,
  HomeStat,
  PanelNavItem,
  PricingPlan,
  SecurityItem,
  TeamMember,
  TrustSignal,
  WexB2BAppData,
  WexHotelAppData,
  WexPayAppData,
} from "@/types/wexon";

/* -------------------------------------------------------------------------- */
/* Trust strip + platform stats (honest, pilot-stage)                          */
/* -------------------------------------------------------------------------- */

export const TRUST_SIGNALS: TrustSignal[] = [
  { icon: "qr", label: "WexPay Pilot · canlı" },
  { icon: "layers", label: "Tek Wexon Core" },
  { icon: "isolation", label: "Tenant isolation" },
  { icon: "entitlement", label: "Lisans & entitlement" },
  { icon: "audit", label: "Audit log" },
  { icon: "check", label: "Türkçe arayüz" },
];

export const HOME_STATS: HomeStat[] = [
  {
    value: "3",
    label: "Tek ekosistemde ürün",
    hint: "WexPay, WexHotel ve WexB2B ortak platformda",
  },
  {
    value: "1",
    label: "Merkezi Wexon Core",
    hint: "Lisans, entitlement, fatura ve erişim tek yerde",
    highlighted: true,
  },
  {
    value: "6",
    label: "QR sipariş → ödeme adımı",
    hint: "Menüden tahsilata kesintisiz akış",
  },
  {
    value: "%100",
    label: "Türkçe panel",
    hint: "Ekipler için sade, öğrenmesi kolay arayüz",
  },
];

export const ECOSYSTEM_PRODUCTS: EcosystemProduct[] = [
  {
    id: "wexpay",
    name: "WexPay",
    icon: "qr",
    accent: "emerald",
    statusLabel: "Pilot",
    tagline: "Restoranlar için tek QR ile sipariş ve ödeme",
    description:
      "Tek QR üzerinden menü, sepet, sipariş ve ödeme; masa durumu, fiş talepleri ve tahsilat tek panelde canlı takip edilir.",
    tags: ["QR menü & sipariş", "Masa & ödeme", "Canlı bildirim"],
    href: "/products/wexpay",
    primary: true,
  },
  {
    id: "wexhotel",
    name: "WexHotel",
    icon: "hotel",
    accent: "indigo",
    statusLabel: "Roadmap",
    tagline: "Oteller için oda, rezervasyon ve operasyon yönetimi",
    description:
      "Oda, rezervasyon, misafir, ödeme ve fatura süreçlerini tek operasyon paneline bağlar; doluluk ve gelir anlık izlenir.",
    tags: ["Rezervasyon", "Oda & misafir", "Gelir takibi"],
    href: "/products/wexhotel",
  },
  {
    id: "wexb2b",
    name: "WexB2B",
    icon: "b2b",
    accent: "amber",
    statusLabel: "Roadmap",
    tagline: "Bayi ve toptan satış için sipariş ve cari yönetimi",
    description:
      "Katalog, teklif, sipariş, cari ve bayi bazlı fiyatlandırmayı yönetir; toptan satış operasyonunu uçtan uca dijitalleştirir.",
    tags: ["Katalog & teklif", "Bayi sipariş", "Bayi fiyatı"],
    href: "/products/wexb2b",
  },
];

export const CORE_CAPABILITIES: CoreCapability[] = [
  {
    icon: "customers",
    title: "Organization yönetimi",
    description: "Her işletme izole bir organization; veri ve erişim sınırları nettir.",
  },
  {
    icon: "users",
    title: "Kullanıcı ve rol yönetimi",
    description: "Ekip üyeleri, roller ve izinler merkezi olarak tanımlanır.",
  },
  {
    icon: "catalog",
    title: "Ürün ve plan kataloğu",
    description: "Ürünler, planlar ve paket seviyeleri tek yerden kurgulanır.",
  },
  {
    icon: "license",
    title: "Lisans ve subscription",
    description: "Lisans tahsisi ile abonelik durumu ayrı ama bağlı yönetilir.",
  },
  {
    icon: "entitlement",
    title: "Entitlement kararları",
    description: "Erişim; lisans ve entitlement mantığıyla hesaplanır, ödeme durumuyla değil.",
  },
  {
    icon: "audit",
    title: "API key, audit & bildirim",
    description: "API anahtarları, denetlenebilir audit log ve bildirim altyapısı yerleşik.",
  },
];

export const CORE_HIGHLIGHTS: string[] = [
  "Billing state ile access state ayrı hesaplanır",
  "Ürün erişimi lisans ve entitlement kararlarına dayanır",
  "WexPay, WexHotel ve WexB2B erişimi Core'dan gelir",
];

/* -------------------------------------------------------------------------- */
/* Wexon Core / Admin panel                                                    */
/* -------------------------------------------------------------------------- */

export const ADMIN_NAV_ITEMS: PanelNavItem[] = [
  { icon: "dashboard", label: "Dashboard", active: true },
  { icon: "customers", label: "Organizations" },
  { icon: "products", label: "Products" },
  { icon: "catalog", label: "Plans" },
  { icon: "license", label: "Licenses" },
  { icon: "subscription", label: "Subscriptions" },
  { icon: "invoice", label: "Invoices" },
  { icon: "billing", label: "Payments" },
  { icon: "entitlement", label: "Entitlements" },
  { icon: "support", label: "Support" },
  { icon: "audit", label: "Audit Logs" },
  { icon: "settings", label: "System Settings" },
];

export const ADMIN_METRICS: AdminMetric[] = [
  { label: "Active Organizations", value: "248", hint: "+12 bu ay", tone: "success" },
  { label: "Active Licenses", value: "612", hint: "+34 bu ay", tone: "success" },
  { label: "Monthly Revenue", value: "₺1.24M", hint: "+%8 önceki aya göre", tone: "info" },
  { label: "Pending Payments", value: "₺48.900", hint: "17 organization", tone: "warning" },
];

export const ADMIN_ORGANIZATIONS: AdminOrganizationRow[] = [
  {
    organization: "Kadıköy Lezzet A.Ş.",
    activeProducts: "WexPay",
    plan: "Platform",
    billingState: { label: "Ödendi", tone: "success" },
    accessState: { label: "Aktif", tone: "success" },
    status: { label: "Aktif", tone: "success" },
  },
  {
    organization: "Bosphorus Hotel",
    activeProducts: "WexHotel · WexPay",
    plan: "Growth",
    billingState: { label: "Beklemede", tone: "warning" },
    accessState: { label: "Aktif", tone: "success" },
    status: { label: "Aktif", tone: "success" },
  },
  {
    organization: "Anadolu Toptan",
    activeProducts: "WexB2B",
    plan: "Platform",
    billingState: { label: "Gecikmiş", tone: "error" },
    accessState: { label: "Kısıtlı", tone: "warning" },
    status: { label: "Askıda", tone: "error" },
  },
  {
    organization: "Ege Kahve",
    activeProducts: "WexPay",
    plan: "Starter",
    billingState: { label: "Ödendi", tone: "success" },
    accessState: { label: "Aktif", tone: "success" },
    status: { label: "Deneme", tone: "info" },
  },
  {
    organization: "Marmara Group",
    activeProducts: "WexPay · WexB2B",
    plan: "Enterprise",
    billingState: { label: "Ödendi", tone: "success" },
    accessState: { label: "Aktif", tone: "success" },
    status: { label: "Aktif", tone: "success" },
  },
];

export const ADMIN_ACTIVITY: AdminActivityItem[] = [
  { icon: "license", title: "License renewed", detail: "Marmara Group · Enterprise", tone: "success" },
  { icon: "entitlement", title: "Entitlement updated", detail: "Bosphorus Hotel · +1 ürün", tone: "info" },
  { icon: "billing", title: "Payment received", detail: "Kadıköy Lezzet · ₺4.200", tone: "success" },
  { icon: "track", title: "Trial expiring", detail: "Ege Kahve · 3 gün kaldı", tone: "warning" },
  { icon: "shield", title: "Admin override applied", detail: "Anadolu Toptan · erişim kısıtlandı", tone: "error" },
];

/* -------------------------------------------------------------------------- */
/* Customer Portal                                                             */
/* -------------------------------------------------------------------------- */

export const PORTAL_NAV_ITEMS: PanelNavItem[] = [
  { icon: "dashboard", label: "Dashboard", active: true },
  { icon: "products", label: "Active Products" },
  { icon: "license", label: "Licenses" },
  { icon: "subscription", label: "Subscriptions" },
  { icon: "invoice", label: "Billing" },
  { icon: "billing", label: "Payment Methods" },
  { icon: "team", label: "Team" },
  { icon: "settings", label: "Company Settings" },
  { icon: "support", label: "Support Tickets" },
];

export const CUSTOMER_PRODUCTS: CustomerProductCard[] = [
  {
    name: "WexPay Pro",
    accent: "emerald",
    licenseStatus: { label: "Aktif", tone: "success" },
    renewalDate: "12 Ağu 2026",
    seatUsage: "6 / 10 kullanıcı",
    quotaLabel: "Aylık işlem: 8.240 / 15.000",
    quotaPercent: 55,
    appHref: "/apps/wexpay",
  },
  {
    name: "WexHotel Trial",
    accent: "indigo",
    licenseStatus: { label: "Deneme", tone: "info" },
    renewalDate: "5 gün kaldı",
    seatUsage: "2 / 5 kullanıcı",
    quotaLabel: "Oda limiti: 18 / 25",
    quotaPercent: 72,
    appHref: "/products/wexhotel",
  },
  {
    name: "WexB2B Starter",
    accent: "amber",
    licenseStatus: { label: "Beklemede", tone: "warning" },
    renewalDate: "Ödeme bekliyor",
    seatUsage: "1 / 3 kullanıcı",
    quotaLabel: "Bayi: 4 / 10",
    quotaPercent: 40,
    appHref: "/products/wexb2b",
  },
];

export const CUSTOMER_BILLING: BillingSummary = {
  currentPlan: "Platform · Aylık",
  nextInvoiceDate: "1 Ağu 2026",
  paymentMethod: "•••• 4242 · Visa",
  outstandingBalance: "₺2.480",
};

export const CUSTOMER_TEAM: TeamMember[] = [
  { name: "Ali Yılmaz", role: "Owner", email: "ali@kadikoylezzet.com" },
  { name: "Zeynep Kaya", role: "Admin", email: "zeynep@kadikoylezzet.com" },
  { name: "Mehmet Demir", role: "Billing User", email: "muhasebe@kadikoylezzet.com" },
  { name: "Elif Şahin", role: "Product User", email: "elif@kadikoylezzet.com" },
];

/* -------------------------------------------------------------------------- */
/* Product App panels                                                          */
/* -------------------------------------------------------------------------- */

export const WEXPAY_APP: WexPayAppData = {
  tables: [
    { label: "Masa 1", state: "paid" },
    { label: "Masa 2", state: "occupied", amount: "₺240" },
    { label: "Masa 3", state: "ordered", amount: "₺310" },
    { label: "Masa 4", state: "awaiting", amount: "₺420" },
    { label: "Masa 5", state: "partial", amount: "₺180" },
    { label: "Masa 6", state: "paid" },
    { label: "Masa 7", state: "occupied", amount: "₺95" },
    { label: "Masa 8", state: "empty" },
    { label: "Masa 9", state: "ordered", amount: "₺260" },
    { label: "Masa 10", state: "awaiting", amount: "₺360" },
    { label: "Masa 11", state: "empty" },
    { label: "Masa 12", state: "occupied", amount: "₺150" },
  ],
  notifications: [
    { title: "Masa 4 ödeme başlattı", detail: "₺420 · şimdi", tone: "info" },
    { title: "Masa 2 fiş talebi gönderdi", detail: "Yazar kasa fişi · 1 dk önce", tone: "warning" },
    { title: "Masa 3 yeni sipariş gönderdi", detail: "4 kalem · 2 dk önce", tone: "success" },
  ],
  metrics: [
    { label: "Günlük ödeme", value: "₺18.240" },
    { label: "Açık masa", value: "7" },
    { label: "Bekleyen ödeme", value: "₺780" },
    { label: "Fiş talepleri", value: "3" },
  ],
  qrFlow: [
    { icon: "menu", label: "Menü" },
    { icon: "cart", label: "Sepet" },
    { icon: "order", label: "Sipariş" },
    { icon: "pay", label: "Ödeme" },
  ],
};

export const WEXHOTEL_APP: WexHotelAppData = {
  rooms: [
    { label: "101", state: "available" },
    { label: "102", state: "occupied" },
    { label: "103", state: "reserved" },
    { label: "104", state: "cleaning" },
    { label: "105", state: "occupied" },
    { label: "106", state: "available" },
    { label: "201", state: "reserved" },
    { label: "202", state: "occupied" },
    { label: "203", state: "available" },
    { label: "204", state: "cleaning" },
    { label: "205", state: "occupied" },
    { label: "206", state: "reserved" },
  ],
  reservations: [
    {
      guest: "A. Yılmaz",
      room: "204 · Deluxe",
      checkIn: "12 Tem",
      checkOut: "15 Tem",
      payment: { label: "Ödendi", tone: "success" },
    },
    {
      guest: "M. Demir",
      room: "118 · Standart",
      checkIn: "12 Tem",
      checkOut: "13 Tem",
      payment: { label: "Beklemede", tone: "warning" },
    },
    {
      guest: "S. Kaya",
      room: "305 · Suite",
      checkIn: "11 Tem",
      checkOut: "14 Tem",
      payment: { label: "Ödendi", tone: "success" },
    },
    {
      guest: "E. Şahin",
      room: "210 · Deluxe",
      checkIn: "13 Tem",
      checkOut: "17 Tem",
      payment: { label: "Kapora", tone: "info" },
    },
  ],
  metrics: [
    { label: "Doluluk", value: "%87" },
    { label: "Bugünkü giriş", value: "12" },
    { label: "Gelir", value: "₺64.500" },
    { label: "Açık görev", value: "5" },
  ],
};

export const WEXB2B_APP: WexB2BAppData = {
  catalog: [
    { product: "Zeytinyağı 5L", stock: "320", dealerPrice: "₺240", status: { label: "Stokta", tone: "success" } },
    { product: "Un 25kg", stock: "45", dealerPrice: "₺180", status: { label: "Az stok", tone: "warning" } },
    { product: "Salça 10kg", stock: "0", dealerPrice: "₺95", status: { label: "Tükendi", tone: "error" } },
    { product: "Peçete koli", stock: "610", dealerPrice: "₺60", status: { label: "Stokta", tone: "success" } },
  ],
  orders: [
    {
      dealer: "Anadolu Gıda",
      quote: "#T-1042",
      orderStatus: { label: "Onaylandı", tone: "success" },
      payment: { label: "Ödendi", tone: "success" },
    },
    {
      dealer: "Ege Toptan",
      quote: "#T-1041",
      orderStatus: { label: "Teklif", tone: "info" },
      payment: { label: "Bekliyor", tone: "warning" },
    },
    {
      dealer: "Marmara Ltd.",
      quote: "#T-1039",
      orderStatus: { label: "Sevk edildi", tone: "info" },
      payment: { label: "Gecikmiş", tone: "error" },
    },
    {
      dealer: "Karadeniz Dağıtım",
      quote: "#T-1037",
      orderStatus: { label: "Onaylandı", tone: "success" },
      payment: { label: "Ödendi", tone: "success" },
    },
  ],
  metrics: [
    { label: "Aylık sipariş", value: "342" },
    { label: "Bekleyen teklif", value: "6" },
    { label: "Bayi cirosu", value: "₺1.1M" },
    { label: "Açık bakiye", value: "₺84.200" },
  ],
};

/* -------------------------------------------------------------------------- */
/* WexPay QR flow                                                              */
/* -------------------------------------------------------------------------- */

export const WEXPAY_FLOW_STEPS: FlowStep[] = [
  { step: 1, icon: "qr", title: "QR okut", description: "Müşteri masadaki QR kodu telefonuyla okutur.", side: "customer" },
  { step: 2, icon: "menu", title: "Menüyü görüntüle", description: "Güncel menü, görseller ve fiyatlarla açılır.", side: "customer" },
  { step: 3, icon: "cart", title: "Sepeti oluştur", description: "Ürünler seçilir, adetler ve notlar eklenir.", side: "customer" },
  { step: 4, icon: "order", title: "Siparişi gönder", description: "Sipariş mutfağa ve panele anında düşer.", side: "customer" },
  { step: 5, icon: "track", title: "Durumu takip et", description: "Hazırlanıyor, hazır ve servis durumu izlenir.", side: "customer" },
  { step: 6, icon: "pay", title: "Ödemeyi tamamla", description: "Müşteri masadan ödemesini tamamlar.", side: "customer" },
  { step: 7, icon: "bell", title: "Panelde bildirimi gör", description: "Restoran; ödeme, masa ve fiş talebini canlı görür.", side: "business" },
];

/* -------------------------------------------------------------------------- */
/* Pricing / Security / FAQ                                                    */
/* -------------------------------------------------------------------------- */

import { WEXPAY_PRICING_FALLBACK, ENTERPRISE_PRICING_PLAN } from "@/lib/wexon-public-pricing-fallback";

/** @deprecated Prefer getPublicWexPayPricingPlans() — static fallback for client-safe imports. */
export const PRICING_PLANS: PricingPlan[] = [...WEXPAY_PRICING_FALLBACK, ENTERPRISE_PRICING_PLAN];

export const SECURITY_ITEMS: SecurityItem[] = [
  {
    icon: "isolation",
    title: "Organization isolation",
    description: "Her organization verisi ve erişimi izole edilir; işletmeler birbirine sızmaz.",
  },
  {
    icon: "entitlement",
    title: "Lisans & entitlement erişimi",
    description: "Erişim kararları lisans ve entitlement mantığına dayanır, ödeme durumuna değil.",
  },
  {
    icon: "billing",
    title: "Billing / access state ayrımı",
    description: "Ödeme durumu ile ürün erişimi ayrı hesaplanır; kontrollü ve öngörülebilirdir.",
  },
  {
    icon: "key",
    title: "API key yönetimi",
    description: "Entegrasyonlar için API anahtarları oluşturulur, izlenir ve iptal edilebilir.",
  },
  {
    icon: "audit",
    title: "Audit log",
    description: "Kritik erişim, ödeme ve admin işlemleri izlenebilir şekilde kayıtlanır.",
  },
  {
    icon: "webhook",
    title: "Güvenli webhook & ödeme adaptörü",
    description: "İmza doğrulama, idempotency ve duplicate event koruması; provider adapter mimarisi.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Wexon nedir?",
    answer:
      "Wexon, restoran, otel ve B2B operasyonlarını tek çatı altında toplayan çok ürünlü bir SaaS ekosistemidir. WexPay, WexHotel ve WexB2B ürünleri ortak bir platform üzerinde çalışır.",
  },
  {
    question: "Wexon Core ne işe yarar?",
    answer:
      "Wexon Core merkezi yönetim katmanıdır. Organization, kullanıcı, ürün, plan, lisans, abonelik, ödeme, fatura, entitlement, kota, API key, bildirim ve audit log için tek kaynak gibi çalışır.",
  },
  {
    question: "WexPay sadece QR ödeme sistemi mi?",
    answer:
      "Hayır. WexPay tek QR üzerinden menü görüntüleme, sepet oluşturma, sipariş gönderme, sipariş durumu takibi ve ödeme akışını kapsar. Restoran tarafında masa, ödeme ve fiş talepleri canlı yönetilir.",
  },
  {
    question: "WexHotel ve WexB2B ayrı ürünler mi?",
    answer:
      "Evet, ayrı ürünlerdir; fakat kendi lisans ve abonelik mantığını ayrı yönetmezler. Hepsi Wexon Core'a bağlı çalışır ve erişimleri Core üzerinden hesaplanır.",
  },
  {
    question: "Ürün erişimleri nasıl yönetilir?",
    answer:
      "Ürün erişimleri lisans, subscription ve entitlement kararlarıyla yönetilir. Erişim, ödeme durumundan doğrudan değil; lisans ve entitlement üzerinden kontrollü şekilde belirlenir.",
  },
  {
    question: "Demo talebi nasıl oluşturulur?",
    answer:
      "Demo Talep Et bağlantısıyla kısa bir form doldurmanız yeterli. İşletmenize uygun ürünleri ve lisans modelini birlikte netleştirir, canlı demo ile ilerleriz.",
  },
];
