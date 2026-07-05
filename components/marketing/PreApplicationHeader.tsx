"use client";

import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";

const NAV = [
  { href: "#surec", label: "Süreç" },
  { href: "#basvuru", label: "Başvuru" },
  { href: "#urunler", label: "Ürünler" },
] as const;

export default function PreApplicationHeader() {
  const refreshPage = () => {
    window.location.assign("/on-basvuru");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#03150f]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 py-3.5 sm:gap-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <button
          type="button"
          onClick={refreshPage}
          className="shrink-0 rounded-xl transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          aria-label="Sayfayı yenile"
        >
          <WexonBrandLogo variant="hero" priority className="h-9 md:h-10" />
        </button>

        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Sayfa bölümleri">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-emerald-100 transition-colors hover:border-emerald-400/30 hover:bg-white/[0.1] hover:text-white sm:px-4 sm:py-2 sm:text-xs"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
