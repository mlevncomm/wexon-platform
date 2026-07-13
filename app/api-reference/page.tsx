import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection, PublicFeatureGrid } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "API Referansı",
  description:
    "Wexon API erişimi kontrollü sağlanır. Sahte endpoint listesi veya secret yayınlanmaz.",
  alternates: { canonical: "/api-reference" },
};

export default function ApiReferencePage() {
  return (
    <WexonStaticPageShell
      badge="API Referansı"
      headline="Kontrollü API erişimi"
      description="Wexon Core ve WexPay için üretim API’leri müşteri bazlı açılır. Bu sayfada sahte endpoint kataloğu veya gizli anahtar bulunmaz."
    >
      <PublicFeatureGrid
        items={[
          {
            title: "Kimlik & oturum",
            description: "Üretim erişimi kimlik doğrulama ve organizasyon kapsamında verilir.",
          },
          {
            title: "Wexon Core",
            description: "Lisans, abonelik ve ürün entitlement kararları merkezi Core üzerinden yürür.",
          },
          {
            title: "WexPay Business Suite",
            description: "Restoran operasyonu için masa, sipariş ve tahsilat akışları; entegrasyon demo ile planlanır.",
          },
          {
            title: "Webhook’lar",
            description: "Olay abonelikleri müşteri kurulumunda tanımlanır; burada canlı URL listelenmez.",
          },
          {
            title: "Ödeme entegrasyonu",
            description: "PayTR merchant / test-mode süreci tamamlanmadan public canlı charge açılmaz.",
          },
          {
            title: "Rate & güvenlik",
            description: "Production anahtarları yalnızca onaylı ortamlarda; demolar fixture ile karıştırılmaz.",
          },
        ]}
      />

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950 sm:p-8">
        <h2 className="text-lg font-black tracking-tight">Önemli</h2>
        <p className="mt-3 text-sm leading-relaxed">
          Canlı demo veya geliştirme endpoint’leri production API değildir. Entegrasyon ihtiyacınız için demo talebi
          veya{" "}
          <a href="mailto:mlevn@wexon.dev" className="font-semibold underline-offset-2 hover:underline">
            mlevn@wexon.dev
          </a>{" "}
          üzerinden yazın.
        </p>
      </section>

      <PublicCTASection
        title="API erişimi talep edin"
        description="Kapsam ve ortam, onay sonrası birlikte netleştirilir."
        primary={{ label: "Demo Talep Et", href: "/demo-request" }}
        secondary={{ label: "Dokümantasyon", href: "/docs" }}
      />
    </WexonStaticPageShell>
  );
}
