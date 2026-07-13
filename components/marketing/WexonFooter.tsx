import Link from "next/link";
import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";
import { publicUrl, resolveNavigationHref } from "@/lib/wexon/urls";
import { WEXON_SOCIAL_LINKS } from "@/lib/wexon/social-links";

const FOOTER_LINKS: Record<string, { label: string; href: string }[]> = {
  Ürünler: [
    { label: "WexPay", href: "/products/wexpay" },
    { label: "WexHotel", href: "/products/wexhotel" },
    { label: "WexB2B", href: "/products/wexb2b" },
    { label: "Wexon Core", href: "/#core" },
  ],
  Platform: [
    { label: "Paketler", href: "/#pricing" },
    { label: "Çözümler", href: "/#solutions" },
    { label: "Demo Talep Et", href: "/demo-request" },
    { label: "Randevu Al", href: "/book-demo" },
  ],
  Şirket: [
    { label: "Hakkımızda", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Kariyer", href: "/careers" },
    { label: "İletişim", href: "/contact" },
  ],
  Kaynaklar: [
    { label: "Dokümantasyon", href: "/docs" },
    { label: "API Referansı", href: "/api-reference" },
    { label: "Durum", href: "/status" },
    { label: "Değişiklik Günlüğü", href: "/changelog" },
  ],
  Yasal: [
    { label: "KVKK", href: "/kvkk" },
    { label: "Gizlilik", href: "/gizlilik" },
    { label: "Kullanım Şartları", href: "/kullanim-sartlari" },
    { label: "Çerez Politikası", href: "/cerez-politikasi" },
  ],
};

function WexonLogo() {
  return (
    <Link href={publicUrl("/")} className="inline-flex items-center">
      <WexonBrandLogo variant="dark" />
    </Link>
  );
}

export default function WexonFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 pb-10 pt-16 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
      <div className="mx-auto max-w-[1560px]">
        <div className="mb-12 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-7 xl:grid-cols-8">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2 xl:col-span-3">
            <WexonLogo />
            <p className="mt-4 max-w-[320px] text-sm leading-relaxed text-slate-500">
              Restoran, otel ve B2B operasyonları için birleşik SaaS ekosistemi.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              WexPay Pilot Launch
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-xs font-black uppercase tracking-[0.1em] text-slate-950">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={resolveNavigationHref(link.href)}
                      className="text-sm text-slate-500 transition-colors hover:text-slate-950"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mb-6 h-px bg-slate-200" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-slate-500">
            © 2026 Wexon Technologies. Tüm hakları saklıdır.
          </p>

          <div className="flex items-center gap-4">
            {WEXON_SOCIAL_LINKS.map((social) => (
              <a
                key={social.id}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.ariaLabel}
                className="text-slate-400 transition-colors hover:text-emerald-700"
              >
                {social.id === "instagram" ? (
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
                  </svg>
                ) : null}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
