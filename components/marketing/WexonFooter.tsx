import Link from "next/link";
import WexonBrandLogo from "@/components/marketing/WexonBrandLogo";
import { publicUrl, resolveNavigationHref } from "@/lib/wexon/urls";

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
    { label: "Gizlilik", href: "/gizlilik-politikasi" },
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
            <a
              href="https://instagram.com/wexon"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="text-slate-400 transition-colors hover:text-slate-700"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/company/wexon"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="text-slate-400 transition-colors hover:text-slate-700"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
