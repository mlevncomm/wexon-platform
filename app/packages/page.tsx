import type { Metadata } from "next";
import Link from "next/link";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection } from "@/components/marketing/PublicMarketingBlocks";
import { getPublicWexPayPricingPlans } from "@/lib/wexon-public-pricing";
import { WEXPAY_PROCESSING_DISCLAIMER } from "@/lib/wexpay-tier-config";

export const metadata: Metadata = {
  title: "Paketler",
  description:
    "WexPay paketleri: Essential, Growth, Scale ve Business Suite. Uygunluk kontrolü veya görüşme ile başlayın.",
  alternates: { canonical: "/packages" },
};

export default async function PackagesPage() {
  const plans = await getPublicWexPayPricingPlans();

  return (
    <WexonStaticPageShell
      badge="Paketler"
      headline="WexPay paketleri"
      description="Fiyatlar veritabanındaki güncel planlardan gelir. Canlı online ödeme kapalıdır; uygunluk kontrolü veya görüşme ile ilerlersiniz."
    >
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        {WEXPAY_PROCESSING_DISCLAIMER}
      </p>

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-3xl border p-6 shadow-sm shadow-slate-900/5 sm:p-7 ${
              plan.highlighted
                ? "border-emerald-300 bg-gradient-to-b from-emerald-50 to-white"
                : "border-slate-200/80 bg-white"
            }`}
          >
            {plan.highlighted ? (
              <span className="mb-3 inline-flex rounded-full border border-emerald-200 bg-emerald-100/80 px-3 py-1 text-[11px] font-bold text-emerald-800">
                Önerilen
              </span>
            ) : null}
            <h2 className="text-xl font-black tracking-tight text-slate-950">{plan.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{plan.audience}</p>
            <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">{plan.priceLabel}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{plan.billingNote}</p>
            {plan.processingFeeLabel ? (
              <p className="mt-3 text-sm font-semibold text-slate-800">{plan.processingFeeLabel}</p>
            ) : null}
            {plan.setupFeeLabel ? <p className="mt-1 text-sm text-slate-600">Kurulum: {plan.setupFeeLabel}</p> : null}
            {plan.commitmentLabel ? (
              <p className="mt-1 text-sm text-slate-600">{plan.commitmentLabel}</p>
            ) : null}
            {plan.commitmentNote ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{plan.commitmentNote}</p>
            ) : null}
            {plan.settlementDisplay ? (
              <p className="mt-2 text-xs font-medium text-slate-500">{plan.settlementDisplay}</p>
            ) : null}
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href={plan.ctaHref ?? `/demo-request?product=wexpay&plan=${encodeURIComponent(plan.id)}`}
              className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </section>

      <PublicCTASection
        title="Hangi paket size uygun?"
        description="Başvuru öneri üretir; nihai ticari onay Wexon ekibi tarafından verilir."
        primary={{ label: "Uygunluğunu Kontrol Et", href: "/demo-request?product=wexpay&intent=eligibility" }}
        secondary={{ label: "Görüşme Planla", href: "/randevu-ai?product=wexpay" }}
      />
    </WexonStaticPageShell>
  );
}
