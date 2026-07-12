import Link from "next/link";
import type { CSSProperties } from "react";
import WexonHeroRotatingWord from "@/components/marketing/WexonHeroRotatingWord";
import { resolveNavigationHref } from "@/lib/wexon/urls";

const WORDS = ["Core", "WexPay", "lisans", "ödeme"];

const FLOATING_PROOFS: Array<{
  initials: string;
  title: string;
  body: string;
  side: "left" | "right";
  badge: string;
}> = [
  {
    initials: "QR",
    title: "WexPay Pilot",
    body: "Restoran, masa, sipariş ve manuel tahsilat akışı pilot müşterilerle aktif.",
    side: "left",
    badge: "Pilot",
  },
  {
    initials: "CO",
    title: "Core karar kaynağı",
    body: "Ürün erişimi ödeme durumundan değil, lisans ve entitlement sisteminden gelir.",
    side: "left",
    badge: "Core",
  },
  {
    initials: "PS",
    title: "Manuel tahsilat",
    body: "İlk production path manuel ödeme; PayTR pilot doğrulama sonrası açılır.",
    side: "right",
    badge: "Ödeme",
  },
  {
    initials: "AU",
    title: "Audit & tenant",
    body: "Kritik erişim, ödeme ve admin işlemleri izlenebilir şekilde kayıtlanır.",
    side: "right",
    badge: "Güvenli",
  },
];

const SERVICE_CARDS = [
  {
    title: "WexPay",
    body: "QR menü, masa, sipariş ve ödeme",
    href: "/products/wexpay",
    initials: "WP",
    badge: "Pilot",
  },
  {
    title: "Wexon Core",
    body: "Lisans, abonelik, kota ve entitlement",
    href: "/#core",
    initials: "CO",
    badge: "Core",
  },
  {
    title: "Customer Portal",
    body: "Müşteri ürün, fatura ve destek paneli",
    href: "/login?next=%2Fdashboard",
    initials: "CP",
    badge: "Giriş",
  },
  {
    title: "PayTR",
    body: "Sanal POS — pilot doğrulama sonrası",
    href: "/demo-request",
    initials: "PT",
    badge: "Yakında",
  },
  {
    title: "WexHotel",
    body: "Otel yönetimi roadmap",
    href: "/products/wexhotel",
    initials: "WH",
    badge: "Roadmap",
  },
  {
    title: "WexB2B",
    body: "Bayi ve toptan satış roadmap",
    href: "/products/wexb2b",
    initials: "B2",
    badge: "Roadmap",
  },
] as const;

const TRUST_BADGES = ["WexPay Pilot", "Tek Core", "Manuel tahsilat", "Türkçe arayüz", "Tenant isolation"];

function FloatingProof({
  initials,
  title,
  body,
  side,
  index,
  badge,
}: {
  initials: string;
  title: string;
  body: string;
  side: "left" | "right";
  index: number;
  badge: string;
}) {
  const position =
    side === "left"
      ? index === 0
        ? "left-[2%] top-[28%] 2xl:left-[4%]"
        : "left-[3%] top-[52%] 2xl:left-[6%]"
      : index === 2
        ? "right-[2%] top-[30%] 2xl:right-[4%]"
        : "right-[3%] top-[52%] 2xl:right-[6%]";

  const driftX = side === "left" ? "-8px" : "8px";

  return (
    <div
      className={`wx-hero-proof group absolute hidden w-[16.5rem] 2xl:block ${position}`}
      style={
        {
          "--wx-proof-drift-x": driftX,
          animationDelay: `${index * 0.45}s, ${index * 0.45 + 0.9}s`,
        } as CSSProperties
      }
    >
      <article className="relative overflow-hidden rounded-[18px] border border-white/10 bg-[#0b2819] p-[18px] shadow-[0_16px_40px_-20px_rgba(0,0,0,0.7)] transition duration-300 group-hover:-translate-y-1 group-hover:border-emerald-400/30">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent" />
        <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl transition-opacity duration-300 group-hover:bg-emerald-400/20" />
        <div className="relative flex items-start justify-between gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-[11px] font-black text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
            {initials}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" aria-hidden />
            {badge}
          </span>
        </div>
        <h3 className="relative mt-3.5 text-[13px] font-bold leading-snug tracking-tight text-white">{title}</h3>
        <p className="relative mt-1.5 text-[11px] font-medium leading-relaxed text-slate-400/90">{body}</p>
      </article>
    </div>
  );
}

