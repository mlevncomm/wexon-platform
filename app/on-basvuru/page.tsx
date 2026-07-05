import type { Metadata } from "next";
import Image from "next/image";
import DemoRequestForm from "@/components/marketing/DemoRequestForm";
import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";
import phoneMockup from "@/wexon.dev/mockup/iPhone-16-Pro-Mockup-Dusk-Series.png";

export const metadata: Metadata = {
  title: "Ön Başvuru",
  description:
    "Wexon sistemleri hazırlık modundayken WexPay, WexHotel ve WexB2B için ön başvuru alınır.",
  alternates: { canonical: "/on-basvuru" },
};

const products = [
  {
    name: "WexPay",
    status: "Öncelikli erişim",
    description: "QR menü, masa yönetimi, sipariş, ödeme, fiş talebi ve restoran operasyon paneli.",
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    marker: "bg-emerald-500",
    metric: "Restoran",
  },
  {
    name: "WexHotel",
    status: "Planlama",
    description: "Oda, rezervasyon, misafir, ödeme, fatura ve personel süreçleri için otel yönetimi.",
    accent: "border-sky-200 bg-sky-50 text-sky-700",
    marker: "bg-sky-500",
    metric: "Konaklama",
  },
  {
    name: "WexB2B",
    status: "Planlama",
    description: "Bayi, toptan satış, teklif, sipariş, cari ve ödeme takibi için B2B yönetim altyapısı.",
    accent: "border-violet-200 bg-violet-50 text-violet-700",
    marker: "bg-violet-500",
    metric: "Ticaret",
  },
] as const;

const productOptions = products.map((product) => product.name);

const steps = [
  {
    title: "Başvuru",
    description: "İletişim ve işletme bilgileriniz güvenli şekilde alınır.",
  },
  {
    title: "Değerlendirme",
    description: "Ürün, lisans ve operasyon kapsamı Wexon ekibi tarafından netleştirilir.",
  },
  {
    title: "Erişim planı",
    description: "Uygun kurulum ve onboarding yolu sizinle paylaşılır.",
  },
];

const highlights = [
  { label: "Durum", value: "Hazırlık modu" },
  { label: "Odak", value: "Ön başvuru" },
  { label: "Kapsam", value: "3 ürün" },
];

const trustPoints = [
  "Güvenli kayıt",
  "Ücretsiz ön başvuru",
  "Wexon ekibi geri dönüş",
];

function MaintenanceStatusPill() {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-3 py-1.5 text-[10px] font-black text-emerald-100 backdrop-blur sm:px-4 sm:py-2 sm:text-xs">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
      <span className="truncate">Sistemler geçici erişim modunda</span>
    </div>
  );
}

function PreApplicationFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-10 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
      <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <WexonBrandLogo variant="dark" className="h-8" />
          <p className="text-sm font-semibold text-slate-500">
            Wexon ön başvuru dönemi · Paneller geçici olarak kapalı
          </p>
        </div>
        <p className="text-xs font-semibold text-slate-400">© 2026 Wexon Technologies</p>
      </div>
    </footer>
  );
}

