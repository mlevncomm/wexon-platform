import Link from "next/link";
import type { EcosystemProduct } from "@/types/wexon";
import { ECOSYSTEM_PRODUCTS } from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import SectionHeading from "./SectionHeading";
import { ACCENT_CLASSES } from "./accent";
import { WexonIcon } from "./icons";

function ProductCard({ product }: { product: EcosystemProduct }) {
  const accent = ACCENT_CLASSES[product.accent];
  const isPrimary = product.primary;

  return (
    <article
      className={`wx-lift group relative flex h-full flex-col overflow-hidden rounded-[28px] border bg-white p-7 sm:p-8 ${
        isPrimary
          ? "border-emerald-200 shadow-[0_28px_64px_-30px_rgba(16,185,129,0.5)] ring-1 ring-emerald-100"
          : "border-slate-200 shadow-[0_20px_50px_-30px_rgba(2,44,34,0.25)]"
      }`}
    >
      {isPrimary && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-50 to-transparent" />
      )}

      <div className="relative flex items-center justify-between gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent.solid} shadow-sm`}
        >
          <WexonIcon name={product.icon} size={24} />
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${accent.soft}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
          {product.statusLabel}
        </span>
      </div>

      <div className="relative mt-6 flex items-center gap-2">
        <h3 className="text-xl font-black tracking-tight text-slate-950">{product.name}</h3>
        {isPrimary && (
          <span className="rounded-full bg-slate-950 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-300">
            Birincil ürün
          </span>
        )}
      </div>
      <p className="relative mt-2 text-[15px] font-bold leading-snug text-slate-800">{product.tagline}</p>
      <p className="relative mt-3 text-[15px] leading-relaxed text-slate-600">{product.description}</p>

      <div className="relative mt-5 flex flex-wrap gap-2">
        {product.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
            {tag}
          </span>
        ))}
      </div>

      <div className="relative mt-auto pt-7">
        <Link
          href={product.href}
          className={`inline-flex items-center gap-1.5 text-sm font-bold transition-colors ${accent.text} hover:opacity-80`}
        >
          Detayları gör
          <WexonIcon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

export default function ProductEcosystemSection() {
  return (
    <SectionShell id="products" tone="canvas" width="wide">
      <SectionHeading
        eyebrow="Ürün ekosistemi"
        title={
          <>
            Tek platformda bağlı çalışan <span className="text-emerald-600">ürün ekosistemi</span>
          </>
        }
        subtitle="Wexon; restoran, otel ve B2B operasyonlarını merkezi lisans, abonelik ve erişim yönetimiyle aynı platform altında toplar."
      />

      <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {ECOSYSTEM_PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </SectionShell>
  );
}
