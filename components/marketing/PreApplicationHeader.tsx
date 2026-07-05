"use client";

import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";

const NAV = [
  { href: "#surec", label: "Süreç", step: "01" },
  { href: "#basvuru", label: "Başvuru", step: "02" },
  { href: "#urunler", label: "Ürünler", step: "03" },
] as const;

export default function PreApplicationHeader() {
  const refreshPage = () => {
    window.location.assign("/on-basvuru");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#03150f]/88 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent" />

      <div className="mx-auto max-w-[1440px] px-5 py-3 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
          <button
            type="button"
            onClick={refreshPage}
            className="shrink-0 rounded-xl transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            aria-label="Sayfayı yenile"
          >
            <WexonBrandLogo variant="hero" priority className="h-9 md:h-10" />
          </button>

          <div className="hidden min-w-0 border-l border-white/10 pl-4 md:block lg:pl-6">
            <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">
              Wexon ön başvuru
            </p>
            <p className="truncate text-xs font-semibold text-slate-400">Erişim planlaması · 3 adım</p>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <nav
              className="flex max-w-full items-center overflow-x-auto rounded-[18px] border border-white/12 bg-black/25 p-1 shadow-inner shadow-black/20 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Sayfa bölümleri"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group inline-flex shrink-0 items-center gap-2 rounded-[14px] px-2.5 py-2 text-[11px] font-black text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white sm:px-3.5 sm:py-2.5 sm:text-xs"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-400/10 text-[9px] font-black text-emerald-300 ring-1 ring-emerald-400/20 transition-colors group-hover:bg-emerald-400/18 group-hover:text-emerald-100 sm:h-6 sm:w-6 sm:text-[10px]">
                    {item.step}
                  </span>
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>

            <a
              href="#basvuru"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#10b981] px-3.5 py-2 text-[11px] font-black text-white shadow-lg shadow-emerald-950/30 transition-all hover:bg-emerald-500 sm:px-4 sm:py-2.5 sm:text-xs"
            >
              <span className="hidden sm:inline">Forma git</span>
              <span className="sm:hidden">Başvur</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
