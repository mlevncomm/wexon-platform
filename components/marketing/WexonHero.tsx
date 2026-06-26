import Link from "next/link";

const TRUST_ITEMS = [
  "WexPay aktif",
  "Core lisans kontrollu",
  "Sanal POS altyapisi",
  "Türkçe operasyon paneli",
];

const PRODUCT_CARDS = [
  { name: "WexPay", status: "Canlı demo hazır", tone: "emerald", detail: "QR menü, sipariş, masa ve ödeme" },
  { name: "WexHotel", status: "Roadmap", tone: "indigo", detail: "Oda, rezervasyon ve misafir yönetimi" },
  { name: "WexB2B", status: "Roadmap", tone: "amber", detail: "Bayi, teklif ve toptan satış akışı" },
];

const CORE_ROWS = [
  ["Lisans", "Aktif"],
  ["Entitlement", "Merkezi"],
  ["Fatura", "Kayıtlı"],
  ["Audit", "Açık"],
];

function ProductStatusCard({
  name,
  status,
  tone,
  detail,
}: {
  name: string;
  status: string;
  tone: string;
  detail: string;
}) {
  const color =
    tone === "emerald"
      ? "bg-emerald-500 text-white"
      : tone === "indigo"
        ? "bg-indigo-500 text-white"
        : "bg-amber-400 text-slate-950";

  return (
    <div className="wx-tactile rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-black tracking-tight text-slate-950">{name}</p>
          <p className="mt-1 max-w-[210px] text-xs font-semibold leading-relaxed text-slate-500">{detail}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${color}`}>{status}</span>
      </div>
    </div>
  );
}

function CorePreview() {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.55)] sm:p-5">
      <div className="rounded-[22px] border border-slate-100 bg-slate-950 p-5 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-white">
              W
            </span>
            <div>
              <p className="text-sm font-black">Wexon Core</p>
              <p className="text-xs font-semibold text-slate-400">Merkezi erişim kararı</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300">
            Online
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {CORE_ROWS.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
              <p className="mt-1 text-sm font-black text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {PRODUCT_CARDS.map((product) => (
          <ProductStatusCard key={product.name} {...product} />
        ))}
      </div>
    </div>
  );
}

export default function WexonHero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-[#f6f8f7]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />

      <div className="relative mx-auto grid min-h-[760px] max-w-[1480px] items-center gap-10 px-5 pb-16 pt-28 sm:px-8 sm:pt-32 lg:grid-cols-[minmax(0,1.04fr)_minmax(420px,0.78fr)] lg:px-12 xl:px-16 2xl:px-20">
        <div className="max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-2 py-1 pr-4 text-xs font-black text-slate-700 shadow-sm shadow-slate-200/60">
            <span className="rounded-full bg-emerald-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-white">
              Wexon
            </span>
            Çok ürünlü SaaS ekosistemi
          </span>

          <h1 className="mt-8 max-w-[980px] text-[2.55rem] font-black leading-[1.02] tracking-[-0.02em] text-slate-950 sm:text-[3.4rem] md:text-[4.2rem] lg:text-[5rem]">
            İşletmenizi tek Core üzerinden yönetin.
          </h1>

          <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-slate-600 sm:text-lg">
            Wexon; WexPay ile restoran operasyonunu, lisans ve abonelik kararlarını, müşteri panelini ve admin
            süreçlerini tek merkezden yöneten modern SaaS platformudur.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo/wexpay/business"
              className="wx-tactile inline-flex items-center justify-center rounded-full bg-slate-950 px-7 py-4 text-sm font-black text-white shadow-[0_18px_44px_-18px_rgba(15,23,42,0.55)] hover:bg-emerald-600"
            >
              WexPay demosunu aç
            </Link>
            <Link
              href="/demo-request"
              className="wx-tactile inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-7 py-4 text-sm font-black text-slate-950 shadow-sm shadow-slate-200/80 hover:border-emerald-200 hover:bg-emerald-50"
            >
              Demo talep et
            </Link>
          </div>

          <div className="mt-8 grid gap-2 text-xs font-black text-slate-600 sm:grid-cols-2 lg:max-w-3xl xl:grid-cols-4">
            {TRUST_ITEMS.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/60">
                <span className="mb-2 block h-1.5 w-8 rounded-full bg-emerald-500" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
            <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">WexPay MVP hazır</span>
            <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">Tenant isolation</span>
            <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">Audit log</span>
            <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">PayTR altyapısı</span>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <CorePreview />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-2xl font-black text-emerald-700">3</p>
              <p className="mt-1 text-xs font-bold text-emerald-900">Ürün ekosistemi</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-2xl font-black text-slate-950">1</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Core karar kaynağı</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-2xl font-black text-slate-950">24/7</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Panel erişimi</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
