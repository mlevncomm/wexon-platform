import type { Metadata } from "next";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WexPay - QR Menü, Sipariş ve Ödeme Sistemi",
  description:
    "WexPay; restoranlar için QR menü, masa yönetimi, sipariş, ödeme, fiş talebi ve raporlama süreçlerini tek panelde birleştiren Wexon ürünüdür.",
  alternates: { canonical: "/products/wexpay" },
  openGraph: {
    title: "WexPay - QR Menü, Sipariş ve Ödeme Sistemi",
    description:
      "Restoran operasyonları için QR menü, sipariş, ödeme ve masa yönetimi WexPay ile tek Wexon panelinde.",
    url: "/products/wexpay",
  },
};

type TableStatus = "empty" | "occupied" | "payment_pending" | "partially_paid" | "paid";

interface RestaurantTable {
  number: string;
  status: TableStatus;
  amount: string;
}

const customerExperience = [
  "QR okutur",
  "Menüyü görür",
  "Sipariş verir",
  "Hesabını öder",
  "Fiş talep eder",
];

const businessExperience = [
  "Ürünleri ekler",
  "Fiyatları günceller",
  "Masaları yönetir",
  "Siparişleri takip eder",
  "Ödemeleri ve fiş taleplerini görür",
];

const tables: RestaurantTable[] = [
  { number: "Masa 01", status: "empty", amount: "0 TL" },
  { number: "Masa 02", status: "occupied", amount: "640 TL" },
  { number: "Masa 03", status: "payment_pending", amount: "1.240 TL" },
  { number: "Masa 04", status: "partially_paid", amount: "780 TL" },
  { number: "Masa 05", status: "paid", amount: "920 TL" },
  { number: "Masa 06", status: "occupied", amount: "450 TL" },
];

const billItems = [
  { name: "Flat White", count: 2, amount: "240 TL", selected: true },
  { name: "Avokado Tost", count: 1, amount: "310 TL", selected: true },
  { name: "Limonata", count: 2, amount: "190 TL", selected: false },
  { name: "San Sebastian", count: 1, amount: "220 TL", selected: true },
];

const features = [
  "QR menü",
  "QR sipariş",
  "Masa yönetimi",
  "Ürün ve menü yönetimi",
  "Fiyat güncelleme",
  "Ürün aktif/pasif yapma",
  "QR ödeme",
  "Sanal POS bağlantısı",
  "Fiş talebi",
  "Raporlama",
];

const corePackageFeatures = [
  "QR menü",
  "QR sipariş",
  "Masa hesabı görüntüleme",
  "QR ödeme",
  "Temel masa yönetimi",
  "Menü / ürün yönetimi",
  "Fiyat güncelleme",
  "Fiş talebi",
  "Temel raporlar",
  "Sanal POS bağlantısı",
];

const howItWorks = [
  "Müşteri masadaki QR kodu okutur",
  "Menüye girer veya hesabını görüntüler",
  "Sipariş oluşturur veya ödeme yapar",
  "İşletme panelinde sipariş, ödeme ve fiş talebi görünür",
  "Masa ve raporlar otomatik güncellenir",
];

const panelModules = [
  "Genel Bakış",
  "Masalar",
  "Siparişler",
  "Menü ve ürün yönetimi",
  "Ödemeler",
  "Raporlar",
  "Paket / Lisans",
  "Ayarlar",
];

const qrExperience = [
  "Açılış ekranı",
  "Menü görüntüleme",
  "Sipariş oluşturma",
  "Hesap ödeme",
  "Fiş talebi",
  "Mobil uyumlu deneyim",
];

const plans = [
  {
    name: "Basic",
    price: "3 lisans modeli",
    description: "Küçük kafe ve tek şubeli işletmeler için temel operasyon limitleri.",
    features: [
      "Belirli masa limiti",
      "Tek şube kullanımı",
      "Sınırlı personel hesabı",
      "Temel raporlar",
      "Standart destek",
    ],
  },
  {
    name: "Standard",
    price: "3 lisans modeli",
    description: "Yoğun restoranlar ve büyüyen ekipler için daha geniş kullanım hakları.",
    features: [
      "Artırılmış masa limiti",
      "Çoklu personel yönetimi",
      "Gelişmiş rapor seviyesi",
      "Temel entegrasyonlar",
      "Rol bazlı yetkilendirme",
    ],
    highlighted: true,
  },
  {
    name: "Pro",
    price: "3 lisans modeli",
    description: "Çok şubeli işletmeler ve ileri operasyon ihtiyaçları için.",
    features: [
      "Çoklu şube limiti",
      "Gelişmiş yetkilendirme",
      "İleri raporlama",
      "Geniş entegrasyon seviyesi",
      "Öncelikli destek",
    ],
  },
];

