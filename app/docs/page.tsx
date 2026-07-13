import type { Metadata } from "next";
import Link from "next/link";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection, PublicFeatureGrid } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Dokümantasyon",
  description:
    "Wexon Core, WexPay Business Suite, demo, güvenlik ve ödeme notları için başlangıç dokümantasyonu.",
  alternates: { canonical: "/docs" },
};

const sections = [
  {
    title: "Başlangıç",
    description: "Wexon.dev | Business OS’e giriş: ürünler, demo talebi ve erken erişim.",
    href: "/demo-request",
  },
  {
    title: "Wexon Core",
    description: "Organizasyon, kullanıcı, abonelik ve ürün erişiminin merkezi karar kaynağı.",
    href: "/products/wexon-core",
  },
  {
    title: "WexPay Business Suite",
    description: "QR menü, masa, sipariş ve manuel tahsilat; online ödeme PayTR onayına bağlıdır.",
    href: "/products/wexpay",
  },
  {
    title: "Demo & ön başvuru",
    description: "Canlı ürünü görmek veya erken erişim için form akışları.",
    href: "/demo-request",
  },
  {
    title: "Güvenlik notu",
    description: "Fixture hesaplar production’da kapalı; kontrollü müşteri kurulumu tercih edilir.",
    href: "/status",
  },
  {
    title: "Ödeme notu",
    description: "Public ödeme kapalıdır; PayTR merchant / test-mode süreci tamamlanana kadar canlı tahsilat yok.",
    href: "/packages",
  },
];

export default function DocsPage() {
  return (
    <WexonStaticPageShell
      badge="Dokümantasyon"
      headline="Wexon dokümantasyonuna başlangıç"
      description="Bu sayfa üretim-hazır bir başlangıç haritasıdır. Sahte endpoint katalogları veya gizli anahtarlar yayınlanmaz."
    >
      <PublicFeatureGrid
        items={sections.map((s) => ({
          title: s.title,
          description: s.description,
        }))}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800"
          >
            {section.title} →
          </Link>
        ))}
      </section>

      <PublicCTASection
        title="Detaylı entegrasyon için iletişime geçin"
        description="Kontrollü API erişimi ve kurulum için demo veya e-posta ile yazın."
        primary={{ label: "Demo Talep Et", href: "/demo-request" }}
        secondary={{ label: "API Referansı", href: "/api-reference" }}
      />
    </WexonStaticPageShell>
  );
}
