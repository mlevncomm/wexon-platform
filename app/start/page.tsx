import Link from "next/link";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";

const cards = [
  {
    icon: "demo",
    title: "Demo Talep Et",
    description: "Wexon ürünlerini işletmenize göre birlikte değerlendirelim.",
    href: "/demo-request",
    cta: "Demo Talebi Oluştur",
  },
  {
    icon: "apply",
    title: "Ön Başvuru Yap",
    description: "İşletme ihtiyaçlarınızı paylaşın, uygun ürün ve lisans yapısını belirleyelim.",
    href: "/apply",
    cta: "Başvuruya Git",
  },
  {
    icon: "calendar",
    title: "Randevu Al",
    description: "WexPay ve Wexon Core için demo görüşmesi planlayın.",
    href: "/book-demo",
    cta: "Randevu Planla",
  },
  {
    icon: "wexpay",
    title: "WexPay’i İncele",
    description: "Aktif Wexon ürünü olan WexPay’in restoran/kafe operasyon akışını görün.",
    href: "/products/wexpay",
    cta: "Ürünü Aç",
  },
];

const startFlow = [
  "İhtiyaç analizi",
  "Ürün seçimi",
  "Demo planlama",
  "Paket / lisans önerisi",
  "Kurulum yol haritası",
];

const processSteps = [
  "İşletmenizi ve ihtiyacınızı öğreniyoruz",
  "Size uygun Wexon ürününü belirliyoruz",
  "Canlı demo üzerinden akışı gösteriyoruz",
  "Paket, lisans ve abonelik modelini planlıyoruz",
  "WexPay gerçek kurulum sürecine geçiyoruz",
];

const productStatus = [
  {
    name: "WexPay",
    status: "Demo hazır",
    text: "Restoran ve kafeler için QR menü, sipariş, ödeme ve operasyon paneli canlı demo ile gösterilebilir.",
    href: "/products/wexpay",
    linkLabel: "WexPay’i İncele",
    tone: "emerald",
  },
  {
    name: "WexHotel",
    status: "Yakında",
    text: "Otel ve konaklama işletmeleri için planlanan ikinci Wexon ürünüdür.",
    href: "/products/wexhotel",
    linkLabel: "WexHotel Sayfası",
    tone: "indigo",
  },
  {
    name: "WexB2B",
    status: "Yakında",
    text: "Bayi, toptan satış ve B2B sipariş yönetimi için planlanan üçüncü Wexon ürünüdür.",
    href: "/products/wexb2b",
    linkLabel: "WexB2B Sayfası",
    tone: "amber",
  },
];

const afterRequest = [
  "Ekibimiz başvurunuzu inceler",
  "İşletme tipinize göre ürün önerisi hazırlanır",
  "Demo veya randevu süreci planlanır",
  "Uygun paket ve kurulum yol haritası oluşturulur",
];

function ActionIcon({ type }: { type: string }) {
  const common = "h-5 w-5";
  if (type === "calendar") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "apply") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 3h7l5 5v13H7V3z" strokeLinejoin="round" />
        <path d="M14 3v5h5M10 13h6M10 17h4" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "wexpay") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 14h3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StartPage() {
  return (
    <>
      <WexonNavbar />
      <main className="min-h-screen bg-[#f6f8f7] px-5 pb-20 pt-24 text-slate-950 sm:px-8 md:pt-28 lg:px-12 xl:px-16 2xl:px-20">
        <section className="mx-auto max-w-[1360px]">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] p-8 text-white shadow-2xl shadow-slate-950/20 sm:p-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
            <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="text-center lg:text-left">
                <span className="mb-6 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
                  Başlayın
                </span>
                <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-[-0.02em] text-white sm:text-5xl lg:mx-0">
                  Wexon ile işletmenizi dijitalleştirmeye başlayın
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg lg:mx-0">
                  İlk aşamada işletmenizi, ürün ihtiyacınızı ve operasyon yapınızı öğreniyoruz.
                  Ardından size uygun Wexon ürün, paket ve demo akışını birlikte planlıyoruz.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link href="/demo-request" className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-emerald-400">
                    Demo Talep Et
                  </Link>
                  <Link href="/apply" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10">
                    Ön Başvuru Yap
                  </Link>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-slate-950/30 backdrop-blur">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">Wexon</p>
                    <h2 className="text-xl font-black text-white">Wexon başlangıç akışı</h2>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                    5 adım
                  </span>
                </div>
                <div className="space-y-3">
                  {startFlow.map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-200">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <section className="mt-14">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                İlk Adım
              </span>
              <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
                Size en uygun başlangıç yolunu seçin
              </h2>
            </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/50"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-white shadow-sm shadow-emerald-500/25">
                  <ActionIcon type={card.icon} />
                </div>
                <h2 className="text-xl font-bold text-slate-950">{card.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.description}</p>
                <span className="mt-6 inline-flex text-sm font-bold text-emerald-700 transition-all group-hover:translate-x-1">
                  {card.cta}
                </span>
              </Link>
            ))}
          </div>
          </section>

          <section className="mt-16">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                Süreç
              </span>
              <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
                Nasıl ilerliyoruz?
              </h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
              {processSteps.map((step, index) => (
                <div key={step} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700">
                    {index + 1}
                  </span>
                  <p className="mt-5 text-sm font-bold leading-relaxed text-slate-950">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                Ürün Durumu
              </span>
              <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
                Wexon ekosisteminde mevcut durum
              </h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {productStatus.map((product) => {
                const tone =
                  product.tone === "indigo"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : product.tone === "amber"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700";
                return (
                  <Link
                    key={product.name}
                    href={product.href}
                    className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-1 hover:shadow-xl"
                  >
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tone}`}>
                      {product.status}
                    </span>
                    <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
                      {product.name}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{product.text}</p>
                    <span className="mt-6 inline-flex text-sm font-bold text-emerald-700 transition-all group-hover:translate-x-1">
                      {product.linkLabel}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mt-16">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                Sonraki Adım
              </span>
              <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
                Talebinizden sonra ne olacak?
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {afterRequest.map((item, index) => (
                <div key={item} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <p className="mt-5 text-sm font-bold leading-relaxed text-slate-950">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <div className="rounded-[32px] border border-slate-900 bg-slate-950 p-8 text-center text-white shadow-2xl shadow-slate-950/20 sm:p-12">
              <h2 className="mx-auto max-w-3xl text-3xl font-black tracking-[-0.02em] sm:text-4xl">
                İşletmeniz için en doğru Wexon akışını birlikte planlayalım
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                WexPay, Wexon Core ve gelecek Wexon ürünlerinin işletmenizde nasıl çalışacağını
                birlikte değerlendirelim.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/book-demo" className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-emerald-400">
                  Randevu Al
                </Link>
                <Link href="/demo-request" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10">
                  Demo Talep Et
                </Link>
              </div>
            </div>
          </section>
        </section>
      </main>
      <WexonFooter />
    </>
  );
}
