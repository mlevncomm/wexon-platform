import SectionShell from "@/components/ui/SectionShell";
import PricingCard from "@/components/ui/PricingCard";
import SectionHeading from "./SectionHeading";
import { getPublicWexPayPricingPlans, startingPriceLabel } from "@/lib/wexon-public-pricing";
import { WEXPAY_PROCESSING_DISCLAIMER } from "@/lib/wexpay-tier-config";

export default async function PricingPreviewSection() {
  const plans = await getPublicWexPayPricingPlans();
  const startLabel = startingPriceLabel(plans);

  return (
    <SectionShell id="pricing" tone="dark" width="wide" className="relative">
      <div className="pointer-events-none absolute inset-0 wx-grid-overlay opacity-60" />
      <div className="relative">
        <SectionHeading
          tone="dark"
          eyebrow="Paketler"
          title={
            <>
              İşletmenizin ölçeğine göre{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                büyüyen paketler
              </span>
            </>
          }
          subtitle={`WexPay Essential, Growth, Scale ve Business Suite. Fiyatlar ${startLabel}'dan başlar; uygunluk ve görüşme ile ilerlenir.`}
        />

        <p className="mt-6 text-center text-xs font-semibold text-slate-400">{WEXPAY_PROCESSING_DISCLAIMER}</p>
        <p className="mt-3 text-center text-xs font-semibold text-slate-500">
          Aylık lisans · KDV hariç liste fiyatları (DB kaynaklı) · Canlı satınalma kapalı
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              href={plan.ctaHref ?? `/demo-request?product=wexpay&plan=${plan.id}&intent=eligibility`}
              tone="dark"
            />
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
