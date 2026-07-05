import type { Metadata } from "next";
import Link from "next/link";
import DemoRequestForm from "@/components/marketing/DemoRequestForm";
import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";
import { publicUrl } from "@/lib/wexon/urls";

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
    stripe: "from-emerald-400 via-emerald-500 to-teal-500",
  },
  {
    name: "WexHotel",
    status: "Planlama",
    description: "Oda, rezervasyon, misafir, ödeme, fatura ve personel süreçleri için otel yönetimi.",
    accent: "border-indigo-200 bg-indigo-50 text-indigo-700",
    stripe: "from-indigo-400 via-indigo-500 to-violet-500",
  },
  {
    name: "WexB2B",
    status: "Planlama",
    description: "Bayi, toptan satış, teklif, sipariş, cari ve ödeme takibi için B2B yönetim altyapısı.",
    accent: "border-amber-200 bg-amber-50 text-amber-700",
    stripe: "from-amber-400 via-orange-500 to-amber-500",
  },
] as const;

const productOptions = products.map((product) => product.name);

const steps = [
  {
    title: "Başvurunuz alınır",
    description: "İletişim ve işletme bilgileriniz Wexon ekibine iletilir.",
  },
  {
    title: "Kapsam netleştirilir",
    description: "İhtiyaç, ürün ve operasyon modeli birlikte değerlendirilir.",
  },
  {
    title: "Erişim planı hazırlanır",
    description: "Uygun lisans ve onboarding yol haritası paylaşılır.",
  },
];

const trustPoints = ["Gerçek hesap oluşturulmaz", "24 saat içinde dönüş hedefi", "Merkezi lisans modeli"];

export default function PreApplicationPage() {
  return (
    <main className="min-h-screen scroll-smooth bg-[#f6f8f7] text-slate-950">
      <section className="relative overflow-hidden border-b border-emerald-950/30 bg-[#03150f] font-sans text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(16,185,129,0.38),transparent_36%),linear-gradient(180deg,#063322_0%,#042418_58%,#02150f_100%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16,185,129,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.22) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="pointer-events-none absolute left-1/4 top-[8%] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-emerald-400/12 blur-[100px]" />

        <div className="relative mx-auto max-w-[1360px] px-5 py-8 sm:px-8 lg:px-12 lg:pb-20 xl:px-16 2xl:px-20">
          <Link href={publicUrl("/")} className="inline-flex items-center">
            <WexonBrandLogo variant="hero" priority />
          </Link>

          <div className="grid gap-8 pb-14 pt-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-10 lg:pb-16 lg:pt-14">
            <aside className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.06] p-6 sm:p-8 lg:sticky lg:top-8 lg:transition-transform lg:duration-300 lg:ease-out">
                  <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-[11px] font-black text-slate-200 sm:text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    Wexon sistemleri hazırlık aşamasında
                  </span>

                  <h1 className="mt-6 max-w-xl text-[clamp(2rem,4.2vw,3.75rem)] font-black leading-[1.06] tracking-[-0.02em] text-white">
                    Ön başvuru alıyoruz; paneller geçici olarak kapalı.
                  </h1>

                  <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-300 sm:text-lg">
                    WexPay, WexHotel ve WexB2B yeni erişim düzenine hazırlanıyor. Bu süreçte yalnızca ön başvuru formu
                    açıktır.
                  </p>

                  <div className="mt-8 space-y-3">
                    {steps.map((step, index) => (
                      <div
                        key={step.title}
                        className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition-colors duration-200 ease-out hover:border-emerald-400/20 hover:bg-white/[0.08]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-sm font-black text-emerald-200 ring-1 ring-emerald-400/20">
                          0{index + 1}
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-sm font-black text-white">{step.title}</p>
                          <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-400">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-2">
                    {trustPoints.map((point) => (
                      <span
                        key={point}
                        className="rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-[11px] font-black text-slate-300 backdrop-blur"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
            </aside>

              <DemoRequestForm
                mode="application"
                defaultSource="on-basvuru"
                productOptions={[...productOptions]}
                appearance="minimal"
              />
            </div>
          </div>
        </section>

        <section id="urunler" className="scroll-mt-8 px-5 py-16 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1360px]">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                Ürünler
              </span>
              <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">Wexon ürün kapsamı</h2>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                WexPay, WexHotel ve WexB2B için erişim ve lisans modeli yeniden yapılandırılıyor.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.name}
                  className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/80"
                >
                  <div className={`mb-5 h-1.5 w-12 rounded-full bg-gradient-to-r ${product.stripe}`} />
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-black text-slate-950">{product.name}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${product.accent}`}>
                      {product.status}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600">{product.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
  );
}
