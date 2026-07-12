import type { Metadata } from "next";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";
import WexPayPreview from "@/components/marketing/home/preview/WexPayPreview";
import { WEXPAY_APP, WEXPAY_FLOW_STEPS } from "@/lib/wexon-home-content";
import {
  Badge,
  Button,
  Eyebrow,
  FeatureChip,
  PhoneFrame,
  PricingCard,
  SectionHeading,
  SectionShell,
  WexonIcon,
} from "@/components/ui";
import type { PricingPlan, WexonIconName } from "@/types/wexon";

export const metadata: Metadata = {
  title: "WexPay - QR Menü, Sipariş ve Ödeme Sistemi",
  description:
    "WexPay; restoranlar için QR menü, masa yönetimi, sipariş, ödeme, fiş talebi ve raporlama süreçlerini tek panelde birleştiren Wexon ürünüdür. Erişim Wexon Core üzerinden lisans ve entitlement ile yönetilir.",
  alternates: { canonical: "/products/wexpay" },
  openGraph: {
    title: "WexPay - QR Menü, Sipariş ve Ödeme Sistemi",
    description:
      "Restoran operasyonları için QR menü, sipariş, ödeme ve masa yönetimi WexPay ile tek Wexon panelinde.",
    url: "/products/wexpay",
  },
};

const panelModules: { icon: WexonIconName; title: string; description: string }[] = [
  { icon: "dashboard", title: "Genel Bakış", description: "Günlük ödeme, açık masa ve fiş taleplerini tek ekranda görün." },
  { icon: "table", title: "Masalar", description: "Boş, dolu, sipariş, ödeme bekleyen ve kısmi ödenen masaları canlı takip edin." },
  { icon: "order", title: "Siparişler", description: "Mutfağa düşen siparişleri anlık durumlarıyla yönetin." },
  { icon: "menu", title: "Menü ve ürünler", description: "Kategori, fiyat, görsel ve aktif/pasif ürün yönetimi." },
  { icon: "pay", title: "Ödemeler", description: "Tam, kısmi ve bekleyen ödemeleri masa bazında izleyin." },
  { icon: "audit", title: "Raporlar", description: "Günlük, haftalık ve dönemsel operasyon raporları." },
  { icon: "license", title: "Paket / Lisans", description: "Wexon Core üzerinden lisans ve paket görünümü." },
  { icon: "settings", title: "Ayarlar", description: "Şube, personel, QR ve işletme ayarları." },
];

const featureCards: { icon: WexonIconName; title: string; description: string }[] = [
  { icon: "qr", title: "QR menü", description: "Masadaki QR ile menü anında açılır; yazdırma veya uygulama gerekmez." },
  { icon: "order", title: "QR sipariş", description: "Müşteri masadan siparişini gönderir; panel ve mutfak anında görür." },
  { icon: "table", title: "Masa yönetimi", description: "12+ masa durumunu tek grid üzerinde canlı takip edin." },
  { icon: "catalog", title: "Ürün yönetimi", description: "Fiyat, kategori, stok ve aktif/pasif durumunu güncelleyin." },
  { icon: "pay", title: "QR ödeme", description: "Tam veya seçili ürün ödemesi; fiş talebi paneline düşer." },
  { icon: "invoice", title: "Fiş talebi", description: "Müşteri fiş ister; işletme paneli anlık bildirim alır." },
  { icon: "adapter", title: "Sanal POS", description: "İlk sürümde manuel tahsilat; PayTR pilot sonrası tenant bazlı açılır." },
  { icon: "audit", title: "Raporlama", description: "Ödeme, masa ve sipariş metriklerini dönemsel takip edin." },
  { icon: "entitlement", title: "Core erişimi", description: "Lisans ve entitlement ile erişim; ödeme durumundan ayrı." },
  { icon: "bell", title: "Canlı bildirim", description: "Ödeme, sipariş ve fiş talepleri anlık bildirim olarak görünür." },
];

const customerExperience = [
  "QR okutur",
  "Menüyü görür",
  "Sepet oluşturur",
  "Sipariş verir",
  "Hesabını öder",
  "Fiş talep eder",
];

const businessExperience = [
  "Ürünleri ekler",
  "Fiyatları günceller",
  "Masaları yönetir",
  "Siparişleri takip eder",
  "Ödemeleri görür",
  "Fiş taleplerini karşılar",
];

