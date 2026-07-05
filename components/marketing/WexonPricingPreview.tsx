import Link from "next/link";

const BILLING_MODELS: { name: string; description: string; tag: string; highlight?: boolean }[] = [
  {
    name: "Aylık",
    description: "Esnek başlangıç. Ay bazında kullanım, kolay yükseltme ve düşürme.",
    tag: "Esnek",
  },
  {
    name: "Yıllık",
    description: "Uzun dönem kullanım için avantajlı yıllık abonelik modeli.",
    tag: "Önerilen",
    highlight: true,
  },
  {
    name: "Tek Seferlik",
    description: "Kurumsal kurgular için tek seferlik lisans alımı seçeneği.",
    tag: "Kurumsal",
  },
];

const WEXPAY_TIERS: { name: string; description: string; features: string[]; highlight?: boolean }[] = [
  {
    name: "Basic",
    description: "Küçük kafeler için başlangıç paketi.",
    features: ["QR menü ve sipariş", "Temel ödeme akışı", "Temel raporlar"],
  },
  {
    name: "Standard",
    description: "Büyüyen işletmeler için tam operasyon paketi.",
    features: ["Tüm Basic özellikleri", "Masa yönetimi", "Fiş talebi", "Gelişmiş raporlar"],
    highlight: true,
  },
  {
    name: "Pro",
    description: "Çok şubeli ve yoğun kullanım için profesyonel paket.",
    features: ["Tüm Standard özellikleri", "Çoklu şube", "Yetki kurguları", "Öncelikli destek"],
  },
];

export default function WexonPricingPreview() {
  return (
    <section id="pricing" className="relative bg-white px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32 xl:px-16 2xl:px-20">
      <div className="mx-auto max-w-[1480px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Paket modeli
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Sade ve <span className="text-emerald-600">ölçeklenebilir</span> paket modeli
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            Paket farkları temel özellikleri kapatmak için değil; limit, destek, rapor, yetki ve
            entegrasyon seviyesini belirlemek için tasarlanır.
          </p>
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            QR menü ve temel operasyon tüm WexPay paketlerinde bulunur.
          </p>
        </div>

        {/* Billing models — light cards */}
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {BILLING_MODELS.map((m) => (
            <div
              key={m.name}
              className={`relative rounded-3xl border p-7 transition-all hover:-translate-y-1 ${
                m.highlight
                  ? "border-emerald-200 bg-emerald-50/40 shadow-xl shadow-emerald-100/60"
                  : "border-slate-200 bg-white shadow-sm shadow-slate-200/50 hover:shadow-lg"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tight text-slate-950">{m.name}</h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    m.highlight ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {m.tag}
                </span>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{m.description}</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                {[
                  "Wexon Core dahil",
                  "Lisans, abonelik, fatura akışı",
                  "Paket seviyesine göre limit",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7.5L5.5 11L12 3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* WexPay tiers — dark premium block */}
        <div className="relative mt-14 overflow-hidden rounded-[28px] border border-white/5 bg-[radial-gradient(circle_at_15%_-20%,#0d3326_0%,transparent_55%),linear-gradient(180deg,#06101c_0%,#0a1626_100%)] px-5 py-14 shadow-2xl shadow-slate-950/30 sm:rounded-[36px] sm:px-10 sm:py-16 lg:px-16 lg:py-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(circle at 50% 30%, black 0%, black 60%, transparent 95%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 30%, black 0%, black 60%, transparent 95%)",
            }}
          />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-emerald-500/15 blur-[140px]" />

          <div className="relative">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-emerald-300">
                WexPay paket seviyeleri
              </span>
              <h3 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
                İşletmenizin büyüklüğüne göre paket
              </h3>
              <p className="mx-auto mt-4 max-w-xl text-base text-slate-300/90">
                QR menü ve temel operasyon tüm WexPay paketlerinde bulunur. Paket seviyesi; limit,
                rapor derinliği ve destek seviyesini belirler.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
              {WEXPAY_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative rounded-2xl border p-6 backdrop-blur transition-all hover:-translate-y-1 ${
                    tier.highlight
                      ? "border-emerald-400/50 bg-emerald-500/10 shadow-2xl shadow-emerald-500/30 lg:scale-[1.03]"
                      : "border-white/10 bg-white/[0.04] hover:border-white/20"
                  }`}
                >
                  {tier.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-lg shadow-emerald-500/30">
                      En çok tercih edilen
                    </span>
                  )}
                  <h4 className="text-2xl font-black tracking-tight text-white">{tier.name}</h4>
                  <p className="mt-2 text-sm text-slate-300/80">{tier.description}</p>
                  <ul className="mt-5 space-y-2.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-200">
                        <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7.5L5.5 11L12 3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/checkout?product=wexpay&plan=standard"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 sm:w-auto"
              >
                WexPay aboneliği başlat
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/demo-request"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition-colors hover:border-white/30 hover:bg-white/10 sm:w-auto"
              >
                Demo Talep Et
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
