import type { Metadata } from "next";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";
import RoadmapHero from "@/components/marketing/product/RoadmapHero";
import RoadmapCapabilityGrid from "@/components/marketing/product/RoadmapCapabilityGrid";
import RoadmapPreviewSection from "@/components/marketing/product/RoadmapPreviewSection";
import RoadmapFaqSection from "@/components/marketing/product/RoadmapFaqSection";
import RoadmapFinalCta from "@/components/marketing/product/RoadmapFinalCta";
import WexB2BPreview from "@/components/marketing/home/preview/WexB2BPreview";
import { WEXB2B_APP } from "@/lib/wexon-home-content";
import { WEXB2B_CONTENT } from "@/lib/wexon-product-content";

export const metadata: Metadata = {
  title: "WexB2B - Bayi ve Toptan Satış Yönetimi Wexon Ekosisteminde",
  description:
    "WexB2B; bayi ve toptan satış işletmeleri için katalog, teklif, sipariş, cari ve raporlama süreçlerini tek panelde yönetmeyi hedefleyen, roadmap aşamasındaki Wexon ürünüdür.",
  alternates: { canonical: "/products/wexb2b" },
  openGraph: {
    title: "WexB2B - Bayi ve Toptan Satış Yönetimi Wexon Ekosisteminde",
    description:
      "Katalog, teklif, sipariş, cari ve bayi bazlı fiyatlandırma için planlanan Wexon toptan satış ürünü.",
    url: "/products/wexb2b",
  },
};

export default function WexB2BPage() {
  return (
    <>
      <WexonNavbar />
      <main className="flex-1 bg-[#f6f8f7] text-slate-950">
        <RoadmapHero content={WEXB2B_CONTENT} />

        <RoadmapCapabilityGrid capabilities={WEXB2B_CONTENT.capabilities} accent={WEXB2B_CONTENT.accent} />

        <RoadmapPreviewSection
          eyebrow="Ürün Ekranı Önizlemesi"
          title={
            <>
              Bayi ve toptan satış paneli <span className="text-amber-600">bu şekilde çalışacak</span>
            </>
          }
          subtitle="Ürün kataloğu, sipariş & teklif listesi ve operasyon metrikleri tek panelde toplanacak; erişim kararları Wexon Core üzerinden yönetilecek."
        >
          <WexB2BPreview data={WEXB2B_APP} />
        </RoadmapPreviewSection>

        <RoadmapFaqSection items={WEXB2B_CONTENT.faq} accent={WEXB2B_CONTENT.accent} />

        <RoadmapFinalCta
          productId={WEXB2B_CONTENT.id}
          productName={WEXB2B_CONTENT.name}
          accent={WEXB2B_CONTENT.accent}
        />
      </main>
      <WexonFooter />
    </>
  );
}
