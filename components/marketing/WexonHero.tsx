import Link from "next/link";
import type { CSSProperties } from "react";
import WexonHeroRotatingWord from "@/components/marketing/WexonHeroRotatingWord";
import { resolveNavigationHref, shouldDisableLinkPrefetch } from "@/lib/wexon/urls";

const WORDS = ["Core", "WexPay", "lisans", "ödeme"];

const FLOATING_PROOFS: Array<{
  initials: string;
  title: string;
  body: string;
  side: "left" | "right";
  badge: string;
  tone: "emerald" | "sky" | "cyan" | "violet";
}> = [
  {
    initials: "QR",
    title: "WexPay aktif",
    body: "Restoran, masa, sipariş ve ödeme akışı tek operasyon ekranında.",
    side: "left",
    badge: "Canlı",
    tone: "emerald",
  },
  {
    initials: "CO",
    title: "Core karar kaynağı",
    body: "Ürün erişimi ödeme durumundan değil, lisans ve entitlement sisteminden gelir.",
    side: "left",
    badge: "Core",
    tone: "sky",
  },
  {
    initials: "PS",
    title: "Sanal POS hazır",
    body: "PayTR temeli, webhook doğrulama ve idempotency altyapısı kurulu.",
    side: "right",
    badge: "POS",
    tone: "cyan",
  },
  {
    initials: "AU",
    title: "Audit & tenant",
    body: "Kritik erişim, ödeme ve admin işlemleri izlenebilir şekilde kayıtlanır.",
    side: "right",
    badge: "Güvenli",
    tone: "violet",
  },
];

const PROOF_TONE_STYLES: Record<
  (typeof FLOATING_PROOFS)[number]["tone"],
  { icon: string; badge: string; glow: string; ring: string }
> = {
  emerald: {
    icon: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/30",
    badge: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200",
    glow: "from-emerald-400/20 via-emerald-500/5 to-transparent",
    ring: "shadow-[0_0_0_1px_rgba(52,211,153,0.12),0_24px_60px_-28px_rgba(16,185,129,0.45)]",
  },
  sky: {
    icon: "bg-sky-500/20 text-sky-100 ring-sky-400/30",
    badge: "border-sky-400/25 bg-sky-500/12 text-sky-200",
    glow: "from-sky-400/20 via-sky-500/5 to-transparent",
    ring: "shadow-[0_0_0_1px_rgba(56,189,248,0.12),0_24px_60px_-28px_rgba(56,189,248,0.35)]",
  },
  cyan: {
    icon: "bg-cyan-500/20 text-cyan-100 ring-cyan-400/30",
    badge: "border-cyan-400/25 bg-cyan-500/12 text-cyan-200",
    glow: "from-cyan-400/20 via-cyan-500/5 to-transparent",
    ring: "shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_24px_60px_-28px_rgba(34,211,238,0.35)]",
  },
  violet: {
    icon: "bg-violet-500/20 text-violet-100 ring-violet-400/30",
    badge: "border-violet-400/25 bg-violet-500/12 text-violet-200",
    glow: "from-violet-400/20 via-violet-500/5 to-transparent",
    ring: "shadow-[0_0_0_1px_rgba(167,139,250,0.12),0_24px_60px_-28px_rgba(167,139,250,0.35)]",
  },
};

const SERVICE_CARDS = [
  {
    title: "WexPay",
    body: "QR menü, masa, sipariş ve ödeme",
    href: "/products/wexpay",
    initials: "WP",
    badge: "Canlı",
    tone: "emerald",
  },
  {
    title: "Wexon Core",
    body: "Lisans, abonelik, kota ve entitlement",
    href: "/docs",
    initials: "CO",
    badge: "Core",
    tone: "sky",
  },
  {
    title: "Customer Portal",
    body: "Müşteri ürün, fatura ve destek paneli",
    href: "/dashboard",
    initials: "CP",
    badge: "Panel",
    tone: "violet",
  },
  {
    title: "Admin Portal",
    body: "Organizasyon, lisans ve audit yönetimi",
    href: "/admin",
    initials: "AP",
    badge: "İç",
    tone: "amber",
  },
  {
    title: "PayTR",
    body: "Sanal POS bağlantı altyapısı",
    href: "/demo-request",
    initials: "PT",
    badge: "POS",
    tone: "cyan",
  },
  {
    title: "WexHotel",
    body: "Otel yönetimi roadmap",
    href: "/products/wexhotel",
    initials: "WH",
    badge: "Roadmap",
    tone: "indigo",
  },
  {
    title: "WexB2B",
    body: "Bayi ve toptan satış roadmap",
    href: "/products/wexb2b",
    initials: "B2",
    badge: "Roadmap",
    tone: "rose",
  },
] as const;

