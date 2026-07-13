import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection, PublicFeatureGrid } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Çözümler",
  description: "Restoran, otel, B2B ve işletme yönetimi için Wexon.dev | Business OS çözümleri.",
  alternates: { canonical: "/solutions" },
};

const solutions = [
  {
    title: "Restoran & kafe",
    description: "Masa, sipariş, mutfak ve tahsilat süreçlerini WexPay Business Suite ile yönetin.",
  },
  {
    title: "Otel & konaklama",
    description: "WexHotel için ön kayıt alıyoruz; oda ve misafir operasyonları aynı Core altında planlanıyor.",
  },
  {
    title: "B2B satış",
    description: "Bayi, toptan ve işletmeler arası sipariş yönetimi için WexB2B yol haritasında.",
  },
  {
    title: "SaaS abonelik",
    description: "Plan, lisans ve organizasyon erişimini Wexon Core üzerinden yönetin.",
  },
  {
    title: "QR sipariş & ödeme",
    description: "Masa QR ile sipariş ve hesap akışları; online ödeme PayTR onayı sonrası genişler.",
  },
  {
    title: "İşletme yönetimi",
    description: "Kullanıcılar, şubeler, ürün erişimi ve destek süreçleri tek Business OS çatısında.",
  },
];

export default function SolutionsPage() {
  return (
    <WexonStaticPageShell
      badge="Çözümler"
      headline="İşletmeniz için modern Business OS çözümleri"
      description="Wexon.dev | Business OS; restoran operasyonundan abonelik yönetimine kadar ürünleri aynı çekirdekte birleştirir."
    >
      <PublicFeatureGrid items={solutions} />
      <PublicCTASection
        title="Hangi çözüm size uygun?"
        description="Demo talep ederek işletmenize uygun ürün ve paket önerisini birlikte netleştirelim."
        primary={{ label: "Demo Talep Et", href: "/demo-request" }}
        secondary={{ label: "WexPay sayfası", href: "/products/wexpay" }}
      />
    </WexonStaticPageShell>
  );
}
