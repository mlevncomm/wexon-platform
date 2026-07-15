import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection } from "@/components/marketing/PublicMarketingBlocks";
import WexPayPricingGrid from "@/components/marketing/WexPayPricingGrid";
import { getPublicWexPayPricingPlans } from "@/lib/wexon-public-pricing";

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
      <WexPayPricingGrid plans={plans} disclaimerPlacement="below" />

      <PublicCTASection
        title="Hangi paket size uygun?"
        description="Başvuru öneri üretir; nihai ticari onay Wexon ekibi tarafından verilir."
        primary={{ label: "Uygunluğunu Kontrol Et", href: "/demo-request?product=wexpay&intent=eligibility" }}
        secondary={{ label: "Görüşme Planla", href: "/randevu-ai?product=wexpay" }}
      />
    </WexonStaticPageShell>
  );
}
