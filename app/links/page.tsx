import Link from "next/link";

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

type LinkTone = "emerald" | "cyan" | "indigo" | "amber" | "blue" | "neutral";

type WexonLinkItem = {
  id: string;
  label: string;
  description: string;
  icon: LinkIcon;
  tone: LinkTone;
  group: "main" | "portals" | "social";
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
    group: "main",
  },
  {
    id: "wexpay",
    label: "WexPay",
    description: "QR menü, sipariş ve ödeme",
    href: "/products/wexpay",
    icon: "credit-card",
    tone: "cyan",
    group: "main",
  },
  {
    id: "wexhotel",
    label: "WexHotel",
    description: "Otel operasyonları",
    href: "/products/wexhotel",
    icon: "hotel",
    tone: "indigo",
    group: "main",
  },
  {
    id: "wexb2b",
    label: "WexB2B",
    description: "B2B satış ve tedarik",
    href: "/products/wexb2b",
    icon: "building",
    tone: "amber",
    group: "main",
  },
  {
    id: "demo",
    label: "Demo Talep Et",
    description: "Ürünleri canlı görün",
    href: "/demo-request",
    icon: "sparkles",
    tone: "emerald",
    group: "main",
  },
  {
    id: "customer-portal",
    label: "Customer Portal",
    description: "Müşteri paneli girişi",
    href: "/dashboard/login",
    icon: "user",
    tone: "blue",
    group: "portals",
  },
  {
    id: "admin-portal",
    label: "Admin Portal",
    description: "Yönetim paneli girişi",
    href: "/admin/login",
    icon: "shield",
    tone: "blue",
    group: "portals",
  },
  {
    id: "contact",
    label: "İletişim",
    description: "Bizimle iletişime geçin",
    href: "/contact",
    icon: "mail",
    tone: "neutral",
    group: "social",
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "@wexon",
    href: "https://instagram.com/wexon",
    external: true,
    icon: "instagram",
    tone: "neutral",
    group: "social",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Wexon",
    href: "https://linkedin.com/company/wexon",
    external: true,
    icon: "linkedin",
    tone: "neutral",
    group: "social",
  },
];

const TONE_STYLES: Record<
  LinkTone,
  { icon: string; border: string; glow: string; arrow: string }
> = {
  emerald: {
    icon: "bg-emerald-500/15 text-emerald-400 ring-emerald-400/25",
    border: "hover:border-emerald-400/35",
    glow: "hover:shadow-[0_8px_28px_-8px_rgba(16,185,129,0.35)]",
    arrow: "group-hover:text-emerald-400",
  },
  cyan: {
    icon: "bg-cyan-500/15 text-cyan-400 ring-cyan-400/25",
    border: "hover:border-cyan-400/35",
    glow: "hover:shadow-[0_8px_28px_-8px_rgba(34,211,238,0.3)]",
    arrow: "group-hover:text-cyan-400",
  },
  indigo: {
    icon: "bg-indigo-500/15 text-indigo-400 ring-indigo-400/25",
    border: "hover:border-indigo-400/35",
    glow: "hover:shadow-[0_8px_28px_-8px_rgba(99,102,241,0.3)]",
    arrow: "group-hover:text-indigo-400",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-400 ring-amber-400/25",
    border: "hover:border-amber-400/35",
    glow: "hover:shadow-[0_8px_28px_-8px_rgba(245,158,11,0.28)]",
    arrow: "group-hover:text-amber-400",
  },
  blue: {
    icon: "bg-blue-500/15 text-blue-400 ring-blue-400/25",
    border: "hover:border-blue-400/35",
    glow: "hover:shadow-[0_8px_28px_-8px_rgba(59,130,246,0.28)]",
    arrow: "group-hover:text-blue-400",
  },
  neutral: {
    icon: "bg-white/8 text-slate-300 ring-white/10",
    border: "hover:border-white/20",
    glow: "hover:shadow-[0_8px_28px_-8px_rgba(255,255,255,0.08)]",
    arrow: "group-hover:text-slate-300",
  },
};

function WexonMark() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
      <svg width="28" height="28" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2" fill="white" />
      </svg>
    </div>
  );
}

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

function GroupDivider() {
  return <div className="my-1 h-px bg-white/[0.06]" aria-hidden />;
}

function LinkCard({ item }: { item: WexonLinkItem }) {
  const tone = TONE_STYLES[item.tone];

  const content = (
    <>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tone.icon}`}
      >
        <LinkIconGlyph icon={item.icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold leading-tight text-white">{item.label}</span>
        <span className="mt-0.5 block truncate text-[13px] font-medium text-slate-400">{item.description}</span>
      </span>
      {!item.disabled && (
        <svg
          className={`h-4 w-4 shrink-0 text-slate-600 transition-all duration-200 group-hover:translate-x-0.5 ${tone.arrow}`}
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

  const baseClass = `group flex min-h-[3.75rem] w-full items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 backdrop-blur-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 hover:-translate-y-0.5 ${tone.border} ${tone.glow} active:translate-y-0`;

  if (item.disabled) {
    return (
      <div className={`${baseClass} cursor-not-allowed opacity-50`} aria-disabled="true">
        {content}
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
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
  const mainLinks = WEXON_LINKS.filter((l) => l.group === "main");
  const portalLinks = WEXON_LINKS.filter((l) => l.group === "portals");
  const socialLinks = WEXON_LINKS.filter((l) => l.group === "social");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-6 pt-7 sm:px-5 sm:pt-9">
      <header className="mb-6 flex flex-col items-center text-center">
        <WexonMark />
        <h1 className="mt-4 text-2xl font-black tracking-[-0.03em] text-white">Wexon</h1>
        <p className="mt-1 text-sm font-semibold text-emerald-400">Çok ürünlü SaaS ekosistemi</p>
        <p className="mt-2 max-w-[320px] text-[13px] leading-snug text-slate-400">
          Wexon Core, WexPay, WexHotel ve WexB2B bağlantıları tek yerde.
        </p>
      </header>

      <nav className="flex flex-col gap-2.5" aria-label="Wexon bağlantıları">
        {mainLinks.map((item) => (
          <LinkCard key={item.id} item={item} />
        ))}

        <GroupDivider />

        {portalLinks.map((item) => (
          <LinkCard key={item.id} item={item} />
        ))}

        <GroupDivider />

        {socialLinks.map((item) => (
          <LinkCard key={item.id} item={item} />
        ))}
      </nav>

      <p className="mt-8 text-center text-[11px] font-medium text-slate-600">
        © {new Date().getFullYear()} Wexon
      </p>
    </main>
  );
}
