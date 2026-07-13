import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection, PublicFeatureGrid } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description:
    "Wexon.dev | Business OS; Mehmet Levlen tarafından yürütülen, işletmeler için modern Business OS markasıdır.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <WexonStaticPageShell
      badge="Hakkımızda"
      headline="Wexon.dev | Business OS"
      description="Mehmet Levlen tarafından yürütülen Wexon.dev | Business OS markası; restoran, otel ve B2B işletmeleri için birleşik bir yazılım ve abonelik platformu kurmayı hedefler."
    >
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Marka yaklaşımımız</h2>
        <p className="mt-4 text-[15px] leading-7 text-slate-600 sm:text-base">
          Wexon; lisans, abonelik, ürün erişimi ve operasyon panellerini tek Core üzerinde birleştirir. Bugünkü canlı odak
          WexPay Business Suite’tir. WexHotel ve WexB2B ön kayıt / demo ile ilerler.
        </p>
      </section>

      <PublicFeatureGrid
        items={[
          {
            title: "Business OS",
            description: "Ürünler ayrı görünür; kararlar ve erişim Wexon Core ile ortak yönetilir.",
          },
          {
            title: "Dürüst yol haritası",
            description: "Hazır olmayan özellikleri hazır gibi göstermeyiz; demo ve ön başvuru ile netleştiririz.",
          },
          {
            title: "Güven & erişim",
            description: "Fixture/demo hesapları production’da kapalı tutulur; kontrollü müşteri kurulumu tercih edilir.",
          },
        ]}
      />

      <PublicCTASection
        title="Birlikte başlayalım"
        description="Demo talebi veya ön başvuru ile işletmenize uygun ürün kapsamını konuşabiliriz."
        primary={{ label: "Demo Talep Et", href: "/demo-request" }}
        secondary={{ label: "İletişim", href: "/contact" }}
      />
    </WexonStaticPageShell>
  );
}