const MARQUEE_TONE_STYLES: Record<
  (typeof SERVICE_CARDS)[number]["tone"],
  { icon: string; badge: string; glow: string }
> = {
  emerald: {
    icon: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
    badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    glow: "group-hover:shadow-[0_18px_50px_-28px_rgba(16,185,129,0.55)]",
  },
  sky: {
    icon: "bg-sky-500/15 text-sky-200 ring-sky-400/25",
    badge: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    glow: "group-hover:shadow-[0_18px_50px_-28px_rgba(56,189,248,0.45)]",
  },
  violet: {
    icon: "bg-violet-500/15 text-violet-200 ring-violet-400/25",
    badge: "border-violet-400/20 bg-violet-500/10 text-violet-200",
    glow: "group-hover:shadow-[0_18px_50px_-28px_rgba(167,139,250,0.4)]",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
    badge: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    glow: "group-hover:shadow-[0_18px_50px_-28px_rgba(251,191,36,0.35)]",
  },
  cyan: {
    icon: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25",
    badge: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
    glow: "group-hover:shadow-[0_18px_50px_-28px_rgba(34,211,238,0.35)]",
  },
  indigo: {
    icon: "bg-indigo-500/15 text-indigo-200 ring-indigo-400/25",
    badge: "border-indigo-400/20 bg-indigo-500/10 text-indigo-200",
    glow: "group-hover:shadow-[0_18px_50px_-28px_rgba(129,140,248,0.35)]",
  },
  rose: {
    icon: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
    badge: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    glow: "group-hover:shadow-[0_18px_50px_-28px_rgba(251,113,133,0.35)]",
  },
};

const TRUST_BADGES = ["3 ürün", "Tek Core", "Canlı demo", "Türkçe arayüz", "Tenant isolation"];

