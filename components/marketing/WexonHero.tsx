import Link from "next/link";
import type { CSSProperties } from "react";
import WexonHeroRotatingWord from "@/components/marketing/WexonHeroRotatingWord";
import WexonHeroServiceMarquee from "@/components/marketing/WexonHeroServiceMarquee";

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
    title: "WexPay Business Suite",
    body: "Restoran, masa, sipariş ve manuel tahsilat akışı kontrollü müşterilerle aktif.",
    side: "left",
    badge: "Canlı",
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
    body: "İlk production path manuel ödeme; PayTR merchant / test-mode onayı sonrası açılır.",
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

const TRUST_BADGES = ["WexPay Business Suite", "Tek Core", "Manuel tahsilat", "Türkçe arayüz", "Tenant isolation"];

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
            <span>WexPay Business Suite</span>
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
              href="/demo-request?product=wexpay"
              className="wx-tactile wx-hero-primary-cta wx-hero-cta-primary"
            >
              WexPay için başvur
              <span className="ml-2" aria-hidden>
                →
              </span>
            </Link>
            <Link href="/products/wexpay" className="wx-tactile wx-hero-cta-secondary">
              WexPay&apos;i incele
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

        <WexonHeroServiceMarquee />
      </div>
    </section>
  );
}
