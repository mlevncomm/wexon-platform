import { PRICING_PLANS } from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import PricingCard from "@/components/ui/PricingCard";
import SectionHeading from "./SectionHeading";

export default function PricingPreviewSection() {
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
          subtitle="Wexon ürünleri, lisans ve entitlement yapısıyla organization bazında kontrollü şekilde ölçeklenir. Fiyat; ihtiyacınıza göre demo görüşmesinde netleşir."
        />

        <p className="mt-8 text-center text-xs font-semibold text-slate-400">
          Aylık · Yıllık · Tek seferlik lisans seçenekleri · fiyat demo görüşmesinde netleşir
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
          {PRICING_PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              href={`/demo-request?plan=${plan.id}`}
              tone="dark"
            />
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
