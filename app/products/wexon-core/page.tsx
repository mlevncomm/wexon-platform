import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection, PublicFeatureGrid } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Wexon Core",
  description: "Wexon Core; organizasyon, kullanıcı, abonelik ve ürün erişimi için Business OS merkezi.",
  alternates: { canonical: "/products/wexon-core" },
};

const features = [
  {
    title: "Organizasyon merkezi",
    description: "İşletme profili, üyelikler ve aktif organizasyon bağlamını tek yerden yönetin.",
  },
  {
    title: "Kullanıcı & yetki",
    description: "Ekip üyeleri, roller ve güvenli oturumlarla kontrollü erişim sağlayın.",
  },
  {
    title: "Abonelik & lisans",
    description: "Plan durumu, lisans ve ürün açılışlarını Wexon Core üzerinden izleyin.",
  },
  {
    title: "Ürün erişimi",
    description: "WexPay Business Suite ve gelecek Wexon ürünleri aynı Core kararlarıyla açılır.",
  },
  {
    title: "Operasyon izi",
    description: "Destek, aktivite ve yönetim panelleri için ortak altyapı.",
  },
  {
    title: "Güvenlik odağı",
    description: "Sınırlı erişim, audit ve güvenli kurulum yaklaşımıyla büyütülebilir yapı.",
  },
];

export default function WexonCoreProductPage() {
  return (
    <WexonStaticPageShell
      badge="Wexon Core"
      headline="İşletme yönetim paneli ve organizasyon merkezi"
      description="Wexon Core; dashboard, kullanıcı, abonelik, ürün erişimi ve operasyon yönetimini Wexon.dev | Business OS altında toplar."
    >
      <PublicFeatureGrid items={features} />
      <PublicCTASection
        title="Core ile başlamak için"
        description="Ön başvuru veya demo talebiyle kurulum sürecini başlatabilirsiniz."
        primary={{ label: "Ön Başvuru", href: "/on-basvuru" }}
        secondary={{ label: "Demo Talep Et", href: "/demo-request" }}
      />
    </WexonStaticPageShell>
  );
}
