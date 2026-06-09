import Link from "next/link";

const CORE_MODULES: { label: string; hint: string }[] = [
  { label: "Müşteri", hint: "CRM çekirdeği" },
  { label: "Lisans", hint: "Ürün lisansları" },
  { label: "Abonelik", hint: "Aylık · Yıllık" },
  { label: "Paket", hint: "Basic · Standard · Pro" },
  { label: "Fatura", hint: "E-Fatura akışı" },
  { label: "Yetki", hint: "Roller ve erişim" },
];

const PRODUCT_STATUS: { name: string; status: string; tone: "active" | "soon" }[] = [
  { name: "WexPay", status: "Demo hazır", tone: "active" },
  { name: "WexHotel", status: "Yakında", tone: "soon" },
  { name: "WexB2B", status: "Yakında", tone: "soon" },
];

const HERO_TRUST_ITEMS = [
  "3 ürün",
  "Tek altyapı",
  "Canlı demo",
  "Türkçe arayüz",
  "WexPay aktif",
];

const CORE_METRICS = [
  "3 ürün",
  "Tek altyapı",
  "Canlı demo",
  "Lisans kontrollü",
];

function FloatingCard({
  className,
  title,
  value,
  description,
  accent = "emerald",
  icon,
}: {
  className?: string;
  title: string;
  value: string;
  description?: string;
  accent?: "emerald" | "indigo" | "amber";
  icon?: React.ReactNode;
}) {
  const ring =
    accent === "emerald"
      ? "bg-emerald-500"
      : accent === "indigo"
        ? "bg-indigo-500"
        : "bg-amber-500";

  return (
    <div
      className={`select-none rounded-2xl border border-white/40 bg-white/95 px-4 py-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-0.5 ${className ?? ""}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${ring} text-white shadow-sm`}>
          {icon ?? <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {title}
          </p>
          <p className="text-[13px] font-bold text-slate-950">{value}</p>
          {description && <p className="mt-1 max-w-[170px] text-[11px] leading-snug text-slate-500">{description}</p>}
        </div>
      </div>
    </div>
  );
}

export default function WexonHero() {
  return (
    <section className="relative">
      <div className="relative min-h-[920px] overflow-hidden border-b border-white/5 bg-[radial-gradient(circle_at_20%_-10%,#0f3024_0%,transparent_50%),radial-gradient(circle_at_85%_-20%,#0a3a2a_0%,transparent_55%),radial-gradient(circle_at_50%_110%,#0b4a35_0%,transparent_55%),linear-gradient(180deg,#050b16_0%,#081424_60%,#0a1828_100%)] pt-28 shadow-[0_40px_80px_-30px_rgba(2,6,15,0.7)] sm:rounded-b-[40px] sm:pt-32 lg:min-h-[960px] lg:rounded-b-[48px] lg:pt-36">
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse at 50% 35%, black 0%, black 55%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 50% 35%, black 0%, black 55%, transparent 90%)",
          }}
        />
        {/* Ambient glows */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.18] blur-[160px]" />
        <div className="pointer-events-none absolute -left-32 top-1/2 h-80 w-80 rounded-full bg-emerald-400/10 blur-[140px]" />
        <div className="pointer-events-none absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-teal-400/10 blur-[140px]" />

        <div className="relative mx-auto max-w-[1560px] px-5 sm:px-10 lg:px-12 xl:px-16 2xl:px-20">
          {/* Wide hero intro */}
          <div className="relative mx-auto max-w-7xl">
            <div className="grid items-center gap-5 lg:grid-cols-[240px_minmax(0,1fr)_240px] xl:grid-cols-[280px_minmax(0,1fr)_280px]">
              <div className="order-2 hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-left shadow-2xl shadow-slate-950/20 backdrop-blur lg:order-1 lg:block">
                <span className="mb-4 inline-flex h-2 w-10 rounded-full bg-emerald-400" />
                <p className="text-sm font-black text-white">WexPay hazır</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  QR menü, sipariş, ödeme ve işletme paneli canlı demo ile gösterilebilir.
                </p>
              </div>

              <div className="order-1 text-center lg:order-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3.5 text-xs font-semibold text-slate-200 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.45)] backdrop-blur">
                  <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
                    Yeni
                  </span>
                  Wexon SaaS ekosistemi
                </span>

                <h1 className="mx-auto mt-7 max-w-[1050px] text-[2.4rem] font-black leading-[1.02] tracking-[-0.02em] text-white sm:text-[3.2rem] md:text-[3.85rem] lg:text-[4.7rem]">
                  İşletmenizi{" "}
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      tek bir SaaS
                    </span>
                  </span>
                  <br className="hidden sm:block" />
                  <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    ekosisteminden
                  </span>{" "}
                  yönetin
                </h1>

                <p className="mx-auto mt-6 max-w-[820px] text-base leading-relaxed text-slate-300/90 sm:text-lg">
                  Wexon; ödeme, restoran operasyonu, otel yönetimi ve B2B satış süreçlerini tek bir
                  lisans, abonelik ve müşteri yönetim altyapısında birleştirir.
                </p>

                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/demo-request"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white shadow-[0_18px_40px_-12px_rgba(16,185,129,0.6)] transition-all hover:bg-emerald-400 hover:shadow-[0_22px_50px_-12px_rgba(52,211,153,0.7)] sm:w-auto"
                  >
                    Demo Talep Et
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link
                    href="/products/wexpay"
                    className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-white py-2 pl-2 pr-6 text-sm font-bold text-slate-950 shadow-[0_18px_40px_-15px_rgba(0,0,0,0.5)] transition-all hover:bg-slate-100 sm:w-auto"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                      <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M2 1.5L8 5L2 8.5V1.5Z" />
                      </svg>
                    </span>
                    WexPay&apos;i İncele
                  </Link>
                </div>

                <Link
                  href="/demo/wexpay/business"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300/95 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
                >
                  Canlı WexPay Demosu
                  <span aria-hidden>→</span>
                </Link>
              </div>

              <div className="order-3 hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-left shadow-2xl shadow-slate-950/20 backdrop-blur lg:block">
                <span className="mb-4 inline-flex h-2 w-10 rounded-full bg-emerald-400" />
                <p className="text-sm font-black text-white">Wexon Core bağlı</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Lisans, abonelik, paket ve erişim yapısı tek merkezden planlanır.
                </p>
              </div>
            </div>

            <div className="mx-auto mt-7 grid max-w-5xl grid-cols-2 gap-2 text-xs font-semibold text-slate-300/85 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
              {HERO_TRUST_ITEMS.map((item) => (
                <span key={item} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:hidden">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left">
                <p className="text-sm font-black text-white">WexPay hazır</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  QR menü, sipariş, ödeme ve işletme paneli canlı demo ile gösterilebilir.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left">
                <p className="text-sm font-black text-white">Wexon Core bağlı</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Lisans, abonelik, paket ve erişim yapısı tek merkezden planlanır.
                </p>
              </div>
            </div>
          </div>

          {/* Mockup region — relative for floating cards */}
          <div className="relative mx-auto mt-9 max-w-[1080px] sm:mt-12">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
            {/* Floating cards (desktop) */}
            <FloatingCard
              className="absolute -left-2 top-12 z-20 hidden md:block lg:-left-24 lg:top-20"
              title="Aktif ürün"
              value="WexPay"
              description="QR menü, sipariş ve ödeme"
              accent="emerald"
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
            <FloatingCard
              className="absolute -right-2 top-6 z-20 hidden md:block lg:-right-24 lg:top-14"
              title="Canlı demo"
              value="Hazır"
              description="Müşteri QR + işletme paneli"
              accent="emerald"
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="2.5" fill="white" />
                </svg>
              }
            />
            <FloatingCard
              className="absolute -left-3 bottom-14 z-20 hidden md:block lg:-left-28 lg:bottom-24"
              title="Wexon Core"
              value="Bağlı"
              description="Lisans ve abonelik altyapısı"
              accent="indigo"
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.6">
                  <path d="M2 6h8M6 2v8" strokeLinecap="round" />
                </svg>
              }
            />
            <FloatingCard
              className="absolute -right-3 bottom-20 z-20 hidden md:block lg:-right-28 lg:bottom-32"
              title="Ekosistem"
              value="3 ürün · tek altyapı"
              accent="amber"
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.6">
                  <path d="M2 4l4-2 4 2M2 6l4 2 4-2M2 8l4 2 4-2" strokeLinejoin="round" />
                </svg>
              }
            />

            {/* Central dashboard mockup */}
            <div className="relative z-10 rounded-[26px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:rounded-[32px] sm:p-4">
              {/* Window chrome */}
              <div className="flex items-center justify-between rounded-t-2xl bg-slate-950/60 px-5 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                </div>
                <div className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-semibold text-slate-400">
                  wexon.dev / core
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                    <path d="M2 3h8M2 6h8M2 9h8" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              <div className="overflow-hidden rounded-b-2xl bg-white">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 shadow-sm">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#10b981" strokeWidth="1.5" />
                        <circle cx="9" cy="9" r="2" fill="#10b981" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[15px] font-black tracking-tight text-slate-950">
                        Wexon Core
                      </p>
                      <p className="text-[11px] text-slate-500">Merkezi işletme altyapısı</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Aktif çekirdek
                  </span>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  {/* Product connection row */}
                  <div className="rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200/60 sm:p-4">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Ürün bağlantıları
                      </p>
                      <span className="text-[11px] font-semibold text-slate-500">3 ürün</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {PRODUCT_STATUS.map((p) => (
                        <div
                          key={p.name}
                          className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm shadow-slate-200/30"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-black text-white ${
                                p.name === "WexPay"
                                  ? "bg-emerald-500"
                                  : p.name === "WexHotel"
                                    ? "bg-indigo-500"
                                    : "bg-amber-500"
                              }`}
                            >
                              {p.name.replace("Wex", "")[0]}
                            </span>
                            <p className="text-[13px] font-bold text-slate-950">{p.name}</p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              p.tone === "active"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.8fr]">
                    {/* Module grid */}
                    <div className="rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200/60 sm:p-4">
                      <div className="mb-3 flex items-center justify-between px-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Core modülleri
                        </p>
                        <span className="text-[11px] font-semibold text-emerald-700">
                          6 / 6 aktif
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {CORE_MODULES.map((m) => (
                          <div
                            key={m.label}
                            className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm shadow-slate-200/40 transition-colors hover:border-emerald-300"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-4 w-4 items-center justify-center rounded-md bg-emerald-100">
                                <span className="h-1.5 w-1.5 rounded-sm bg-emerald-500" />
                              </span>
                              <p className="text-[12px] font-bold text-slate-950">{m.label}</p>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">{m.hint}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mini metrics */}
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200/60 sm:p-4">
                      {CORE_METRICS.map((metric) => (
                        <div key={metric} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm shadow-slate-200/40">
                          <span className="mb-3 block h-2 w-8 rounded-full bg-emerald-500" />
                          <p className="text-sm font-black text-slate-950">{metric}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-[11px] font-semibold sm:px-6">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Tek lisans · tek müşteri · tek fatura
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    Wexon Core <span aria-hidden>→</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pb-10 sm:pb-12" />
        </div>
      </div>
    </section>
  );
}

