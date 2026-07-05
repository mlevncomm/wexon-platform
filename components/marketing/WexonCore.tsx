import Link from "next/link";

const MODULES: { title: string; description: string; icon: React.ReactNode }[] = [
  {
    title: "Müşteri yönetimi",
    description: "Tüm Wexon ürünlerinde tek müşteri kaydı.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0116 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Lisans yönetimi",
    description: "Ürün başına lisans tahsisi ve takibi.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="12" r="4" />
        <path d="M13 12h8M17 12v4M21 12v3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Abonelik yönetimi",
    description: "Aylık, yıllık ve tek seferlik abonelikler.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 0115.5-6.3L21 8" strokeLinecap="round" />
        <path d="M21 4v4h-4M21 12a9 9 0 01-15.5 6.3L3 16" strokeLinecap="round" />
        <path d="M3 20v-4h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Paket yönetimi",
    description: "Basic, Standard, Pro paket kurguları.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
        <path d="M3 13l9 5 9-5M3 17l9 5 9-5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Fatura ve ödeme",
    description: "E-Fatura, tahsilat ve geçmiş takibi.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 3h11l3 3v15l-3-2-2 2-3-2-3 2-3-2V3z" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Yetki ve erişim",
    description: "Roller, izinler ve şube bazlı erişim.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function WexonCore() {
  return (
    <section id="core" className="relative bg-white px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32 xl:px-16 2xl:px-20">
      <div className="mx-auto max-w-[1480px]">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          {/* Left: explanation */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">
              Wexon Core
            </span>
            <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]">
              Tüm ürünleri besleyen{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                merkezi altyapı
              </span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
              Wexon Core; müşteri, lisans, abonelik, paket, fatura, ödeme ve yetki yönetiminin
              merkezi altyapısıdır. Her Wexon ürünü Core üzerinden konuşur, böylece operasyon, satış
              ve müşteri verisi tek bir yerde birleşir.
            </p>

            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              {[
                "Ürün başına ayrı kullanıcı yönetimi yok",
                "Tek müşteri kartı tüm ürünlerde geçerli",
                "Abonelik ve fatura akışı merkezi",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5dff65]" />
                  </span>
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book-demo"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
              >
                Wexon Core yapısını planlayalım
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/products/wexpay"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                WexPay&apos;de Görün
              </Link>
            </div>
          </div>

          {/* Right: module grid + connector strip */}
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODULES.map((m) => (
                <div
                  key={m.title}
                  className="group relative rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shadow-[#5dff65]/20">
                      {m.icon}
                    </div>
                    <h3 className="text-[15px] font-bold text-slate-950">{m.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">{m.description}</p>
                </div>
              ))}
            </div>

            {/* Connector strip */}
            <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/5 bg-[linear-gradient(135deg,#0a1626_0%,#0f2942_100%)] p-5 shadow-xl shadow-slate-900/20 sm:p-6">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.15]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              <div className="pointer-events-none absolute -left-12 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-[#5dff65]/30 blur-3xl" />

              <div className="relative flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center justify-center rounded-xl bg-[#5dff65]/15 px-4 py-3 text-center text-sm font-bold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                  WexPay
                </div>
                <span className="hidden text-emerald-300/60 sm:inline" aria-hidden>
                  →
                </span>
                <div className="flex flex-1 items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-bold text-white ring-1 ring-inset ring-white/10">
                  Wexon Core
                </div>
                <span className="hidden text-emerald-300/60 sm:inline" aria-hidden>
                  →
                </span>
                <div className="flex flex-1 items-center justify-center rounded-xl bg-white/5 px-4 py-3 text-center text-[13px] font-bold text-slate-300 ring-1 ring-inset ring-white/10">
                  Lisans / Abonelik / Fatura
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {["Tek müşteri kartı", "Merkezi lisans", "Birleşik fatura akışı"].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-[13px] font-semibold text-emerald-800"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#5dff65] text-white">
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7.5L5.5 11L12 3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
