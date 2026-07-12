import type { Metadata } from "next";
import WexonNavbar from "@/components/marketing/WexonNavbar";
import WexonHero from "@/components/marketing/WexonHero";
import WexonFooter from "@/components/marketing/WexonFooter";
import TrustStripSection from "@/components/marketing/home/TrustStripSection";
import ProductEcosystemSection from "@/components/marketing/home/ProductEcosystemSection";
import CorePlatformSection from "@/components/marketing/home/CorePlatformSection";
import InteractiveDemoPreview from "@/components/marketing/home/InteractiveDemoPreview";
import WexPayFlowSection from "@/components/marketing/home/WexPayFlowSection";
import CustomerPortalPreviewSection from "@/components/marketing/home/CustomerPortalPreviewSection";
import StatStripSection from "@/components/marketing/home/StatStripSection";
import PricingPreviewSection from "@/components/marketing/home/PricingPreviewSection";
import SecurityReliabilitySection from "@/components/marketing/home/SecurityReliabilitySection";
import FAQSection from "@/components/marketing/home/FAQSection";
import FinalCTASection from "@/components/marketing/home/FinalCTASection";
import { WEXON_HOME_DESCRIPTION, WEXON_HOME_TITLE, WEXON_SITE_URL } from "@/lib/wexon-site-metadata";

export const metadata: Metadata = {
  title: WEXON_HOME_TITLE,
  description: WEXON_HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: WEXON_HOME_TITLE,
    description: WEXON_HOME_DESCRIPTION,
    url: `${WEXON_SITE_URL}/`,
  },
};

export default function HomePage() {
  return (
    <>
      <WexonNavbar transparent preApplicationBar />
      <main className="flex-1 bg-[#f6f8f7] text-slate-950">
        <WexonHero />
        <TrustStripSection />
        <div className="wx-defer-section">
          <ProductEcosystemSection />
        </div>
        <div className="wx-defer-section">
          <CorePlatformSection />
        </div>
        <div className="wx-defer-section">
          <CustomerPortalPreviewSection />
        </div>
        <div className="wx-defer-section">
          <InteractiveDemoPreview />
        </div>
        <div className="wx-defer-section">
          <WexPayFlowSection />
        </div>
        <div className="wx-defer-section">
          <StatStripSection />
        </div>
        <div className="wx-defer-section">
          <PricingPreviewSection />
        </div>
        <div className="wx-defer-section">
          <SecurityReliabilitySection />
        </div>
        <div className="wx-defer-section">
          <FAQSection />
        </div>
        <div className="wx-defer-section">
          <FinalCTASection />
        </div>
      </main>
      <WexonFooter />
    </>
  );
}
