import type { Metadata } from "next";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";
import RoadmapHero from "@/components/marketing/product/RoadmapHero";
import RoadmapCapabilityGrid from "@/components/marketing/product/RoadmapCapabilityGrid";
import RoadmapPreviewSection from "@/components/marketing/product/RoadmapPreviewSection";
import RoadmapFaqSection from "@/components/marketing/product/RoadmapFaqSection";
import RoadmapFinalCta from "@/components/marketing/product/RoadmapFinalCta";
import WexHotelPreview from "@/components/marketing/home/preview/WexHotelPreview";
import { WEXHOTEL_APP } from "@/lib/wexon-home-content";
import { WEXHOTEL_CONTENT } from "@/lib/wexon-product-content";

export const metadata: Metadata = {
  title: "WexHotel - Otel Yönetimi Wexon Ekosisteminde",
  description:
    "WexHotel; otel ve konaklama işletmeleri için oda, rezervasyon, misafir, ödeme, fatura ve personel süreçlerini tek panelde yönetmeyi hedefleyen, roadmap aşamasındaki Wexon ürünüdür.",
  alternates: { canonical: "/products/wexhotel" },
  openGraph: {
    title: "WexHotel - Otel Yönetimi Wexon Ekosisteminde",
    description:
      "Oda, rezervasyon, misafir, ödeme ve personel süreçleri için planlanan Wexon otel yönetimi ürünü.",
    url: "/products/wexhotel",
  },
};

export default function WexHotelPage() {
  return (
    <>
      <WexonNavbar />
      <main className="flex-1 bg-[#f6f8f7] text-slate-950">
        <RoadmapHero content={WEXHOTEL_CONTENT} />

        <RoadmapCapabilityGrid capabilities={WEXHOTEL_CONTENT.capabilities} accent={WEXHOTEL_CONTENT.accent} />

        <RoadmapPreviewSection
          eyebrow="Ürün Ekranı Önizlemesi"
          title={
            <>
              Otel operasyon paneli <span className="text-indigo-600">bu şekilde çalışacak</span>
            </>
          }
          subtitle="Oda durumu, rezervasyon listesi ve operasyon metrikleri tek panelde toplanacak; erişim kararları Wexon Core üzerinden yönetilecek."
        >
          <WexHotelPreview data={WEXHOTEL_APP} />
        </RoadmapPreviewSection>

        <RoadmapFaqSection items={WEXHOTEL_CONTENT.faq} accent={WEXHOTEL_CONTENT.accent} />

        <RoadmapFinalCta
          productId={WEXHOTEL_CONTENT.id}
          productName={WEXHOTEL_CONTENT.name}
          accent={WEXHOTEL_CONTENT.accent}
        />
      </main>
      <WexonFooter />
    </>
  );
}
