import { ENTERPRISE_PLAN } from "@/lib/wexon-home-content";
import { wexPayDisplayPlans } from "@/lib/wexon-pricing";
import WexPayPricingPlans from "@/components/marketing/WexPayPricingPlans";
import SectionShell from "@/components/ui/SectionShell";
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
                büyüyen WexPay paketleri
              </span>
            </>
          }
          subtitle="WexPay paketleri; masa, şube, personel, rapor ve entegrasyon seviyelerine göre ölçeklenir. Aylık veya yıllık faturalandırın; özel kurulum ve SLA ihtiyaçları için Enterprise teklifiyle ilerleyin."
        />

        <div className="mt-12">
          <WexPayPricingPlans
            plans={wexPayDisplayPlans}
            tone="dark"
            gridClassName="lg:grid-cols-4 lg:items-stretch"
            extraCards={[{ plan: ENTERPRISE_PLAN, href: "/demo-request?product=wexpay&source=pricing" }]}
          />
        </div>
      </div>
    </SectionShell>
  );
}