function ServiceMarquee() {
  const rows = [...SERVICE_CARDS, ...SERVICE_CARDS];

  return (
    <div className="relative mt-10 w-full sm:mt-12 lg:mt-14">
      <div className="mb-5 flex items-center justify-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/15" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Platform katmanları
        </span>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/15" aria-hidden />
      </div>

      <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="wx-hero-marquee-track flex w-max gap-3 px-3 py-1 sm:gap-3 sm:px-4">
          {rows.map((card, index) => (
            <Link
              key={`${card.title}-${index}`}
              href={resolveNavigationHref(card.href)}
              prefetch={false}
              className="wx-hero-marquee-card group relative flex w-[min(18rem,calc(100vw-2.5rem))] shrink-0 items-center gap-3 overflow-hidden rounded-[18px] border border-white/10 bg-[#0b2819] px-4 py-3.5 text-left shadow-[0_16px_40px_-20px_rgba(0,0,0,0.7)] transition duration-300 hover:-translate-y-1 hover:border-emerald-400/30 sm:w-[19rem]"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent" />
              <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl transition-opacity duration-300 group-hover:bg-emerald-400/20" />

              <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-[11px] font-black text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
                {card.initials}
              </span>

              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-bold tracking-tight text-white">{card.title}</p>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">
                    {card.badge}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400/90">{card.body}</p>
              </div>

              <span className="relative shrink-0 text-[13px] text-slate-500 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-emerald-300" aria-hidden>
                →
              </span>
            </Link>
          ))}
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
        <FloatingProof
          key={proof.title}
          initials={proof.initials}
          title={proof.title}
          body={proof.body}
          side={proof.side}
          badge={proof.badge}
          index={index}
        />
      ))}

      <div className="wx-hero-shell relative mx-auto flex w-full max-w-[1500px] flex-col">
        <div className="wx-hero-copy mx-auto w-full">
          <span className="wx-hero-eyebrow">
            <span className="wx-hero-eyebrow-dot" aria-hidden />
            <span>WexPay Pilot Launch</span>
            <span className="wx-hero-eyebrow-sep" aria-hidden>
              ·
            </span>
            <span>WexHotel ve WexB2B roadmap</span>
          </span>

          <h1 className="wx-hero-headline">
            <span className="wx-hero-headline-band wx-hero-headline-enter">
              <span className="wx-hero-headline-band-line" aria-hidden />
              <span className="wx-hero-headline-lead">Sistemlerinizi</span>
              <span className="wx-hero-headline-band-line" aria-hidden />
            </span>
            <span className="wx-hero-headline-track wx-hero-headline-enter wx-hero-headline-enter-delay-1">
              <span className="wx-hero-headline-soft">tek</span>
              <WexonHeroRotatingWord words={WORDS} />
              <span className="wx-hero-headline-soft">altyapısında</span>
              <span className="wx-hero-headline-em">büyütün</span>
            </span>
          </h1>

          <p className="wx-hero-subcopy">
            Wexon, restoran operasyonundan lisans ve abonelik kararlarına kadar tüm ürünlerinizi merkezi Core
            katmanında birleştiren çok ürünlü SaaS platformudur.
          </p>

          <div className="wx-hero-actions">
            <Link
              href="/demo/wexpay/business"
              className="wx-tactile wx-hero-primary-cta wx-hero-cta-primary"
            >
              WexPay demosunu aç
              <span className="ml-2" aria-hidden>
                →
              </span>
            </Link>
            <Link
              href="/demo-request"
              className="wx-tactile wx-hero-cta-secondary"
            >
              Demo talep et
            </Link>
          </div>

          <div className="wx-hero-trust">
            {TRUST_BADGES.map((badge) => (
              <span key={badge} className="wx-hero-trust-pill">
                {badge}
              </span>
            ))}
          </div>

          <div className="wx-hero-footnote">
            <span className="text-white">Wexon Core</span>
            <span className="wx-hero-footnote-dot" aria-hidden />
            <span>Çözüm ortağı altyapısı</span>
          </div>
        </div>

        <ServiceMarquee />
      </div>
    </section>
  );
}