export default function PreApplicationPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f6] text-slate-950">
      <section className="relative overflow-hidden bg-[#03150f] pb-16 pt-6 text-white sm:pb-20 sm:pt-7 lg:pb-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(52,211,153,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.18) 1px, transparent 1px)",
            backgroundSize: "76px 76px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-40 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-[min(100%,720px)] -translate-x-1/2 bg-gradient-to-t from-emerald-500/10 to-transparent" />

        <div className="relative mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <WexonBrandLogo variant="hero" priority className="h-9 md:h-10" />
            <MaintenanceStatusPill />
          </header>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,480px)] lg:items-start lg:gap-12 lg:mt-14">
            <div id="basvuru" className="order-1 scroll-mt-6 lg:order-2 lg:sticky lg:top-8">
              <DemoRequestForm
                mode="application"
                defaultSource="on-basvuru"
                productOptions={[...productOptions]}
                appearance="minimal"
              />
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-200/80">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="order-2 min-w-0 lg:order-1">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100 backdrop-blur">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                Wexon ön başvuru
              </div>

              <h1 className="mt-5 max-w-3xl text-[clamp(2rem,5.5vw,4.25rem)] font-black leading-[1.02] tracking-[-0.03em] text-white">
                Wexon sistemleri yeni erişim dönemine hazırlanıyor.
              </h1>

              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300 sm:text-lg sm:leading-8">
                WexPay, WexHotel ve WexB2B için başvuru sürecini tek ekranda topladık. Paneller geçici olarak kapalı;
                başvurunuzu iletip ürün erişim planlamasına dahil olabilirsiniz.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 backdrop-blur sm:border-l-white/14 sm:rounded-none sm:border-l sm:bg-white/[0.06] sm:first:rounded-l-2xl sm:last:rounded-r-2xl"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200 sm:text-[11px]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="relative mt-8 hidden lg:block">
                <div className="relative mx-auto h-[280px] max-w-[420px]">
                  <Image
                    src={phoneMockup}
                    alt="Wexon mobil arayüz önizlemesi"
                    fill
                    className="object-contain object-left drop-shadow-2xl"
                    sizes="(max-width: 1024px) 0px, 420px"
                    priority
                  />
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {steps.map((step, index) => (
                  <article
                    key={step.title}
                    className="rounded-[22px] border border-white/10 bg-white/[0.07] p-4 backdrop-blur sm:rounded-[24px] sm:p-5"
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/12 text-sm font-black text-emerald-100 ring-1 ring-emerald-300/20 sm:mb-4 sm:h-10 sm:w-10 sm:rounded-2xl">
                      0{index + 1}
                    </div>
                    <h2 className="text-base font-black text-white">{step.title}</h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-400">{step.description}</p>
                  </article>
                ))}
              </div>

              <a
                href="#basvuru"
                className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15 sm:hidden"
              >
                Ön başvuru formuna git
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="relative -mt-8 rounded-t-[32px] bg-[#f5f7f6] px-4 pb-14 pt-12 sm:-mt-10 sm:rounded-t-[40px] sm:px-8 sm:pb-16 sm:pt-16 lg:px-12 xl:px-16 2xl:px-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

        <div className="mx-auto max-w-[1440px]">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                Ürün kapsamı
              </span>
              <h2 className="mt-4 max-w-2xl text-2xl font-black tracking-[-0.02em] text-slate-950 sm:text-3xl lg:text-4xl">
                Başvuru aldığımız Wexon sistemleri
              </h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-relaxed text-slate-600">
              Her ürün Wexon Core lisans ve erişim katmanı altında planlanır. Başvuru sonrası ekip, doğru ürün
              kapsamını sizinle birlikte netleştirir.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <article
                key={product.name}
                className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/80 sm:rounded-[28px] sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{product.metric}</p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.02em] text-slate-950 sm:text-2xl">{product.name}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black sm:text-[11px] ${product.accent}`}>
                    {product.status}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:mt-5">{product.description}</p>
                <div className="mt-5 flex items-center gap-3 sm:mt-6">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${product.marker}`} />
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-black text-slate-400">Wexon Core</span>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-[28px] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-6 text-center shadow-sm shadow-emerald-100/50 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-700">Hazır mısınız?</p>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.02em] text-slate-950 sm:text-3xl">
              Ön başvurunuzu birkaç dakikada tamamlayın
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-relaxed text-slate-600">
              Formu doldurun; Wexon ekibi başvurunuzu inceleyip size uygun erişim planını paylaşsın.
            </p>
            <a
              href="#basvuru"
              className="mt-6 inline-flex w-full max-w-sm items-center justify-center rounded-full bg-emerald-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 sm:w-auto"
            >
              Forma dön
            </a>
          </div>
        </div>
      </section>

      <PreApplicationFooter />
    </main>
  );
}
