import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Wexon All Links",
  description:
    "Wexon Platform, WexPay, WexHotel ve WexB2B için hızlı bağlantılar. Çok ürünlü SaaS ekosistemi.",
  openGraph: {
    title: "Wexon All Links",
    description:
      "Wexon Platform, WexPay, WexHotel ve WexB2B için hızlı bağlantılar.",
    type: "website",
  },
};

type LinkIcon =
  | "home"
  | "credit-card"
  | "hotel"
  | "building"
  | "sparkles"
  | "user"
  | "shield"
  | "mail"
  | "instagram"
  | "linkedin";

type WexonLinkItem = {
  id: string;
  label: string;
  description?: string;
  icon: LinkIcon;
  section: "products" | "portals" | "social";
} & (
  | { href: string; external?: false; disabled?: false }
  | { href: string; external: true; disabled?: false }
  | { disabled: true; href?: never; external?: never }
);

/** Düzenlenebilir link listesi — Instagram bio için tek kaynak */
const WEXON_LINKS: WexonLinkItem[] = [
  {
    id: "platform",
    label: "Wexon Platform",
    description: "Ana site ve ürün ekosistemi",
    href: "/",
    icon: "home",
    section: "products",
  },
  {
    id: "wexpay",
    label: "WexPay",
    description: "QR menü, sipariş ve ödeme",
    href: "/products/wexpay",
    icon: "credit-card",
    section: "products",
  },
  {
    id: "wexhotel",
    label: "WexHotel",
    description: "Otel operasyonları",
    href: "/products/wexhotel",
    icon: "hotel",
    section: "products",
  },
  {
    id: "wexb2b",
    label: "WexB2B",
    description: "B2B satış ve tedarik",
    href: "/products/wexb2b",
    icon: "building",
    section: "products",
  },
  {
    id: "demo",
    label: "Demo Talep Et",
    description: "Ürünleri canlı görün",
    href: "/demo-request",
    icon: "sparkles",
    section: "products",
  },
  {
    id: "customer-portal",
    label: "Customer Portal",
    description: "Müşteri paneli girişi",
    href: "/dashboard/login",
    icon: "user",
    section: "portals",
  },
  {
    id: "admin-portal",
    label: "Admin Portal",
    description: "Yönetim paneli girişi",
    href: "/admin/login",
    icon: "shield",
    section: "portals",
  },
  {
    id: "contact",
    label: "İletişim",
    description: "Bizimle iletişime geçin",
    href: "/contact",
    icon: "mail",
    section: "social",
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "@wexon",
    href: "https://instagram.com/wexon",
    external: true,
    icon: "instagram",
    section: "social",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Wexon",
    href: "https://linkedin.com/company/wexon",
    external: true,
    icon: "linkedin",
    section: "social",
  },
];

const SECTION_LABELS: Record<WexonLinkItem["section"], string> = {
  products: "Ürünler",
  portals: "Portallar",
  social: "İletişim & Sosyal",
};

function WexonMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-wx-accent shadow-lg shadow-emerald-500/25 ${className}`}
    >
      <svg width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2" fill="white" />
      </svg>
    </div>
  );
}

function LinkIconGlyph({ icon }: { icon: LinkIcon }) {
  const className = "h-5 w-5 shrink-0 text-wx-accent";

  switch (icon) {
    case "home":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
        </svg>
      );
    case "credit-card":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "hotel":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 21V7l9-4 9 4v14" />
          <path d="M9 21v-6h6v6M3 10h18" />
        </svg>
      );
    case "building":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="1" />
          <path d="M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
        </svg>
      );
    case "sparkles":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" strokeLinejoin="round" />
        </svg>
      );
    case "user":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      );
    case "shield":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
        </svg>
      );
    case "mail":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
      );
  }
}

function LinkButton({ item }: { item: WexonLinkItem }) {
  const content = (
    <>
      <LinkIconGlyph icon={item.icon} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-base font-bold tracking-tight text-wx-text">{item.label}</span>
        {item.description && (
          <span className="mt-0.5 block truncate text-sm font-medium text-wx-text-muted">{item.description}</span>
        )}
      </span>
      {!item.disabled && (
        <svg
          className="h-4 w-4 shrink-0 text-wx-text-faint transition-transform group-hover:translate-x-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </>
  );

  const baseClass =
    "group flex min-h-[3.75rem] w-full items-center gap-4 rounded-2xl border px-5 py-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wx-accent/50";

  if (item.disabled) {
    return (
      <div
        className={`${baseClass} cursor-not-allowed border-wx-border bg-wx-bg-subtle/60 opacity-60`}
        aria-disabled="true"
      >
        {content}
        <span className="shrink-0 rounded-full bg-wx-bg-elevated px-2.5 py-1 text-xs font-bold text-wx-text-muted">
          Yakında
        </span>
      </div>
    );
  }

  const activeClass = `${baseClass} border-wx-border bg-wx-bg-elevated hover:border-wx-border-accent hover:bg-wx-bg-subtle hover:shadow-[0_0_24px_rgba(16,185,129,0.08)] active:scale-[0.99]`;

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className={activeClass}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={activeClass}>
      {content}
    </Link>
  );
}

export default function WexonLinksPage() {
  const sections: WexonLinkItem["section"][] = ["products", "portals", "social"];

  return (
    <div className="relative min-h-full overflow-x-hidden bg-wx-bg">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.14),transparent_70%)]"
        aria-hidden
      />

      <main className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-10 pb-14 sm:px-6">
        <header className="flex flex-col items-center text-center">
          <WexonMark />
          <h1 className="mt-5 text-2xl font-black tracking-[-0.03em] text-wx-text sm:text-3xl">Wexon Links</h1>
          <p className="mt-2 text-sm font-semibold text-wx-accent">Çok ürünlü SaaS ekosistemi</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-wx-text-muted">
            Wexon Core, WexPay, WexHotel ve WexB2B için hızlı bağlantılar.
          </p>
        </header>

        <div className="mt-10 space-y-8">
          {sections.map((section) => {
            const items = WEXON_LINKS.filter((link) => link.section === section);
            if (items.length === 0) return null;

            return (
              <section key={section} aria-label={SECTION_LABELS[section]}>
                <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-[0.14em] text-wx-text-faint">
                  {SECTION_LABELS[section]}
                </h2>
                <div className="flex flex-col gap-3">
                  {items.map((item) => (
                    <LinkButton key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-12 text-center text-xs font-medium text-wx-text-faint">
          © {new Date().getFullYear()} Wexon
        </footer>
      </main>
    </div>
  );
}
