import Link from "next/link";

const DEMO_CARDS: {
  title: string;
  description: string;
  href: string;
  cta: string;
  metric: { label: string; value: string }[];
  tone: "customer" | "business" | "product";
}[] = [
  {
    title: "Müşteri QR deneyimi",
    description:
      "Müşteri QR okutarak menüyü görür, sipariş verir ve ödeme akışını deneyimler.",
    href: "/demo/wexpay/customer",
    cta: "QR Demosu",
    tone: "customer",
    metric: [
      { label: "Akış", value: "QR · Menü · Sepet · Ödeme" },
      { label: "Cihaz", value: "Mobil öncelikli" },
    ],
  },
  {
    title: "İşletme paneli",
    description:
      "İşletme; masaları, siparişleri, ödemeleri, bildirimleri ve raporları tek panelden takip eder.",
    href: "/demo/wexpay/business",
    cta: "İşletme Paneli",
    tone: "business",
    metric: [
      { label: "Modüller", value: "Masa · Sipariş · Ödeme · Menü" },
      { label: "Bildirimler", value: "Canlı olay akışı" },
    ],
  },
  {
    title: "WexPay ürün sayfası",
    description:
      "WexPay'in restoran ve kafeler için sunduğu operasyon sistemini inceleyin.",
    href: "/products/wexpay",
    cta: "Ürünü Aç",
    tone: "product",
    metric: [
      { label: "İçerik", value: "Modüller · Paketler · Akış" },
      { label: "Hedef", value: "Restoran ve kafeler" },
    ],
  },
];

function Dot({ tone }: { tone: "customer" | "business" | "product" }) {
  const cls =
    tone === "customer"
      ? "bg-emerald-400"
      : tone === "business"
        ? "bg-teal-400"
        : "bg-emerald-300";
  return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />;
}

export default function WexonLiveDemo() {
  return (
    <section className="relative px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28 xl:px-16 2xl:px-20">
      <div className="relative mx-auto max-w-[1560px]">
        <div className="relative overflow-hidden rounded-[28px] border border-white/5 bg-[radial-gradient(circle_at_80%_-20%,#0d3326_0%,transparent_55%),linear-gradient(180deg,#06101c_0%,#0a1626_100%)] px-5 py-14 shadow-2xl shadow-slate-950/30 sm:rounded-[36px] sm:px-10 sm:py-20 lg:px-16">
          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(circle at 50% 30%, black 0%, black 60%, transparent 95%)",
              WebkitMaskImage:
                "radial-gradient(circle at 50% 30%, black 0%, black 60%, transparent 95%)",
            }}
          />
          <div className="pointer-events-none absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-[#5dff65]/15 blur-[140px]" />

          <div className="relative">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-[#5dff65]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Canlı demo
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                WexPay&apos;i{" "}
                <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                  iş başında
                </span>{" "}
                görün
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300/90 sm:text-lg">
                QR müşteri deneyimi ve işletme paneli aynı canlı demo verisiyle çalışır. Sipariş,
                ödeme, masa, bildirim ve rapor akışlarını birlikte test edin.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
              {DEMO_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-2">
                    <Dot tone={card.tone} />
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                      {card.cta}
                    </p>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{card.description}</p>

                  <dl className="mt-5 space-y-2">
                    {card.metric.map((m) => (
                      <div
                        key={m.label}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
                      >
                        <dt className="text-slate-400">{m.label}</dt>
                        <dd className="font-bold text-slate-100">{m.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <Link
                    href={card.href}
                    className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#5dff65] px-4 py-3 text-sm font-bold text-white shadow-sm shadow-[#5dff65]/30 transition-colors hover:bg-[#48e050]"
                  >
                    {card.cta} Aç
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center text-sm text-slate-400">
              Canlı demo; menü, sipariş, ödeme, masa, bildirim ve rapor akışlarını gösterir.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
