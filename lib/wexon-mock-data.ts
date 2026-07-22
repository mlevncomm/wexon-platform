import type { WexonProduct, PricingTier, WexonStat, DemoCard, NavLink } from "@/types/wexon";

export const NAV_LINKS: NavLink[] = [
  { label: "Ürünler", href: "/#products" },
  { label: "Wexon Core", href: "/#core" },
  { label: "Çözümler", href: "/#solutions" },
  { label: "Paketler", href: "/#pricing" },
];

export const PRODUCTS: WexonProduct[] = [
  {
    id: "wexpay",
    name: "WexPay",
    tagline: "Restoran ve kafeler için QR menü, sipariş ve ödeme sistemi",
    description:
      "WexPay; QR menü, sipariş, masa yönetimi, ödeme, fiş talebi, raporlama ve operasyon takibini tek panelde birleştirir.",
    accentColor: "#10b981",
    features: [
      "Akıllı Aktivasyon",
      "QR menü ve sipariş",
      "Masa ve ödeme takibi",
      "Menü / ürün yönetimi",
      "Raporlama",
      "Core lisans entegrasyonu",
    ],
    href: "/products/wexpay",
    statusLabel: "Canlıya Geçiş",
  },
  {
    id: "wexhotel",
    name: "WexHotel",
    tagline: "Otel ve konaklama işletmeleri için yönetim sistemi",
    description:
      "Oda, rezervasyon, misafir, ödeme ve personel süreçleri için WexPay sonrasında planlanan Wexon ürünüdür.",
    accentColor: "#6366f1",
    features: [
      "Oda yönetimi",
      "Rezervasyon takvimi",
      "Misafir kayıtları",
      "Ödeme ve fatura takibi",
      "Personel rolleri",
      "Raporlama",
    ],
    href: "/products/wexhotel",
    statusLabel: "Yakında",
  },
  {
    id: "wexb2b",
    name: "WexB2B",
    tagline: "Bayi, toptan satış ve B2B sipariş yönetimi",
    description:
      "Bayi, toptan satış, teklif, sipariş, cari ve ödeme süreçleri için planlanan Wexon ürünüdür.",
    accentColor: "#f59e0b",
    features: [
      "Bayi yönetimi",
      "Ürün katalogları",
      "Teklif yönetimi",
      "Sipariş yönetimi",
      "Cari ve ödeme takibi",
      "Raporlama",
    ],
    href: "/products/wexb2b",
    statusLabel: "Yakında",
  },
];

export const STATS: WexonStat[] = [
  {
    value: "3",
    label: "SaaS ürünü",
    description: "WexPay, WexHotel ve WexB2B",
  },
  {
    value: "1",
    label: "Tek lisans merkezi",
    description: "Wexon Core üzerinden yönetim",
  },
  {
    value: "3",
    label: "Lisans modeli",
    description: "Aylık, yıllık ve tek seferlik",
  },
  {
    value: "100%",
    label: "Responsive paneller",
    description: "Masaüstü, tablet ve mobil uyumlu",
  },
];

export const DEMO_CARDS: DemoCard[] = [
  {
    productId: "wexpay",
    productName: "WexPay",
    title: "WexPay masa yönetici paneli",
    metrics: [
      { label: "Bugünkü Ciro", value: "₺12,840", trend: "up", trendValue: "+18%" },
      { label: "Aktif Masalar", value: "14 / 24", trend: "neutral" },
      { label: "Açık Siparişler", value: "7", trend: "up", trendValue: "+3" },
      { label: "Ort. Adisyon", value: "₺247", trend: "up", trendValue: "+12%" },
    ],
  },
  {
    productId: "wexhotel",
    productName: "WexHotel",
    title: "WexHotel resepsiyon paneli",
    metrics: [
      { label: "Doluluk Oranı", value: "87%", trend: "up", trendValue: "+5%" },
      { label: "Bugünkü Girişler", value: "12", trend: "neutral" },
      { label: "Gelir (Aylık)", value: "$48,200", trend: "up", trendValue: "+22%" },
      { label: "Bekleyen Talepler", value: "3", trend: "down", trendValue: "-2" },
    ],
  },
  {
    productId: "wexb2b",
    productName: "WexB2B",
    title: "WexB2B bayi/sipariş paneli",
    metrics: [
      { label: "Aktif Bayiler", value: "128", trend: "up", trendValue: "+8" },
      { label: "Bu Haftaki Siparişler", value: "342", trend: "up", trendValue: "+14%" },
      { label: "GMV (Aylık)", value: "$1.2M", trend: "up", trendValue: "+31%" },
      { label: "Bekleyen Onaylar", value: "5", trend: "neutral" },
    ],
  },
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "basic",
    product: "Wexon Platform",
    name: "Basic",
    monthlyPrice: 49,
    description: "Yeni başlayan işletmeler için temel ürün erişimi.",
    features: ["Tek ürün erişimi", "Temel lisans yönetimi", "Aylık lisans seçeneği", "E-posta desteği"],
    highlighted: false,
    cta: "Demo Talep Et",
  },
  {
    id: "pro",
    product: "Wexon Platform",
    name: "Pro",
    monthlyPrice: 129,
    description: "Birden fazla ürün ve gelişmiş operasyon ihtiyacı olan ekipler için.",
    features: [
      "Çoklu ürün erişimi",
      "Wexon Core yönetimi",
      "Aylık / yıllık lisans",
      "Öncelikli destek",
      "Gelişmiş raporlar",
    ],
    highlighted: true,
    cta: "Demo Talep Et",
  },
  {
    id: "enterprise",
    product: "Wexon Platform",
    name: "Enterprise",
    monthlyPrice: null,
    description: "Kurumsal yapı, çoklu şube ve özel lisans ihtiyaçları için.",
    features: [
      "Tüm ürünlere erişim",
      "Tek seferlik lisans seçeneği",
      "Özel paket ve yetki kurgusu",
      "Kurumsal destek",
    ],
    highlighted: false,
    cta: "Demo Talep Et",
  },
];
