import type { Metadata } from "next";
import Link from "next/link";
import DemoRequestForm from "@/components/marketing/DemoRequestForm";
import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";
import { publicUrl } from "@/lib/wexon/urls";

export const metadata: Metadata = {
  title: "Ön Başvuru",
  description:
    "Wexon sistemleri bakım ve hazırlık modundayken WexPay, WexHotel, WexB2B ve Wexon Core için ön başvuru alınır.",
  alternates: { canonical: "/on-basvuru" },
};

const systems = [
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
  {
    name: "Wexon Core",
    status: "Merkez katman",
    description: "Lisans, abonelik, ürün erişimi, kullanıcı ve organizasyon yönetimi için ortak çekirdek.",
    accent: "border-sky-200 bg-sky-50 text-sky-700",
    stripe: "from-sky-400 via-cyan-500 to-teal-500",
  },
] as const;

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

const trustPoints = ["Gerçek hesap oluşturulmaz", "24 saat içinde dönüş hedefi", "Wexon Core merkezli erişim"];

export default function PreApplicationPage() {
  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-950">
      <section className="relative overflow-hidden border-b border-emerald-950/30 bg-[#03150f] font-sans text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(16,185,129,0.38),transparent_36%),radial-gradient(circle_at_88%_12%,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,#063322_0%,#042418_58%,#02150f_100%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16,185,129,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.22) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-[12%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-400/18 blur-[110px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-[760px] -translate-x-1/2 rounded-full bg-emerald-500/12 blur-[90px]" />

        <div className="relative mx-auto max-w-[1360px] px-5 py-8 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <Link href={publicUrl("/")} className="inline-flex items-center">
            <WexonBrandLogo variant="hero" priority />
          </Link>

          <div className="grid gap-8 pb-14 pt-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-10 lg:pb-20 lg:pt-14">
            <aside className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(16,185,129,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-8 lg:sticky lg:top-8">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                  backgroundSize: "48px 48px",
                }}
              />

              <div className="relative">
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-[11px] font-black text-slate-200 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
                  Wexon sistemleri hazırlık aşamasında
                </span>

                <h1 className="mt-6 max-w-xl text-[clamp(2rem,4.2vw,3.75rem)] font-black leading-[1.06] tracking-[-0.02em] text-white">
                  Ön başvuru alıyoruz; paneller geçici olarak kapalı.
                </h1>

                <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-300 sm:text-lg">
                  Wexon Core, WexPay, WexHotel ve WexB2B yeni erişim düzenine hazırlanıyor. Bu süreçte yalnızca ön
                  başvuru formu açıktır.
                </p>

                <div className="mt-8 space-y-3">
                  {steps.map((step, index) => (
                    <div
                      key={step.title}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition-colors hover:border-emerald-400/20 hover:bg-white/[0.08]"
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
              </div>
            </aside>

            <div className="relative lg:pt-2">
              <div className="pointer-events-none absolute -inset-3 rounded-[36px] bg-emerald-400/10 blur-2xl" />
              <div className="relative">
                <DemoRequestForm mode="application" defaultSource="on-basvuru" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mx-auto max-w-[1360px]">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
              Sistemler
            </span>
            <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">Wexon ürün kapsamı</h2>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
              Tek Core katmanı üzerinde konumlanan ürünlerin erişim ve lisans modeli yeniden yapılandırılıyor.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {systems.map((system) => (
              <article
                key={system.name}
                className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/80"
              >
                <div className={`mb-5 h-1.5 w-12 rounded-full bg-gradient-to-r ${system.stripe}`} />
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-black text-slate-950">{system.name}</h3>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${system.accent}`}>
                    {system.status}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600">{system.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
