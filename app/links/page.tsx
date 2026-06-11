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
  {
    stripe: string;
    icon: string;
    hover: string;
    chevron: string;
    chevronBg: string;
  }
> = {
  emerald: {
    stripe: "from-emerald-400 to-teal-500",
    icon: "from-emerald-500/25 to-teal-500/10 text-emerald-300",
    hover: "hover:border-emerald-400/30 hover:shadow-[0_12px_40px_-12px_rgba(16,185,129,0.45)]",
    chevron: "group-hover:text-emerald-300",
    chevronBg: "group-hover:bg-emerald-500/15 group-hover:border-emerald-400/25",
  },
  cyan: {
    stripe: "from-cyan-400 to-emerald-400",
    icon: "from-cyan-500/25 to-blue-500/10 text-cyan-300",
    hover: "hover:border-cyan-400/30 hover:shadow-[0_12px_40px_-12px_rgba(34,211,238,0.4)]",
    chevron: "group-hover:text-cyan-300",
    chevronBg: "group-hover:bg-cyan-500/15 group-hover:border-cyan-400/25",
  },
  indigo: {
    stripe: "from-indigo-400 to-violet-500",
    icon: "from-indigo-500/25 to-violet-500/10 text-indigo-300",
    hover: "hover:border-indigo-400/30 hover:shadow-[0_12px_40px_-12px_rgba(99,102,241,0.4)]",
    chevron: "group-hover:text-indigo-300",
    chevronBg: "group-hover:bg-indigo-500/15 group-hover:border-indigo-400/25",
  },
  amber: {
    stripe: "from-amber-400 to-orange-500",
    icon: "from-amber-500/25 to-orange-500/10 text-amber-300",
    hover: "hover:border-amber-400/30 hover:shadow-[0_12px_40px_-12px_rgba(245,158,11,0.35)]",
    chevron: "group-hover:text-amber-300",
    chevronBg: "group-hover:bg-amber-500/15 group-hover:border-amber-400/25",
  },
  blue: {
    stripe: "from-blue-400 to-indigo-500",
    icon: "from-blue-500/25 to-indigo-500/10 text-blue-300",
    hover: "hover:border-blue-400/30 hover:shadow-[0_12px_40px_-12px_rgba(59,130,246,0.35)]",
    chevron: "group-hover:text-blue-300",
    chevronBg: "group-hover:bg-blue-500/15 group-hover:border-blue-400/25",
  },
  neutral: {
    stripe: "from-slate-400 to-slate-500",
    icon: "from-white/10 to-white/5 text-slate-300",
    hover: "hover:border-white/20 hover:shadow-[0_12px_40px_-12px_rgba(255,255,255,0.1)]",
    chevron: "group-hover:text-slate-200",
    chevronBg: "group-hover:bg-white/10 group-hover:border-white/15",
  },
};

function WexonMark() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-1 rounded-[22px] bg-gradient-to-br from-emerald-400/40 via-cyan-400/20 to-transparent blur-md"
        aria-hidden
      />
      <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/25 ring-1 ring-white/20">
        <svg width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="white" strokeWidth="1.5" />
          <circle cx="9" cy="9" r="2" fill="white" />
        </svg>
      </div>
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
  return (
    <div className="flex items-center gap-3 py-0.5" aria-hidden>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function LinkCard({ item }: { item: WexonLinkItem }) {
  const tone = TONE_STYLES[item.tone];

  const content = (
    <>
      <span
        className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-gradient-to-b ${tone.stripe}`}
        aria-hidden
      />
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br ring-1 ring-white/10 ${tone.icon}`}
      >
        <LinkIconGlyph icon={item.icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1 pl-0.5">
        <span className="block truncate text-[15px] font-bold tracking-[-0.01em] text-white">
          {item.label}
        </span>
        <span className="mt-0.5 block truncate text-[12px] font-medium text-slate-500">
          {item.description}
        </span>
      </span>
      {!item.disabled && (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] transition-all duration-300 ${tone.chevronBg}`}
        >
          <svg
            className={`h-3.5 w-3.5 text-slate-500 transition-all duration-300 group-hover:translate-x-px ${tone.chevron}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </>
  );

  const baseClass = `group relative flex min-h-[4rem] w-full items-center gap-3.5 overflow-hidden rounded-[18px] border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-white/[0.02] py-3.5 pl-4 pr-3.5 backdrop-blur-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 hover:-translate-y-0.5 ${tone.hover} active:scale-[0.99] active:translate-y-0`;

  if (item.disabled) {
    return (
      <div className={`${baseClass} cursor-not-allowed opacity-45`} aria-disabled="true">
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
    <div className="flex min-h-dvh items-start justify-center px-4 py-6 sm:px-5 sm:py-10">
      <main className="w-full max-w-[440px] rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-4 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] backdrop-blur-sm sm:p-5 md:mt-4">
        <header className="mb-5 flex flex-col items-center text-center">
          <WexonMark />
          <h1 className="mt-4 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-[26px] font-black tracking-[-0.04em] text-transparent">
            Wexon
          </h1>
          <p className="mt-1.5 text-[13px] font-semibold tracking-wide text-emerald-400/90">
            Çok ürünlü SaaS ekosistemi
          </p>
          <p className="mt-2 max-w-[300px] text-[12px] leading-relaxed text-slate-500">
            Wexon Core, WexPay, WexHotel ve WexB2B bağlantıları tek yerde.
          </p>
        </header>

        <nav className="flex flex-col gap-2" aria-label="Wexon bağlantıları">
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

        <p className="mt-6 text-center text-[10px] font-medium tracking-wide text-slate-600">
          © {new Date().getFullYear()} Wexon
        </p>
      </main>
    </div>
  );
}
