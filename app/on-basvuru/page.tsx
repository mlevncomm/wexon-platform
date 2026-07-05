import type { Metadata } from "next";
import DemoRequestForm from "@/components/marketing/DemoRequestForm";
import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";

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

export default function PreApplicationPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f6] text-slate-950">
      <section className="relative overflow-hidden bg-[#03150f] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(52,211,153,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.18) 1px, transparent 1px)",
            backgroundSize: "76px 76px",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(16,185,129,0.24)_0%,rgba(3,21,15,0)_34%),linear-gradient(180deg,#05291d_0%,#03150f_100%)]" />

        <div className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-7 sm:px-8 lg:px-12 lg:pb-16 xl:px-16 2xl:px-20">
          <header>
            <WexonBrandLogo variant="hero" priority className="h-9 md:h-10" />
          </header>

          <div className="grid gap-8 pt-10 sm:pt-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.72fr)] lg:items-start lg:gap-10 lg:pt-16">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100 backdrop-blur">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                Wexon ön başvuru
              </div>

              <h1 className="mt-6 max-w-5xl text-[clamp(2rem,5vw,4.25rem)] font-black leading-[1.02] tracking-[-0.02em] text-white">
                Wexon sistemleri yeni erişim dönemine hazırlanıyor.
              </h1>

              <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-slate-300 sm:text-lg">
                WexPay, WexHotel ve WexB2B için başvuru sürecini tek ekranda topladık. Paneller geçici olarak kapalı;
                başvurunuzu buradan iletip ürün erişim planlamasına dahil olabilirsiniz.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur sm:rounded-none sm:border-l sm:border-white/14 sm:first:rounded-l-2xl sm:last:rounded-r-2xl"
                  >
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200">{item.label}</p>
                    <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
                {steps.map((step, index) => (
                  <article key={step.title} className="rounded-[24px] border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/12 text-sm font-black text-emerald-100 ring-1 ring-emerald-300/20">
                      0{index + 1}
                    </div>
                    <h2 className="text-base font-black text-white">{step.title}</h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-400">{step.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div id="basvuru" className="scroll-mt-6 lg:sticky lg:top-8">
              <div className="rounded-[34px] border border-white/16 bg-white/[0.12] p-2 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl">
                <DemoRequestForm
                  mode="application"
                  defaultSource="on-basvuru"
                  productOptions={[...productOptions]}
                  appearance="minimal"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f7f6] px-5 py-14 sm:px-8 lg:px-12 lg:py-20 xl:px-16 2xl:px-20">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                Ürün kapsamı
              </span>
              <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
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
                className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/80"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{product.metric}</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.02em] text-slate-950">{product.name}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black ${product.accent}`}>
                    {product.status}
                  </span>
                </div>
                <p className="mt-5 text-sm font-semibold leading-relaxed text-slate-600">{product.description}</p>
                <div className="mt-6 flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${product.marker}`} />
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-black text-slate-400">Wexon Core</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
