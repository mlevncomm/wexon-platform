import type { Metadata } from "next";
import Image from "next/image";
import DemoRequestForm from "@/components/marketing/DemoRequestForm";
import wexonLogo from "@/wexon.dev/Ana-Logo/wexon-dev.png";

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
  },
  {
    name: "WexHotel",
    status: "Planlama",
    description: "Oda, rezervasyon, misafir, ödeme, fatura ve personel süreçleri için otel yönetimi.",
  },
  {
    name: "WexB2B",
    status: "Planlama",
    description: "Bayi, toptan satış, teklif, sipariş, cari ve ödeme takibi için B2B yönetim altyapısı.",
  },
  {
    name: "Wexon Core",
    status: "Merkez katman",
    description: "Lisans, abonelik, ürün erişimi, kullanıcı ve organizasyon yönetimi için ortak çekirdek.",
  },
];

const steps = ["Başvurunuz alınır", "İhtiyaç ve ürün kapsamı netleştirilir", "Uygun erişim planı hazırlanır"];

export default function PreApplicationPage() {
  return (
    <main className="min-h-screen bg-[#03150f] text-white">
      <section className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.35),transparent_34%),linear-gradient(180deg,#063322_0%,#042418_46%,#f6f8f7_46%,#f6f8f7_100%)]" />
        <div className="relative mx-auto max-w-[1360px]">
          <div className="flex items-center justify-between">
            <Image src={wexonLogo} alt="Wexon" className="h-9 w-auto object-contain sm:h-11" priority sizes="180px" />
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
              Bakım modu
            </span>
          </div>

          <div className="grid gap-8 pb-10 pt-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:pb-16 lg:pt-20">
            <div>
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-xs font-black text-emerald-100">
                Wexon sistemleri hazırlık aşamasında
              </span>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-[-0.02em] sm:text-5xl lg:text-6xl">
                Ön başvuru alıyoruz; paneller geçici olarak kapalı.
              </h1>
              <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-300 sm:text-lg">
                Wexon Core, WexPay, WexHotel ve WexB2B sistemleri yeni erişim düzenine hazırlanıyor. Bu süreçte
                public site ve müşteri panelleri yerine yalnızca ön başvuru formu açıktır.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {steps.map((step, index) => (
                  <div key={step} className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
                    <p className="text-sm font-black text-emerald-200">0{index + 1}</p>
                    <p className="mt-3 text-sm font-bold leading-relaxed text-white">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <DemoRequestForm mode="application" defaultSource="on-basvuru" />
          </div>

          <section className="rounded-[32px] border border-slate-200 bg-white p-5 text-slate-950 shadow-xl shadow-slate-950/10 sm:p-8">
            <div className="mb-6">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Sistemler
              </span>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.02em] sm:text-3xl">Wexon ürün kapsamı</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {systems.map((system) => (
                <article key={system.name} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-black text-slate-950">{system.name}</h3>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                      {system.status}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600">{system.description}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
