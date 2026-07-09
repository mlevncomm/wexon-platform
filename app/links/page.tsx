import Link from "next/link";
import { WexPayDarkPanelHeaderBackdrop } from "@/components/wexpay/WexPayBusinessUI";
import { customerLoginUrl, publicUrl } from "@/lib/wexon/urls";

type LinkIcon = "play" | "sparkles" | "credit-card" | "qr" | "home" | "hotel" | "building" | "user" | "shield" | "mail" | "instagram" | "linkedin";

type WexonLinkItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LinkIcon;
  featured?: boolean;
  external?: boolean;
  compact?: boolean;
};

/** Düzenlenebilir link listesi — Instagram bio için tek kaynak */
const WEXON_LINKS = {
  featured: [
    {
      id: "wexpay-demo",
      label: "WexPay Demo",
      description: "QR menü · sepet · sipariş · ödeme simülasyonu",
      href: "/demo/wexpay?source=links",
      icon: "play" as const,
      featured: true,
    },
    {
      id: "demo-request",
      label: "Demo Talep Et",
      description: "İşletmeniz için pilot demo planlayın",
      href: "/demo-request",
      icon: "sparkles" as const,
    },
    {
      id: "wexpay-product",
      label: "WexPay Ürün Sayfası",
      description: "Özellikler, akış ve paketler",
      href: "/products/wexpay",
      icon: "credit-card" as const,
    },
  ],
  secondary: [
    { id: "platform", label: "Wexon Platform", description: "Ana site", href: publicUrl("/"), icon: "home" as const, compact: true },
    { id: "wexhotel", label: "WexHotel", description: "Yakında — otel operasyonları", href: "/products/wexhotel", icon: "hotel" as const, compact: true },
    { id: "wexb2b", label: "WexB2B", description: "Yakında — B2B satış", href: "/products/wexb2b", icon: "building" as const, compact: true },
    { id: "customer-portal", label: "Müşteri Girişi", description: "Lisanslı müşteri paneli", href: customerLoginUrl(), icon: "user" as const, compact: true },
    { id: "contact", label: "İletişim", description: "Bizimle iletişime geçin", href: "/contact", icon: "mail" as const, compact: true },
    {
      id: "instagram",
      label: "Instagram",
      description: "@wexon",
      href: "https://instagram.com/wexon",
      icon: "instagram" as const,
      external: true,
      compact: true,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      description: "Wexon",
      href: "https://linkedin.com/company/wexon",
      icon: "linkedin" as const,
      external: true,
      compact: true,
    },
  ],
};

function WexPayMark() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10b981] shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/30">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.5" />
        <path d="M16 16h4v4h-4zM16 16l4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function LinkIconGlyph({ icon, className = "" }: { icon: LinkIcon; className?: string }) {
  const props = { className, viewBox: "0 0 24 24", "aria-hidden": true as const };

  switch (icon) {
    case "play":
      return (
        <svg {...props} fill="currentColor">
          <path d="M8 5.14v13.72L19 12 8 5.14z" />
        </svg>
      );
    case "qr":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="6" height="6" />
          <rect x="14" y="4" width="6" height="6" />
          <rect x="4" y="14" width="6" height="6" />
          <path d="M14 14h6v6h-6z" />
        </svg>
      );
    case "credit-card":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" strokeLinejoin="round" />
        </svg>
      );
    case "home":
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
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

function FeaturedLinkCard({ item }: { item: WexonLinkItem }) {
  const isHero = item.featured;

  const inner = (
    <>
      <span
        className={`flex shrink-0 items-center justify-center rounded-2xl ${
          isHero
            ? "h-12 w-12 bg-white/15 text-white ring-1 ring-white/20"
            : "h-11 w-11 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
        }`}
      >
        <LinkIconGlyph icon={item.icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate font-black tracking-tight ${isHero ? "text-lg text-white" : "text-[15px] text-slate-950"}`}>
          {item.label}
        </span>
        <span className={`mt-0.5 block truncate text-[12px] font-semibold ${isHero ? "text-emerald-100/90" : "text-slate-500"}`}>
          {item.description}
        </span>
      </span>
      <svg
        className={`h-4 w-4 shrink-0 ${isHero ? "text-emerald-200" : "text-slate-300 group-hover:text-emerald-600"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden
      >
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );

  const heroClass =
    "group relative flex min-h-[4.75rem] w-full items-center gap-3.5 overflow-hidden rounded-[20px] border border-emerald-400/30 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-4 py-4 shadow-[0_16px_40px_-12px_rgba(16,185,129,0.55)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50";

  const normalClass =
    "group flex min-h-[3.75rem] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm shadow-slate-900/5 transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40";

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={isHero ? heroClass : normalClass}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={item.href} prefetch={false} className={isHero ? heroClass : normalClass}>
      {inner}
    </Link>
  );
}

function CompactLinkCard({ item }: { item: WexonLinkItem }) {
  const content = (
    <>
      <LinkIconGlyph icon={item.icon} className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-emerald-600" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-700 group-hover:text-slate-950">
        {item.label}
      </span>
      <svg className="h-3.5 w-3.5 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );

  const className =
    "group flex min-h-[2.75rem] items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40";

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} prefetch={false} className={className}>
      {content}
    </Link>
  );
}

export default function WexonLinksPage() {
  return (
    <div className="flex min-h-dvh items-start justify-center px-4 py-5 sm:py-8">
      <main className="w-full max-w-[430px]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-6 text-center">
            <WexPayDarkPanelHeaderBackdrop />
            <div className="relative flex flex-col items-center">
              <WexPayMark />
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300/90">WexPay</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">QR menü, sipariş ve ödeme</h1>
              <p className="mt-2 max-w-[320px] text-[13px] leading-relaxed text-slate-400">
                Restoranlar için tek QR üzerinden menü, sipariş ve ödeme akışı.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-200">
                <LinkIconGlyph icon="qr" className="h-3 w-3" />
                Masa QR · Pilot demo
              </span>
            </div>
          </div>

          <nav className="space-y-2 p-4 sm:p-5" aria-label="WexPay bağlantıları">
            {WEXON_LINKS.featured.map((item) => (
              <FeaturedLinkCard key={item.id} item={item} />
            ))}

            <div className="flex items-center gap-3 py-2" aria-hidden>
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Diğer</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid gap-2">
              {WEXON_LINKS.secondary.map((item) => (
                <CompactLinkCard key={item.id} item={item} />
              ))}
            </div>
          </nav>
        </div>

        <p className="mt-5 text-center text-[10px] font-medium text-slate-400">© {new Date().getFullYear()} WexPay · Wexon</p>
      </main>
    </div>
  );
}
