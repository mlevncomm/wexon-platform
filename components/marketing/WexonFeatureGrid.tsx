const FEATURES: { title: string; description: string; icon: React.ReactNode }[] = [
  {
    title: "QR menü ve sipariş",
    description:
      "Müşteri QR ile menüye girer, masa üzerinden sipariş verir; mutfak ve servis aynı anda görür.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
      </svg>
    ),
  },
  {
    title: "Masa ve ödeme yönetimi",
    description:
      "Masa durumu, açık adisyon, fiş talebi ve ödeme akışı tek panelde canlı takip edilir.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 14h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Lisans ve paket kontrolü",
    description:
      "Hangi ürün, hangi paket, hangi limitle aktif; tüm lisanslar Wexon Core üzerinden yönetilir.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Abonelik yönetimi",
    description:
      "Aylık, yıllık ve tek seferlik abonelik kurguları; yenileme ve fatura akışı merkezi.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 0115.5-6.3L21 8" strokeLinecap="round" />
        <path d="M21 4v4h-4M21 12a9 9 0 01-15.5 6.3L3 16" strokeLinecap="round" />
        <path d="M3 20v-4h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Raporlama",
    description:
      "Ciro, ortalama ödeme, ürün satışı, masa doluluğu ve trend raporları anında ekrana düşer.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="M7 14l4-4 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Yetki ve erişim",
    description:
      "Roller, izinler ve şube bazlı erişim; doğru kişi doğru modülü doğru paket içinde görür.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="9" r="3" />
        <path d="M2 20a6 6 0 0112 0" strokeLinecap="round" />
        <path d="M16 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function WexonFeatureGrid() {
  return (
    <section
      id="solutions"
      className="relative bg-white px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32 xl:px-16 2xl:px-20"
    >
      <div className="mx-auto max-w-[1480px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Çözümler
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl lg:text-5xl">
            İşletme yönetimi{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              yeniden tasarlandı
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            Wexon; ürün, lisans, müşteri ve operasyon süreçlerini sade ama güçlü bir SaaS
            altyapısında toplar.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-sm shadow-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/25">
                {f.icon}
              </div>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950">{f.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">{f.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
