import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import { PublicCTASection } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Durum",
  description:
    "Wexon servis durumu: operasyonel pazarlama siteleri, kontrollü ürün erişimi ve PayTR pending notu.",
  alternates: { canonical: "/status" },
};

const statuses = [
  {
    title: "wexon.dev (public)",
    description: "Operasyonel — pazarlama ve form sayfaları",
    tone: "emerald" as const,
  },
  {
    title: "WexPay Business Suite",
    description: "Kontrollü erişim — manuel tahsilat odaklı",
    tone: "emerald" as const,
  },
  {
    title: "Wexon Core",
    description: "Operasyonel / kontrollü — lisans & erişim",
    tone: "slate" as const,
  },
  {
    title: "Online ödeme (PayTR)",
    description: "Pending — merchant / test-mode onayı bekleniyor",
    tone: "amber" as const,
  },
  {
    title: "WexHotel & WexB2B",
    description: "Roadmap — ön kayıt / demo",
    tone: "indigo" as const,
  },
];

export default function StatusPage() {
  return (
    <WexonStaticPageShell
      badge="Durum"
      headline="Wexon servis durumu"
      description="Dürüst operasyon özeti. Uptime yüzdesi veya 99.99% gibi kanıtlanmamış iddia yayınlamıyoruz."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((status) => (
          <WexonInfoCard key={status.title} title={status.title} description={status.description} tone={status.tone} />
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-black tracking-tight text-slate-950">Notlar</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-600">
          <li>Public ödeme akışı kapalıdır; canlı charge yoktur.</li>
          <li>Fixture / demo hesapları production’da kullanılmaz.</li>
          <li>Bu sayfa statik bilgilendirmedir; gerçek zamanlı incident paneli henüz yoktur.</li>
        </ul>
      </section>

      <PublicCTASection
        title="Kesinti veya erişim sorunu mu?"
        description="mlevn@wexon.dev adresine yazın; mümkün olan en kısa sürede dönüş yapılır."
        primary={{ label: "E-posta gönder", href: "mailto:mlevn@wexon.dev" }}
        secondary={{ label: "İletişim", href: "/contact" }}
      />
    </WexonStaticPageShell>
  );
}