const plans: PricingPlan[] = [
  {
    id: "basic",
    name: "Basic",
    audience: "Küçük kafe ve tek şubeli işletmeler için temel operasyon limitleri.",
    priceLabel: "Lisans modeli",
    billingNote: "Aylık · Yıllık · Tek seferlik",
    features: ["Belirli masa limiti", "Tek şube kullanımı", "Sınırlı personel hesabı", "Temel raporlar", "Standart destek"],
    cta: "Abonelik Başlat",
  },
  {
    id: "standard",
    name: "Standard",
    audience: "Yoğun restoranlar ve büyüyen ekipler için daha geniş kullanım hakları.",
    priceLabel: "Lisans modeli",
    billingNote: "Aylık · Yıllık · Tek seferlik",
    features: ["Artırılmış masa limiti", "Çoklu personel yönetimi", "Gelişmiş rapor seviyesi", "Temel entegrasyonlar", "Rol bazlı yetkilendirme"],
    cta: "Abonelik Başlat",
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    audience: "Çok şubeli işletmeler ve ileri operasyon ihtiyaçları için.",
    priceLabel: "Lisans modeli",
    billingNote: "Aylık · Yıllık · Tek seferlik",
    features: ["Çoklu şube limiti", "Gelişmiş yetkilendirme", "İleri raporlama", "Geniş entegrasyon seviyesi", "Öncelikli destek"],
    cta: "Abonelik Başlat",
  },
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

function ExperienceCard({ title, items, side }: { title: string; items: string[]; side: "customer" | "business" }) {
  const isBusiness = side === "business";
  return (
    <div
      className={`wx-lift rounded-[28px] border p-6 sm:p-7 ${
        isBusiness
          ? "border-slate-900 bg-slate-950 text-white shadow-[0_28px_60px_-30px_rgba(2,44,34,0.7)]"
          : "border-slate-200 bg-white shadow-[0_20px_50px_-30px_rgba(2,44,34,0.25)]"
      }`}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className={`text-xl font-black tracking-tight ${isBusiness ? "text-white" : "text-slate-950"}`}>
          {title}
        </h3>
        <span className={`h-2 w-10 rounded-full ${isBusiness ? "bg-emerald-400" : "bg-emerald-500"}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item}
            className={`flex items-center gap-3 rounded-xl border p-3.5 text-sm font-semibold ${
              isBusiness
                ? "border-white/10 bg-white/5 text-slate-100"
                : "border-slate-200 bg-slate-50 text-slate-800"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isBusiness ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              <WexonIcon name="check" size={12} strokeWidth={3} />
            </span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MobilePaymentPreview() {
  return (
    <PhoneFrame className="max-w-[20rem]">
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold text-slate-300">
          <span>WexPay</span>
          <span>Masa 03</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600">QR Aktif</p>
            <h3 className="text-xl font-black text-slate-950">Masa 03</h3>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
            Ödeme
          </span>
        </div>

        {[
          { name: "Flat White", count: 2, amount: "240 TL", selected: true },
          { name: "Avokado Tost", count: 1, amount: "310 TL", selected: true },
          { name: "Limonata", count: 2, amount: "190 TL", selected: false },
          { name: "San Sebastian", count: 1, amount: "220 TL", selected: true },
        ].map((item) => (
          <div
            key={item.name}
            className={`flex items-center justify-between rounded-xl border p-3 ${
              item.selected ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <div>
              <p className="text-sm font-bold text-slate-950">{item.name}</p>
              <p className="text-xs text-slate-500">{item.count} adet</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-950">{item.amount}</p>
              <p className="text-[10px] font-semibold text-slate-500">{item.selected ? "Seçili" : "Açık"}</p>
            </div>
          </div>
        ))}

        <div className="rounded-xl bg-slate-950 p-4 text-white">
          <div className="mb-1 flex items-center justify-between text-xs text-white/50">
            <span>Seçili toplam</span>
            <span>3 ürün</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black">770 TL</span>
            <span className="text-xs font-bold text-emerald-400">Ödemeye hazır</span>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-500 px-5 py-3 text-center text-sm font-bold text-white">
          Seçili ürünleri öde
        </div>
      </div>
    </PhoneFrame>
  );
}

export default function WexPayPage() {
  return (
    <>
      <WexonNavbar />
      <main className="flex-1 bg-[#f6f8f7] text-slate-950">
        {/* Hero */}
        <section className="px-5 pb-16 pt-24 sm:px-8 md:pt-28 lg:px-12">
          <div className="mx-auto max-w-[1180px]">
            <div className="relative overflow-hidden rounded-[36px] border border-emerald-200/80 bg-white px-6 py-12 shadow-[0_50px_120px_-55px_rgba(16,185,129,0.55)] sm:px-10 lg:px-14 lg:py-16">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full blur-3xl"
                style={{ background: "radial-gradient(circle, #10b981 0%, transparent 66%)", opacity: 0.16 }}
              />
              <div
                className="pointer-events-none absolute -bottom-20 -left-16 h-[280px] w-[280px] rounded-full blur-3xl"
                style={{ background: "radial-gradient(circle, #34d399 0%, transparent 70%)", opacity: 0.1 }}
              />

              <div className="relative z-10 grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center">
                <div>
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <Eyebrow>Pilot ürün</Eyebrow>
                    <Badge tone="dark">Birincil ürün</Badge>
                  </div>
                  <h1 className="mb-5 max-w-xl text-4xl font-black leading-[1.05] tracking-[-0.02em] text-slate-950 sm:text-5xl lg:text-[3.25rem]">
                    Tek QR ile menü, sipariş ve{" "}
                    <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                      ödeme operasyonu
                    </span>
                  </h1>
                  <p className="mb-8 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                    WexPay; QR menü, sepet, sipariş, masa yönetimi, ödeme ve fiş talebini tek panelde birleştirir.
                    Lisans ve erişim kararları Wexon Core üzerinden yönetilir — ödeme durumundan ayrı.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button href="/demo-request?product=wexpay" variant="primary" withArrow>
                      Demo Talep Et
                    </Button>
                    <Button href="/book-demo" variant="secondary">
                      Randevu Al
                    </Button>
                    <Button href="/products/wexpay#pricing" variant="ghost" className="text-emerald-700 hover:bg-emerald-50">
                      Paketleri İncele
                    </Button>
                  </div>
                </div>

                <div className="min-w-0">
                  <WexPayPreview data={WEXPAY_APP} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works — 7-step flow */}
        <SectionShell tone="white">
          <SectionHeading
            eyebrow="WexPay akışı"
            title={
              <>
                Tek QR ile siparişten ödemeye{" "}
                <span className="text-emerald-600">kesintisiz deneyim</span>
              </>
            }
            subtitle="Müşteri menüyü görüntüler, sepetini oluşturur, siparişini gönderir ve ödemesini tamamlar. Restoran tarafında masa, ödeme ve fiş talepleri canlı takip edilir."
          />
          <ol className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WEXPAY_FLOW_STEPS.map((step) => {
              const isBusiness = step.side === "business";
              return (
                <li
                  key={step.step}
                  className={`wx-lift flex items-start gap-3 rounded-2xl border p-4 ${
                    isBusiness
                      ? "border-slate-900 bg-slate-950 text-white shadow-[0_24px_54px_-28px_rgba(2,44,34,0.6)] sm:col-span-2 lg:col-span-4 lg:max-w-xl lg:justify-self-center"
                      : "border-slate-200 bg-white hover:border-emerald-200"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                      isBusiness ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {step.step}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <WexonIcon
                        name={step.icon}
                        size={14}
                        className={isBusiness ? "text-emerald-400" : "text-emerald-500"}
                      />
                      <h3 className={`text-sm font-bold ${isBusiness ? "text-white" : "text-slate-950"}`}>
                        {step.title}
                      </h3>
                    </div>
                    <p className={`mt-1 text-sm leading-relaxed ${isBusiness ? "text-slate-300" : "text-slate-600"}`}>
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </SectionShell>

        {/* Panel modules */}
        <SectionShell tone="canvas">
          <SectionHeading
            eyebrow="İşletme Paneli"
            title="Restoran ekibinin günlük operasyon modülleri"
            subtitle="WexPay işletme paneli; masa, sipariş, menü, ödeme ve raporları tek arayüzde toplar."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {panelModules.map((module) => (
              <FeatureChip
                key={module.title}
                icon={module.icon}
                title={module.title}
                description={module.description}
                layout="stack"
              />
            ))}
          </div>
        </SectionShell>

        {/* Customer QR + mobile */}
        <SectionShell tone="white">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <MobilePaymentPreview />
            <div>
              <Eyebrow>Müşteri QR Deneyimi</Eyebrow>
              <h2 className="mb-4 mt-5 text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
                Masadan menü, sipariş ve{" "}
                <span className="text-emerald-600">seçili ödeme</span>
              </h2>
              <p className="mb-8 text-base leading-relaxed text-slate-600 sm:text-lg">
                Müşteri QR okutur, menüyü görür, sepet oluşturur, sipariş gönderir ve hesabını tam veya
                seçili ürünlerle öder. Fiş talebi anında işletme paneline düşer.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Açılış ekranı", "Menü görüntüleme", "Sipariş oluşturma", "Hesap ödeme", "Fiş talebi", "Mobil uyumlu"].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {item}
                    </div>
                  ),
                )}
              </div>
              <div className="mt-8">
                <Button href="/demo-request?product=wexpay" variant="primary" withArrow>
                  QR Müşteri Deneyimi İçin Başvur
                </Button>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* Dual experience */}
        <SectionShell tone="canvas">
          <SectionHeading
            eyebrow="Çift Taraflı Deneyim"
            title="Müşteri ve işletme aynı operasyon akışında buluşur"
            subtitle="QR üzerinden başlayan müşteri deneyimi; ürün, masa, sipariş ve ödeme yönetimiyle tek panelde birleşir."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <ExperienceCard title="Müşteri tarafı" items={customerExperience} side="customer" />
            <ExperienceCard title="İşletme tarafı" items={businessExperience} side="business" />
          </div>
        </SectionShell>

        {/* Live table panel — real WexPayPreview */}
        <SectionShell id="table-panel" tone="subtle">
          <SectionHeading
            eyebrow="Canlı Panel Önizlemesi"
            title={
              <>
                Masa, sipariş ve ödeme{" "}
                <span className="text-emerald-600">tek panelde</span>
              </>
            }
            subtitle="Masaları, açık siparişleri, ödeme durumlarını ve fiş taleplerini operasyon panelinden anlık takip edin."
          />
          <div className="mx-auto mt-12 max-w-5xl">
            <WexPayPreview data={WEXPAY_APP} />
            <p className="mt-5 text-center text-sm text-slate-500">
              Örnek arayüz — canlı demoda gerçek operasyon verisiyle çalışır. Erişim kararları Wexon Core üzerinden gelir.
            </p>
          </div>
        </SectionShell>

        {/* Core connection */}
        <SectionShell tone="canvas">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_70px_-40px_rgba(2,44,34,0.3)]">
            <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
              <div className="border-b border-slate-200 p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
                <Eyebrow>Wexon Core Bağlantılı</Eyebrow>
                <h2 className="mb-4 mt-5 text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
                  Paket, lisans ve erişim Core ile çalışır
                </h2>
                <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                  WexPay kendi lisans mantığını taşımaz. Aylık, yıllık ve tek seferlik lisans modelleri Wexon Core
                  üzerinden yönetilir. Erişim; ödeme durumundan değil, lisans ve entitlement mantığından hesaplanır.
                </p>
              </div>
              <div className="grid gap-4 p-8 sm:grid-cols-2 sm:p-10 lg:p-12">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">Access state</p>
                  <p className="mt-2 text-lg font-black text-slate-950">Lisans + entitlement</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Ürün erişimi ödeme durumundan bağımsız; Core karar verir.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Billing state</p>
                  <p className="mt-2 text-lg font-black text-slate-950">Ödeme durumu ayrı</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Fatura ve tahsilat ayrı takip edilir; erişimle karışmaz.
                  </p>
                </div>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-5 ${
                      plan.highlighted ? "border-emerald-300 bg-emerald-50/80 sm:col-span-2" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-black text-slate-950">{plan.name}</p>
                      <Badge tone="accent">Core ile aktif</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Aylık · Yıllık · Tek seferlik</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionShell>

        {/* Features */}
        <SectionShell tone="white">
          <SectionHeading
            eyebrow="Özellikler"
            title="Restoran operasyonu için temel yetenekler"
            subtitle="QR menüden sanal POS ve Core erişimine kadar günlük operasyonun ihtiyaç duyduğu ana modüller tek üründe birleşir."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <FeatureChip
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                layout="stack"
              />
            ))}
          </div>
        </SectionShell>

        {/* Pricing */}
        <SectionShell id="pricing" tone="canvas">
          <SectionHeading
            eyebrow="Paket Önizlemesi"
            title="WexPay paketleri"
            subtitle="Aylık, yıllık ve tek seferlik lisans seçenekleri; masa, şube, personel, rapor ve entegrasyon seviyelerine göre yönetilir."
          />
          <div className="mx-auto mt-8 mb-8 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center text-sm font-semibold leading-relaxed text-emerald-800">
            Paketler temel özellikleri kapatmak için değil, işletmenin ölçeğine göre limit, raporlama, yetki ve
            entegrasyon seviyesini belirlemek için tasarlanmıştır.
          </div>
          <div className="mb-8 rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-32px_rgba(2,44,34,0.25)]">
            <p className="mb-4 text-sm font-bold text-slate-950">Tüm paketlerde bulunan temel WexPay operasyonu</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {corePackageFeatures.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="min-w-0">{feature}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                href={`/checkout?product=wexpay&plan=${plan.id}`}
                tone="light"
                className={plan.id === "pro" ? "sm:col-span-2 lg:col-span-1" : undefined}
              />
            ))}
          </div>
        </SectionShell>

        {/* POS + Core notes */}
        <SectionShell tone="white">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-[#f6f8f7] p-8 sm:p-10">
              <Eyebrow>Sanal POS</Eyebrow>
              <h2 className="mb-4 mt-5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Sanal POS ve ödeme altyapısı
              </h2>
              <p className="text-base leading-relaxed text-slate-600">
                İlk production sürümünde operasyonel tahsilat <strong>manuel ödeme</strong> ile yapılır. PayTR sanal
                POS, pilot merchant doğrulaması ve <code className="text-sm">WEXPAY_PAYTR_ENABLE_API=true</code> sonrası
                tenant bazlı açılır. Demo ortamında ödeme akışı simüle edilir.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-[#f6f8f7] p-8 sm:p-10">
              <Eyebrow>Wexon Core</Eyebrow>
              <h2 className="mb-4 mt-5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Wexon Core ile çalışır
              </h2>
              <p className="text-base leading-relaxed text-slate-600">
                WexPay lisans, abonelik, paket, fatura ve erişim yönetimini Wexon Core üzerinden alır. Ödeme (billing
                state) ile ürün erişimi (access state) Core&apos;da ayrı hesaplanır; erişim kararı lisans ve
                entitlement mantığına dayanır.
              </p>
            </div>
          </div>
        </SectionShell>

        {/* Final CTA */}
        <section id="cta" className="scroll-mt-24 px-5 pb-20 pt-4 sm:px-8 sm:pb-24 lg:px-12 lg:pb-28">
          <div className="mx-auto max-w-[1180px]">
            <div className="wx-dark-panel relative overflow-hidden rounded-[36px] border border-white/10 px-6 py-14 text-center shadow-[0_50px_120px_-50px_rgba(2,44,34,0.9)] sm:px-10 sm:py-16 lg:px-16">
              <div className="pointer-events-none absolute inset-0 wx-grid-overlay opacity-80" />
              <div className="relative z-10 mx-auto max-w-2xl">
                <Badge tone="onDark" dot>
                  WexPay Pilot
                </Badge>
                <h2 className="mt-6 text-3xl font-black tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                  Restoranınız için WexPay&apos;i{" "}
                  <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                    birlikte planlayalım
                  </span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300/90 sm:text-lg">
                  QR menü, sipariş, masa yönetimi, ödeme ve fiş talebi akışlarını müşteri ve işletme tarafında
                  inceleyin.
                </p>
                <div className="mt-9 flex flex-col items-stretch gap-3 sm:mx-auto sm:max-w-sm lg:max-w-none lg:flex-row lg:flex-wrap lg:items-center lg:justify-center">
                  <Button href="/demo-request?product=wexpay" variant="primary" size="lg" withArrow fullWidth className="lg:w-auto">
                    Demo Talep Et
                  </Button>
                  <Button href="/book-demo" variant="onDarkGhost" size="lg" fullWidth className="lg:w-auto">
                    Randevu Al
                  </Button>
                  <Button href="/login?next=%2Fapps%2Fwexpay" variant="onDarkGhost" size="lg" fullWidth className="lg:w-auto">
                    Giriş Yap
                  </Button>
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