const statusStyles: Record<TableStatus, { label: string; className: string; dot: string }> = {
  empty: {
    label: "Boş",
    className: "border-slate-200 border-l-slate-300 bg-white text-slate-600",
    dot: "bg-slate-400",
  },
  occupied: {
    label: "Dolu",
    className: "border-slate-200 border-l-amber-400 bg-white text-amber-700",
    dot: "bg-amber-400",
  },
  payment_pending: {
    label: "Ödeme Bekliyor",
    className: "border-slate-200 border-l-[#10b981] bg-white text-emerald-700",
    dot: "bg-[#10b981]",
  },
  partially_paid: {
    label: "Kısmi Ödendi",
    className: "border-slate-200 border-l-sky-500 bg-white text-sky-700",
    dot: "bg-sky-500",
  },
  paid: {
    label: "Ödendi",
    className: "border-slate-200 border-l-green-500 bg-white text-green-700",
    dot: "bg-green-500",
  },
};

function SectionHeader({
  badge,
  title,
  description,
}: {
  badge: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">{badge}</span>
      <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="text-base leading-relaxed text-slate-600 sm:text-lg">{description}</p>
    </div>
  );
}

function ExperienceCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-slate-950">{title}</h3>
        <span className="h-2 w-10 rounded-full bg-[#10b981]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-[#10b981]">
              ✓
            </span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableManagerPreview() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#10b981]">Restoran masa yönetici paneli</p>
          <h3 className="text-xl font-bold text-slate-950">Canlı masa ve ödeme paneli</h3>
        </div>
        <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Canlı
        </span>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tables.map((table) => {
            const status = statusStyles[table.status];
            return (
              <div key={table.number} className={`rounded-2xl border-l-4 p-4 shadow-sm ${status.className}`}>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{table.number}</p>
                    <p className="text-xs text-slate-500">{table.amount}</p>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
                </div>
                <p className="text-xs font-semibold">{status.label}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-4 text-sm font-bold text-slate-950">Canlı Bildirimler</p>
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-white p-3">
              <p className="text-xs font-semibold text-emerald-700">Ödeme Alındı</p>
              <p className="text-sm text-slate-950">Masa 05 hesabı tamamen ödendi.</p>
              <p className="text-xs text-slate-500">2 dakika önce</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white p-3">
              <p className="text-xs font-semibold text-amber-700">Fiş Talebi</p>
              <p className="text-sm text-slate-950">Masa 03 fiş talep etti.</p>
              <p className="text-xs text-slate-500">Az önce</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white p-3">
              <p className="text-xs font-semibold text-sky-700">Kısmi Ödeme</p>
              <p className="text-sm text-slate-950">Masa 04 hesabının 320 TL kısmı ödendi.</p>
              <p className="text-xs text-slate-500">5 dakika önce</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobilePaymentPreview() {
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[2rem] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/70">
      <div className="rounded-[1.5rem] border border-slate-200 bg-[#f7faf8] p-5 text-slate-950">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-[#d8e1dc]" />
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#059669]">WexPay</p>
            <h3 className="text-2xl font-bold">Masa 03</h3>
          </div>
          <span className="rounded-full bg-[#10b981]/10 px-3 py-1 text-xs font-bold text-[#059669]">
            QR Aktif
          </span>
        </div>

        <div className="space-y-3">
          {billItems.map((item) => (
            <div
              key={item.name}
              className={`flex items-center justify-between rounded-2xl border p-3 ${
                item.selected ? "border-[#10b981]/30 bg-[#10b981]/10" : "border-slate-200 bg-white"
              }`}
            >
              <div>
                <p className="text-sm font-bold">{item.name}</p>
                <p className="text-xs text-slate-500">{item.count} adet</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{item.amount}</p>
                <p className="text-xs text-slate-500">{item.selected ? "Seçili" : "Açık"}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="my-5 rounded-2xl bg-[#0b1120] p-4 text-white">
          <div className="mb-2 flex items-center justify-between text-sm text-white/60">
            <span>Seçili toplam</span>
            <span>3 ürün</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold">770 TL</span>
            <span className="text-xs text-[#10b981]">Ödemeye hazır</span>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-100 p-3">
          <span className="text-sm font-semibold">Fiş talep et</span>
          <span className="flex h-7 w-12 items-center rounded-full bg-[#10b981] p-1">
            <span className="ml-auto h-5 w-5 rounded-full bg-white" />
          </span>
        </div>

        <button className="w-full rounded-2xl bg-[#10b981] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20">
          Seçili ürünleri öde
        </button>
      </div>
    </div>
  );
}

export default function WexPayPage() {
  return (
    <>
      <WexonNavbar />
      <main className="flex-1 bg-[#f6f8f7] text-slate-950">
        <section className="px-5 pb-16 pt-24 sm:px-8 md:pt-28 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-6 py-14 shadow-sm sm:px-10 lg:px-16 lg:py-20">
              <div
                className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full blur-3xl"
                style={{ background: "radial-gradient(circle, #10b981 0%, transparent 66%)", opacity: 0.13 }}
              />

              <div className="relative z-10 grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
                <div>
                  <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">WexPay aktif ürün</span>
                  <h1 className="mb-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                    Restoran ve kafeler için QR menü, sipariş ve ödeme operasyon sistemi
                  </h1>
                  <p className="mb-9 max-w-2xl text-lg leading-relaxed text-slate-600">
                    WexPay; QR menü, sipariş oluşturma, masa yönetimi, ödeme, fiş talebi, ürün
                    yönetimi, raporlama ve lisans yapısını tek panelde birleştirir.
                  </p>
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                    <Link href="/demo-request" className="inline-flex items-center justify-center rounded-full bg-[#10b981] px-8 py-3.5 text-base font-semibold text-white shadow-sm shadow-emerald-500/20 transition-colors hover:bg-emerald-700">
                      Demo Talep Et
                    </Link>
                    <Link href="/demo/wexpay/business" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50">
                      İşletme Panelini Gör
                    </Link>
                    <Link href="/demo/wexpay/customer" className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-8 py-3.5 text-base font-semibold text-emerald-700 transition-colors hover:bg-emerald-100">
                      QR Müşteri Deneyimi
                    </Link>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-800 bg-[#08111f] p-5 shadow-2xl shadow-slate-900/20">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#10b981]">Bugün</p>
                      <p className="text-lg font-bold text-[#f0f4f8]">Restoran operasyon akışı</p>
                    </div>
                    <span className="rounded-full bg-[#10b981]/10 px-3 py-1 text-xs font-semibold text-[#10b981]">
                      Çevrimiçi
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {tables.slice(1, 5).map((table) => {
                      const status = statusStyles[table.status];
                      return (
                        <div key={table.number} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                          <p className="text-sm font-bold text-[#f0f4f8]">{table.number}</p>
                          <p className="mb-4 text-xs" style={{ color: table.status === "payment_pending" ? "#10b981" : "#8a9bb0" }}>{status.label}</p>
                          <p className="text-xl font-bold">{table.amount}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                      <p className="text-xs font-semibold text-[#10b981]">Müşteri QR ekranı</p>
                      <p className="mt-2 text-sm font-bold text-[#f0f4f8]">Menü · Sepet · Ödeme</p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                      <p className="text-xs font-semibold text-[#10b981]">Wexon Core</p>
                      <p className="mt-2 text-sm font-bold text-[#f0f4f8]">Lisans · Paket · Erişim</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <SectionHeader
              badge="Çalışma Akışı"
              title="WexPay nasıl çalışır?"
              description="Müşteri QR deneyimi ile işletme paneli aynı operasyon akışında birleşir."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {howItWorks.map((step, index) => (
                <div key={step} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700">
                    {index + 1}
                  </span>
                  <p className="mt-5 text-sm font-bold leading-relaxed text-slate-950">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <SectionHeader
              badge="İşletme Paneli"
              title="İşletme panelinde neler var?"
              description="WexPay işletme paneli restoran/kafe ekibinin günlük operasyonunu modüller halinde yönetir."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {panelModules.map((module) => (
                <div key={module} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 h-2 w-10 rounded-full bg-[#10b981]" />
                  <h3 className="text-base font-bold text-slate-950">{module}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto grid max-w-[1480px] gap-12 lg:grid-cols-[0.9fr_1fr] lg:items-center">
            <MobilePaymentPreview />
            <div>
              <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">Müşteri QR Deneyimi</span>
              <h2 className="mb-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Müşteri masadan menüyü görür, sipariş verir ve ödeme yapar
              </h2>
              <p className="mb-8 text-lg leading-relaxed text-slate-600">
                WexPay mobil deneyimi açılış ekranı, menü görüntüleme, sipariş oluşturma, hesap
                ödeme ve fiş talebini tek akışta gösterir.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {qrExperience.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-950 shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
              <Link href="/demo/wexpay/customer" className="mt-8 inline-flex items-center justify-center rounded-full bg-[#10b981] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700">
                QR Müşteri Demosunu Gör
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px] rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10 lg:p-12">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                  Tek Panel
                </span>
                <h2 className="mb-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Tek panelden restoran operasyonu
                </h2>
                <p className="text-lg leading-relaxed text-slate-600">
                  QR menü tüm paketlerde bulunur. İşletme ürünlerini, kategorilerini, fiyatlarını,
                  masa durumlarını, siparişlerini, ödemelerini ve raporlarını tek panelden yönetir.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Ürün ve kategori yönetimi", "Masa ve sipariş takibi", "Ödeme ve fiş talepleri", "Rapor ve paket görünümü"].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-950">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <SectionHeader
              badge="Çift Taraflı Deneyim"
              title="Müşteri ve işletme aynı operasyon akışında buluşur"
              description="WexPay, QR üzerinden başlayan müşteri deneyimini işletmenin ürün, masa, sipariş ve ödeme yönetimiyle tek panelde birleştirir."
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <ExperienceCard title="Müşteri tarafı" items={customerExperience} />
              <ExperienceCard title="İşletme tarafı" items={businessExperience} />
            </div>
          </div>
        </section>

        <section id="table-panel" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <SectionHeader
              badge="Yönetici Paneli Önizlemesi"
              title="Masa, sipariş ve ödeme durumları tek panelde"
              description="Masaları, açık siparişleri, ödeme durumlarını ve fiş taleplerini operasyon panelinden anlık olarak takip edin."
            />
            <TableManagerPreview />
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto grid max-w-[1480px] gap-12 lg:grid-cols-[0.9fr_1fr] lg:items-center">
            <MobilePaymentPreview />
            <div>
              <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">Müşteri Mobil Önizlemesi</span>
              <h2 className="mb-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Misafirler menüyü görür, sipariş verir ve hesabını öder
              </h2>
              <p className="mb-8 text-lg leading-relaxed text-slate-600">
                Müşteri masa numarasını, menü ürünlerini, hesap kalemlerini ve ödenecek toplamı
                net biçimde görür. Sipariş ve fiş talebi işletme paneline iletilir.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {["QR menü görüntüleme", "QR sipariş verme", "Tam veya seçili ödeme", "Fiş talebi"].map(
                  (item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-950 shadow-sm">
                      {item}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px] rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">Wexon Core Bağlantılı</span>
                <h2 className="mb-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Paket, lisans ve erişim yönetimi Wexon Core ile çalışır
                </h2>
                <p className="text-lg leading-relaxed text-slate-600">
                  WexPay paketleri; aylık, yıllık ve tek seferlik lisans modelleriyle Wexon
                  Core üzerinden yönetilir. İşletmenin ölçeğine göre limit, yetki ve entegrasyon
                  seviyeleri tanımlanır.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {plans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`rounded-2xl border p-5 ${
                      plan.highlighted
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className="mb-2 text-lg font-bold text-slate-950">{plan.name}</p>
                    <p className="mb-4 text-xs text-slate-500">Aylık · Yıllık · Tek seferlik</p>
                    <span className="rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1 text-xs font-semibold text-[#10b981]">
                      Core ile aktif
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <SectionHeader
              badge="Özellikler"
              title="Restoran ve kafe operasyonu için temel yetenekler"
              description="QR menüden sanal POS bağlantısına kadar günlük operasyonun ihtiyaç duyduğu ana modüller tek üründe birleşir."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {features.map((feature) => (
                <div key={feature} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 h-2 w-10 rounded-full bg-[#10b981]" />
                  <h3 className="text-base font-bold text-slate-950">{feature}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <SectionHeader
              badge="Paket Önizlemesi"
              title="WexPay paketleri"
              description="Aylık, yıllık ve tek seferlik lisans seçenekleri; masa, şube, personel, rapor ve entegrasyon seviyelerine göre yönetilir."
            />
            <div className="mb-8 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-center text-sm font-semibold leading-relaxed text-emerald-800">
              Paketler temel özellikleri kapatmak için değil, işletmenin ölçeğine göre limit,
              raporlama, yetki ve entegrasyon seviyesini belirlemek için tasarlanmıştır.
            </div>
            <div className="mb-8 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="mb-4 text-sm font-bold text-slate-950">
                Tüm paketlerde bulunan temel WexPay operasyonu
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {corePackageFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-[24px] border bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${
                    plan.highlighted ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">
                      Önerilen
                    </span>
                  )}
                  <h3 className="mb-2 text-2xl font-bold text-slate-950">{plan.name}</h3>
                  <p className="mb-6 text-sm leading-relaxed text-slate-600">{plan.description}</p>
                  <p className="mb-2 text-2xl font-bold text-slate-950">{plan.price}</p>
                  <p className="mb-6 text-xs font-semibold text-slate-500">
                    Aylık · Yıllık · Tek Seferlik
                  </p>
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/checkout?product=wexpay&plan=standard"
                    className={`inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${
                      plan.highlighted
                        ? "bg-[#10b981] text-white hover:bg-emerald-700"
                        : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    Abonelik Başlat
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto grid max-w-[1480px] gap-6 lg:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
              <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                Sanal POS
              </span>
              <h2 className="mb-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Sanal POS ve ödeme altyapısı
              </h2>
              <p className="text-lg leading-relaxed text-slate-600">
                İlk production sürümünde operasyonel tahsilat <strong>manuel ödeme</strong> ile yapılır.
                PayTR sanal POS, pilot merchant doğrulaması ve <code className="text-sm">WEXPAY_PAYTR_ENABLE_API=true</code> sonrası
                tenant bazlı açılır. Demo ortamında ödeme akışı simüle edilir.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
              <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                Wexon Core
              </span>
              <h2 className="mb-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Wexon Core ile çalışır
              </h2>
              <p className="text-lg leading-relaxed text-slate-600">
                WexPay lisans, abonelik, paket, fatura ve erişim yönetimini Wexon Core üzerinden
                alacak şekilde planlanmaktadır.
              </p>
            </div>
          </div>
        </section>

        <section id="cta" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1280px]">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[#08111f] p-10 text-center shadow-2xl shadow-slate-900/20 sm:p-16">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at 50% 0%, rgba(16,185,129,0.18), transparent 55%)",
                }}
              />
              <div className="relative z-10">
                <span className="mb-6 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">WexPay Demo</span>
                <h2 className="mb-5 text-3xl font-bold tracking-tight text-[#f0f4f8] sm:text-5xl">
                  Restoranınız için WexPay&apos;i birlikte planlayalım
                </h2>
                <p className="mx-auto mb-9 max-w-xl text-lg leading-relaxed text-[#8a9bb0]">
                  QR menü, sipariş, masa yönetimi, ödeme, fiş talebi ve ürün yönetimi akışlarını
                  müşteri ve işletme tarafında inceleyin.
                </p>
                <div className="flex flex-col justify-center gap-4 sm:flex-row">
                  <Link href="/demo-request" className="inline-flex items-center justify-center rounded-full bg-[#10b981] px-9 py-4 text-base font-semibold text-white transition-colors hover:bg-emerald-700">
                    Demo Talep Et
                  </Link>
                  <Link href="/book-demo" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-9 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10">
                    Randevu Al
                  </Link>
                  <Link href="/demo/wexpay/business" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-9 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10">
                    İşletme Panelini Gör
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <WexonFooter />
    </>
  );
}
