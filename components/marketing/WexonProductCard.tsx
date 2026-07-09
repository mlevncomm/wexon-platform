import Link from "next/link";
import type { WexonProduct } from "@/types/wexon";

interface Props {
  product: WexonProduct;
  highlighted?: boolean;
}

const ACCENT: Record<
  string,
  {
    stripe: string;
    badge: string;
    badgeText: string;
    iconBg: string;
    iconText: string;
    ring: string;
    glow: string;
  }
> = {
  wexpay: {
    stripe: "from-emerald-400 via-emerald-500 to-teal-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeText: "text-emerald-700",
    iconBg: "bg-emerald-500",
    iconText: "text-white",
    ring: "ring-emerald-100",
    glow: "shadow-emerald-200/60",
  },
  wexhotel: {
    stripe: "from-indigo-400 via-indigo-500 to-violet-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    badgeText: "text-indigo-700",
    iconBg: "bg-indigo-500",
    iconText: "text-white",
    ring: "ring-indigo-100",
    glow: "shadow-indigo-200/60",
  },
  wexb2b: {
    stripe: "from-amber-400 via-orange-500 to-amber-500",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    badgeText: "text-amber-800",
    iconBg: "bg-amber-500",
    iconText: "text-white",
    ring: "ring-amber-100",
    glow: "shadow-amber-200/60",
  },
};

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M2 7.5L5.5 11L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function WexonProductCard({ product, highlighted = false }: Props) {
  const accent = ACCENT[product.id];
  const isWexPay = product.id === "wexpay";

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[32px] border bg-white p-7 transition-all duration-300 sm:p-8 ${
        highlighted
          ? `border-emerald-200 shadow-2xl ${accent.glow} ring-1 ring-emerald-100 hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-200/80 lg:scale-[1.02]`
          : product.id === "wexhotel"
            ? "border-slate-200 shadow-sm shadow-slate-200/60 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/50"
            : "border-slate-200 shadow-sm shadow-slate-200/60 hover:-translate-y-1.5 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-100/50"
      }`}
    >
      {/* Top accent stripe */}
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent.stripe}`} />
      {highlighted && (
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-300/25 blur-3xl" />
      )}

      {/* Coming soon corner badge */}
      {!isWexPay && product.statusLabel && (
        <span
          className={`absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
            product.id === "wexhotel"
              ? "bg-indigo-950 text-indigo-200 ring-1 ring-inset ring-indigo-400/30"
              : "bg-amber-950 text-amber-200 ring-1 ring-inset ring-amber-400/30"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              product.id === "wexhotel" ? "bg-indigo-300" : "bg-amber-300"
            }`}
          />
          {product.statusLabel}
        </span>
      )}

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${accent.iconBg} ${accent.iconText} text-base font-black shadow-lg ring-4 ${accent.ring}`}
          >
            {product.name.replace("Wex", "")[0]}
          </div>
          <div>
            <p className="text-lg font-black tracking-tight text-slate-950">{product.name}</p>
            {isWexPay && product.statusLabel && (
              <span
                className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${accent.badge}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {product.statusLabel}
              </span>
            )}
          </div>
        </div>
        {highlighted && (
          <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-300">
            Pilot ürün
          </span>
        )}
      </div>

      {/* Tagline + description */}
      <h3 className="relative mt-6 text-xl font-black leading-snug tracking-[-0.01em] text-slate-950">
        {product.tagline}
      </h3>
      <p className="relative mt-3 text-[15px] leading-relaxed text-slate-600">{product.description}</p>

      {isWexPay && (
        <div className="relative mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
          {["Pilot demo", "QR müşteri", "İşletme paneli", "Manuel tahsilat"].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Features */}
      <ul className="relative mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {product.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${accent.iconBg} ${accent.iconText}`}>
              <CheckIcon />
            </span>
            <span className="font-medium">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <div className="relative mt-auto grid gap-2.5 pt-7">
        {isWexPay ? (
          <>
            <Link
              href={product.href}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              Ürünü İncele
              <span aria-hidden>→</span>
            </Link>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/demo/wexpay/business"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-center text-[13px] font-bold leading-tight text-white shadow-sm shadow-emerald-500/30 transition-colors hover:bg-emerald-600"
              >
                İşletme Demosu
              </Link>
              <Link
                href="/demo/wexpay/customer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-center text-[13px] font-bold leading-tight text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                QR Müşteri
              </Link>
            </div>
          </>
        ) : (
          <Link
            href="/demo-request"
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800`}
          >
            Demo Talep Et
          </Link>
        )}
      </div>
    </article>
  );
}
