import Link from "next/link";
import DemoRequestForm from "@/components/marketing/DemoRequestForm";
import WexonFormAside from "@/components/marketing/WexonFormAside";
import WexonFormShell from "@/components/marketing/WexonFormShell";

export default function DemoRequestPage() {
  const demoCards = [
    "WexPay müşteri QR deneyimi",
    "WexPay işletme paneli",
    "Menü, sipariş ve ödeme akışı",
    "Masa, fiş ve rapor takibi",
    "Wexon Core lisans yapısı",
    "Paket ve kurulum planı",
  ];

  return (
    <WexonFormShell
      after={
        <>
          <section className="mt-16">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                Demo İçeriği
              </span>
              <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
                Demo görüşmesinde neleri gösteriyoruz?
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {demoCards.map((card) => (
                <div key={card} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
                  <div className="mb-4 h-2 w-10 rounded-full bg-emerald-500" />
                  <p className="text-base font-bold text-slate-950">{card}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-[32px] border border-slate-900 bg-slate-950 p-8 text-center text-white shadow-2xl shadow-slate-950/20 sm:p-12">
            <h2 className="text-3xl font-black tracking-[-0.02em] sm:text-4xl">Hemen denemek ister misiniz?</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300">
              Beklemeden WexPay mini demosunu açın; QR sipariş ve ödeme simülasyonunu 1 dakikada test edin.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/demo/wexpay"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-emerald-400"
              >
                WexPay Demo Aç
              </Link>
              <Link
                href="/book-demo"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10"
              >
                Randevu Al
              </Link>
            </div>
          </section>
        </>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <WexonFormAside
          badge="Demo Talebi"
          headline="Wexon ürünleri için demo talep edin"
          description="WexPay başta olmak üzere Wexon ekosistemindeki ürünleri işletmenize göre nasıl kullanabileceğinizi birlikte planlayalım."
          title="Demo görüşmesinde neleri gösteriyoruz?"
          items={[
            "Canlı WexPay demo akışı",
            "İşletme tipine göre ürün önerisi",
            "Paket ve lisans değerlendirmesi",
            "Kurulum yol haritası",
          ]}
        />
        <DemoRequestForm />
      </section>
    </WexonFormShell>
  );
}
