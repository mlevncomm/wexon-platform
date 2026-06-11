import type { Metadata } from "next";
import Link from "next/link";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

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

type LinkTone = "emerald" | "indigo" | "amber" | "slate";

type WexonLinkItem = {
  id: string;
  label: string;
  description?: string;
  icon: LinkIcon;
  tone?: LinkTone;
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
    tone: "emerald",
    section: "products",
  },
  {
    id: "wexpay",
    label: "WexPay",
    description: "QR menü, sipariş ve ödeme",
    href: "/products/wexpay",
    icon: "credit-card",
    tone: "emerald",
    section: "products",
  },
  {
    id: "wexhotel",
    label: "WexHotel",
    description: "Otel operasyonları",
    href: "/products/wexhotel",
    icon: "hotel",
    tone: "indigo",
    section: "products",
  },
  {
    id: "wexb2b",
    label: "WexB2B",
    description: "B2B satış ve tedarik",
    href: "/products/wexb2b",
    icon: "building",
    tone: "amber",
    section: "products",
  },
  {
    id: "demo",
    label: "Demo Talep Et",
    description: "Ürünleri canlı görün",
    href: "/demo-request",
    icon: "sparkles",
    tone: "emerald",
    section: "products",
  },
  {
    id: "customer-portal",
    label: "Customer Portal",
    description: "Müşteri paneli girişi",
    href: "/dashboard/login",
    icon: "user",
    tone: "slate",
    section: "portals",
  },
  {
    id: "admin-portal",
    label: "Admin Portal",
    description: "Yönetim paneli girişi",
    href: "/admin/login",
    icon: "shield",
    tone: "slate",
    section: "portals",
  },
  {
    id: "contact",
    label: "İletişim",
    description: "Bizimle iletişime geçin",
    href: "/contact",
    icon: "mail",
    tone: "emerald",
    section: "social",
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "@wexon",
    href: "https://instagram.com/wexon",
    external: true,
    icon: "instagram",
    tone: "slate",
    section: "social",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Wexon",
    href: "https://linkedin.com/company/wexon",
    external: true,
    icon: "linkedin",
    tone: "slate",
    section: "social",
  },
];

const SECTION_LABELS: Record<WexonLinkItem["section"], string> = {
  products: "Ürünler",
  portals: "Portallar",
  social: "İletişim & Sosyal",
};

const TONE_STYLES: Record<
  LinkTone,
  { bar: string; iconBg: string; hoverBorder: string; hoverShadow: string }
> = {
  emerald: {
    bar: "bg-emerald-500",
    iconBg: "bg-emerald-500 text-white shadow-emerald-500/30",
    hoverBorder: "hover:border-emerald-200",
    hoverShadow: "hover:shadow-emerald-200/50",
  },
  indigo: {
    bar: "bg-indigo-500",
    iconBg: "bg-indigo-500 text-white shadow-indigo-500/30",
    hoverBorder: "hover:border-indigo-200",
    hoverShadow: "hover:shadow-indigo-200/50",
  },
  amber: {
    bar: "bg-amber-500",
    iconBg: "bg-amber-500 text-white shadow-amber-500/30",
    hoverBorder: "hover:border-amber-200",
    hoverShadow: "hover:shadow-amber-200/50",
  },
  slate: {
    bar: "bg-slate-400",
    iconBg: "bg-slate-100 text-slate-700",
    hoverBorder: "hover:border-slate-300",
    hoverShadow: "hover:shadow-slate-200/60",
  },
};

function LinkIconGlyph({ icon, className = "" }: { icon: LinkIcon; className?: string }) {
  const props = { className, viewBox: "0 0 24 24", "aria-hidden": true as const };

  switch (icon) {
    case "home":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
        </svg>
      );
    case "credit-card":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "hotel":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21V7l9-4 9 4v14" />
          <path d="M9 21v-6h6v6M3 10h18" />
        </svg>
      );
    case "building":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="3" width="16" height="18" rx="1" />
          <path d="M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" strokeLinejoin="round" />
        </svg>
      );
    case "user":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...props} fill="currentColor">
          <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...props} fill="currentColor">
          <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
      );
  }
}

function LinkButton({ item }: { item: WexonLinkItem }) {
  const tone = TONE_STYLES[item.tone ?? "emerald"];

  const content = (
    <>
      <span className={`block h-1.5 w-8 shrink-0 rounded-full ${tone.bar}`} aria-hidden />
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${tone.iconBg}`}
      >
        <LinkIconGlyph icon={item.icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-base font-black tracking-tight text-slate-950">{item.label}</span>
        {item.description && (
          <span className="mt-1 block truncate text-sm font-semibold text-slate-500">{item.description}</span>
        )}
      </span>
      {!item.disabled && (
        <svg
          className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500"
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

  const baseClass = `group flex min-h-[4.5rem] w-full items-center gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${tone.hoverBorder} hover:-translate-y-0.5 hover:shadow-md ${tone.hoverShadow} active:translate-y-0`;

  if (item.disabled) {
    return (
      <div className={`${baseClass} cursor-not-allowed opacity-60`} aria-disabled="true">
        {content}
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
          Yakında
        </span>
      </div>
    );
  }

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={baseClass}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={baseClass}>
      {content}
    </Link>
  );
}

export default function WexonLinksPage() {
  const sections: WexonLinkItem["section"][] = ["products", "portals", "social"];

  return (
    <WexonStaticPageShell
      badge="Wexon Links"
      headline="Tüm bağlantılar tek yerde"
      description="Wexon Core, WexPay, WexHotel ve WexB2B için hızlı bağlantılar. Çok ürünlü SaaS ekosistemi."
    >
      <div className="mx-auto max-w-xl space-y-10">
        {sections.map((section) => {
          const items = WEXON_LINKS.filter((link) => link.section === section);
          if (items.length === 0) return null;

          return (
            <section key={section} aria-label={SECTION_LABELS[section]}>
              <div className="mb-4 flex items-center gap-3 px-1">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  {SECTION_LABELS[section]}
                </h2>
                <span className="h-px flex-1 bg-slate-200" aria-hidden />
              </div>
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <LinkButton key={item.id} item={item} />
                ))}
              </div>
            </section>
          );
        })}

        <p className="px-1 text-center text-xs font-semibold text-slate-400">
          Instagram bio linki olarak paylaşmak için bu sayfayı kullanabilirsiniz.
        </p>
      </div>
    </WexonStaticPageShell>
  );
}
