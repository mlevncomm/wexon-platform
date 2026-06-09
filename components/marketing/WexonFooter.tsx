import Link from "next/link";

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
    { label: "Gizlilik", href: "/legal/privacy" },
    { label: "Kullanım Şartları", href: "/legal/terms" },
    { label: "Çerez Politikası", href: "/legal/cookies" },
    { label: "Güvenlik", href: "/legal/security" },
  ],
};

function WexonLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#10b981] shadow-sm shadow-emerald-500/20">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" />
          <circle cx="9" cy="9" r="2" fill="white" />
        </svg>
      </div>
      <span className="text-base font-bold tracking-tight text-slate-950">Wexon</span>
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
              WexPay canlı demo hazır
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
                      href={link.href}
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
            <a href="#" aria-label="X (Twitter)" className="text-slate-400 transition-colors hover:text-slate-700">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#" aria-label="GitHub" className="text-slate-400 transition-colors hover:text-slate-700">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <a href="#" aria-label="LinkedIn" className="text-slate-400 transition-colors hover:text-slate-700">
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
