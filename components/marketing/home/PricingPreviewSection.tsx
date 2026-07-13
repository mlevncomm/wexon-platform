import SectionShell from "@/components/ui/SectionShell";
import PricingCard from "@/components/ui/PricingCard";
import SectionHeading from "./SectionHeading";
import { getPublicWexPayPricingPlans, startingPriceLabel, ENTERPRISE_PRICING_PLAN } from "@/lib/wexon-public-pricing";

export default async function PricingPreviewSection() {
  const wexPayPlans = await getPublicWexPayPricingPlans();
  const plans = [...wexPayPlans, ENTERPRISE_PRICING_PLAN];
  const startLabel = startingPriceLabel(wexPayPlans);

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
          subtitle={`WexPay Basic, Standard ve Pro paketleri Wexon Core üzerinden lisanslanır. Fiyatlar ${startLabel}'dan başlar; Enterprise ihtiyaçları için teklif alın.`}
        />

        <p className="mt-8 text-center text-xs font-semibold text-slate-400">
          Aylık · Yıllık lisans seçenekleri · KDV hariç liste fiyatları (DB kaynaklı)
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              href={plan.id === "enterprise" ? `/demo-request?plan=${plan.id}` : `/checkout?product=wexpay&plan=${plan.id}`}
              tone="dark"
            />
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
