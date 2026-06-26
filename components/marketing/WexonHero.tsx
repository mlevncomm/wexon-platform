import Link from "next/link";
import WexonHeroRotatingWord from "@/components/marketing/WexonHeroRotatingWord";

const WORDS = ["Core", "WexPay", "lisans", "ödeme"];

const FLOATING_PROOFS: Array<{
  initials: string;
  title: string;
  body: string;
  side: "left" | "right";
}> = [
  {
    initials: "QR",
    title: "WexPay aktif",
    body: "Restoran, masa, sipariş ve ödeme akışı tek operasyon ekranında.",
    side: "left",
  },
  {
    initials: "CO",
    title: "Core karar kaynağı",
    body: "Ürün erişimi ödeme durumundan değil, lisans ve entitlement sisteminden gelir.",
    side: "left",
  },
  {
    initials: "PS",
    title: "Sanal POS hazır",
    body: "PayTR temeli, webhook doğrulama ve idempotency altyapısı kurulu.",
    side: "right",
  },
  {
    initials: "AU",
    title: "Audit & tenant",
    body: "Kritik erişim, ödeme ve admin işlemleri izlenebilir şekilde kayıtlanır.",
    side: "right",
  },
];

const SERVICE_CARDS = [
  ["WexPay", "QR menü, masa, sipariş ve ödeme"],
  ["Wexon Core", "Lisans, abonelik, kota ve entitlement"],
  ["Customer Portal", "Müşteri ürün, fatura ve destek paneli"],
  ["Admin Portal", "Organizasyon, lisans ve audit yönetimi"],
  ["PayTR", "Sanal POS bağlantı altyapısı"],
  ["WexHotel", "Otel yönetimi roadmap"],
  ["WexB2B", "Bayi ve toptan satış roadmap"],
];

const TRUST_BADGES = ["3 ürün", "Tek Core", "Canlı demo", "Türkçe arayüz", "Tenant isolation"];

function FloatingProof({
  initials,
  title,
  body,
  side,
  index,
}: {
  initials: string;
  title: string;
  body: string;
  side: "left" | "right";
  index: number;
}) {
  const position =
    side === "left"
      ? index === 0
        ? "left-[7%] top-[28%]"
        : "left-[9%] top-[48%]"
      : index === 2
        ? "right-[7%] top-[30%]"
        : "right-[9%] top-[48%]";

  return (
    <div
      className={`wx-hero-float-slow absolute hidden w-[260px] rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-left shadow-[0_22px_70px_-32px_rgba(0,0,0,0.65)] backdrop-blur-xl xl:block ${position}`}
      style={{ animationDelay: `${index * 0.6}s` }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white shadow-lg shadow-emerald-500/25">
          {initials}
        </span>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <div className="mt-1 flex gap-0.5 text-emerald-300" aria-hidden>
            ★★★★★
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-300">{body}</p>
    </div>
  );
}

function ServiceMarquee() {
  const rows = [...SERVICE_CARDS, ...SERVICE_CARDS];

  return (
    <div className="mx-auto mt-12 max-w-[1120px] overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div className="wx-hero-marquee flex w-max gap-4">
        {rows.map(([title, body], index) => (
          <Link
            key={`${title}-${index}`}
            href={title === "WexPay" ? "/products/wexpay" : title === "Wexon Core" ? "/docs" : "/demo-request"}
            className="wx-tactile flex h-[132px] w-[265px] shrink-0 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.08] p-5 text-left shadow-[0_24px_80px_-44px_rgba(0,0,0,0.8)] backdrop-blur-xl hover:border-emerald-400/40 hover:bg-white/[0.12]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/20">
              <span className="h-3 w-3 rounded bg-blue-400" />
            </span>
            <div>
              <p className="text-base font-black text-white">{title}</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">{body}</p>
            </div>
          </Link>
        ))}
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
