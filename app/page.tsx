import WexonNavbar from "@/components/marketing/WexonNavbar";
import WexonHero from "@/components/marketing/WexonHero";
import WexonTrustStrip from "@/components/marketing/WexonTrustStrip";
import WexonProductEcosystem from "@/components/marketing/WexonProductEcosystem";
import WexonFeatureGrid from "@/components/marketing/WexonFeatureGrid";
import WexonCore from "@/components/marketing/WexonCore";
import WexonLiveDemo from "@/components/marketing/WexonLiveDemo";
import WexonStatsStrip from "@/components/marketing/WexonStatsStrip";
import WexonPricingPreview from "@/components/marketing/WexonPricingPreview";
import WexonCTA from "@/components/marketing/WexonCTA";
import WexonFooter from "@/components/marketing/WexonFooter";

export default function HomePage() {
  return (
    <>
      <WexonNavbar />
      <main className="flex-1 bg-[#f6f8f7] text-slate-950">
        <WexonHero />
        <div className="wx-defer-section">
          <WexonTrustStrip />
        </div>
        <div className="wx-defer-section">
          <WexonProductEcosystem />
        </div>
        <div className="wx-defer-section">
          <WexonFeatureGrid />
        </div>
        <div className="wx-defer-section">
          <WexonCore />
        </div>
        <div className="wx-defer-section">
          <WexonLiveDemo />
        </div>
        <div className="wx-defer-section">
          <WexonStatsStrip />
        </div>
        <div className="wx-defer-section">
          <WexonPricingPreview />
        </div>
        <div className="wx-defer-section">
          <WexonCTA />
        </div>
      </main>
      <WexonFooter />
    </>
  );
}
