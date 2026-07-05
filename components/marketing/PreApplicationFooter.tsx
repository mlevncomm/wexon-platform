import Link from "next/link";
import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";

const PRODUCTS = ["WexPay", "WexHotel", "WexB2B"] as const;

const SECTION_LINKS = [
  { href: "#surec", label: "Başvuru süreci" },
  { href: "#basvuru", label: "Form" },
  { href: "#urunler", label: "Ürün kapsamı" },
] as const;

export default function PreApplicationFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#03150f] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.18) 1px, transparent 1px)",
          backgroundSize: "76px 76px",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      <div className="relative mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16 xl:px-16 2xl:px-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
          <div>
            <WexonBrandLogo variant="hero" className="h-8 md:h-9" />
            <p className="mt-4 max-w-md text-sm font-semibold leading-relaxed text-slate-400">
              Wexon ekosistemi yeni erişim dönemine hazırlanıyor. WexPay, WexHotel ve WexB2B için ön başvurularınızı
              bu sayfadan iletebilirsiniz.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {PRODUCTS.map((product) => (
                <span
                  key={product}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-emerald-100"
                >
                  {product}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-10">
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200">Sayfa</h4>
              <ul className="mt-4 space-y-3">
                {SECTION_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200">Destek</h4>
              <ul className="mt-4 space-y-3">
                <li>
                  <a
                    href="mailto:info@wexon.dev"
                    className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
                  >
                    info@wexon.dev
                  </a>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
                  >
                    İletişim
                  </Link>
                </li>
                <li>
                  <Link
                    href="/legal/privacy"
                    className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
                  >
                    Gizlilik
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs font-semibold text-slate-500">© 2026 Wexon Technologies. Tüm hakları saklıdır.</p>
          <a
            href="#basvuru"
            className="group inline-flex w-full items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-white/[0.05] p-2 pl-4 transition-all hover:border-emerald-400/30 hover:bg-white/[0.08] sm:w-auto sm:min-w-[280px]"
          >
            <span className="min-w-0 text-left">
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                Ön başvuru
              </span>
              <span className="block text-sm font-black text-white">Forma geri dön</span>
            </span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#10b981] text-white shadow-lg shadow-emerald-950/30 transition-transform group-hover:scale-105">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