function FloatingProof({
  initials,
  title,
  body,
  side,
  index,
  badge,
  tone,
}: {
  initials: string;
  title: string;
  body: string;
  side: "left" | "right";
  index: number;
  badge: string;
  tone: (typeof FLOATING_PROOFS)[number]["tone"];
}) {
  const position =
    side === "left"
      ? index === 0
        ? "left-[5%] top-[26%] xl:left-[7%]"
        : "left-[7%] top-[47%] xl:left-[9%]"
      : index === 2
        ? "right-[5%] top-[28%] xl:right-[7%]"
        : "right-[7%] top-[47%] xl:right-[9%]";

  const styles = PROOF_TONE_STYLES[tone];
  const driftX = side === "left" ? "-8px" : "8px";

  return (
    <div
      className={`wx-hero-proof group absolute hidden w-[min(17rem,calc(100vw-2rem))] xl:block xl:w-[272px] ${position}`}
      style={
        {
          "--wx-proof-drift-x": driftX,
          animationDelay: `${index * 0.45}s, ${index * 0.45 + 0.9}s`,
        } as CSSProperties
      }
    >
      <div
        className={`relative overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.04)_52%,rgba(255,255,255,0.02)_100%)] p-4 backdrop-blur-2xl transition-transform duration-500 group-hover:-translate-y-1 ${styles.ring}`}
      >
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 ${styles.glow}`}
          aria-hidden
        />
        <div className="wx-hero-proof-shimmer pointer-events-none absolute inset-0 opacity-40" aria-hidden />

        <div className="relative flex items-start gap-3">
          <span
            className={`wx-hero-proof-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[11px] font-black ring-1 ${styles.icon}`}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-white">{title}</p>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${styles.badge}`}>
                <span className="wx-hero-proof-pulse h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {badge}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300/95">{body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceMarquee() {
  const rows = [...SERVICE_CARDS, ...SERVICE_CARDS];

  return (
    <div className="relative mt-14 w-full sm:mt-16">
      <div className="mb-5 flex items-center justify-center gap-3">
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-emerald-400/40" aria-hidden />
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200/80">Platform katmanları</span>
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-emerald-400/40" aria-hidden />
      </div>

      <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="wx-hero-marquee-track flex w-max gap-3 px-3 py-1 sm:gap-4 sm:px-4">
          {rows.map((card, index) => {
            const tone = MARQUEE_TONE_STYLES[card.tone];
            const href = resolveNavigationHref(card.href);

            return (
              <Link
                key={`${card.title}-${index}`}
                href={href}
                prefetch={shouldDisableLinkPrefetch(href) ? false : undefined}
                className={`wx-hero-marquee-card group flex w-[min(19rem,calc(100vw-2.5rem))] shrink-0 items-center gap-3.5 rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0.04)_100%)] p-3.5 text-left backdrop-blur-xl sm:w-[20.5rem] sm:gap-4 sm:p-4 ${tone.glow}`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[11px] font-black ring-1 ${tone.icon}`}
                >
                  {card.initials}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-white sm:text-[15px]">{card.title}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.badge}`}>
                      {card.badge}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-400">{card.body}</p>
                </div>

                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-emerald-200 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:border-emerald-400/30 group-hover:bg-emerald-500/10 group-hover:opacity-100"
                  aria-hidden
                >
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function WexonHero() {
  return (
    <section className="relative overflow-hidden border-b border-emerald-950/30 bg-[#03150f] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(16,185,129,0.42),transparent_40%),linear-gradient(180deg,#063322_0%,#042418_52%,#02150f_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.22) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-[760px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[90px]" />

      {FLOATING_PROOFS.map((proof, index) => (
        <FloatingProof key={proof.title} {...proof} index={index} />
      ))}

      <div className="relative mx-auto flex min-h-[min(100svh,820px)] max-w-[1500px] flex-col px-5 pb-14 pt-24 sm:min-h-[860px] sm:px-8 sm:pb-16 sm:pt-32 lg:min-h-[900px] lg:px-12 xl:px-16 2xl:px-20">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-[11px] font-black text-slate-200 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
            WexPay aktif · WexHotel ve WexB2B roadmap
          </span>

          <h1 className="wx-hero-headline mx-auto mt-6 max-w-[980px] text-[clamp(2rem,6.4vw,5.1rem)] font-black leading-[1.04] tracking-[-0.02em] text-white sm:mt-8 sm:leading-[1.02]">
            <span className="wx-hero-headline-line">
              <span>Sistemlerinizi tek</span>
              <WexonHeroRotatingWord words={WORDS} />
              <span>altyapısında büyütün</span>
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-base font-semibold leading-8 text-slate-300 sm:text-lg">
            Wexon, restoran operasyonundan lisans ve abonelik kararlarına kadar tüm ürünlerinizi merkezi Core
            katmanında birleştiren çok ürünlü SaaS platformudur.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/demo/wexpay/business"
              className="wx-tactile wx-hero-primary-cta inline-flex w-full items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-500 px-7 py-4 text-sm font-black text-white shadow-[0_22px_54px_-18px_rgba(16,185,129,0.55)] hover:bg-emerald-400 sm:w-auto"
            >
              WexPay demosunu aç
              <span className="ml-2" aria-hidden>
                →
              </span>
            </Link>
            <Link
              href="/demo-request"
              className="wx-tactile inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-7 py-4 text-sm font-black text-white backdrop-blur-xl hover:border-emerald-400/40 hover:bg-white/[0.1] sm:w-auto"
            >
              Demo talep et
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {TRUST_BADGES.map((badge) => (
              <span key={badge} className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-xs font-black text-slate-300 backdrop-blur">
                {badge}
              </span>
            ))}
          </div>

          <div className="mx-auto mt-8 flex max-w-xs items-center justify-center gap-5 text-xs font-black text-slate-300">
            <span className="text-white">Wexon Core</span>
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            <span>Çözüm ortağı altyapısı</span>
          </div>
        </div>

        <ServiceMarquee />
      </div>
    </section>
  );
}
