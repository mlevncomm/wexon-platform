import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection, PublicFeatureGrid } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Kariyer",
  description: "Wexon.dev kariyer: şu anda aktif açık pozisyon bulunmuyor. Gelecek fırsatlar için iletişime geçin.",
  alternates: { canonical: "/careers" },
};

export default function CareersPage() {
  return (
    <WexonStaticPageShell
      badge="Kariyer"
      headline="Şu anda aktif açık pozisyon bulunmuyor"
      description="Wexon.dev | Business OS büyüdükçe ürün, yazılım ve müşteri başarı rollerini duyuracağız. Sahte pozisyon listesi yayınlamıyoruz."
    >
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-black tracking-tight text-slate-950">İletişim</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Gelecek fırsatlar için özgeçmişinizi veya kısa bir notu şu adrese iletebilirsiniz:{" "}
          <a href="mailto:mlevn@wexon.dev" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
            mlevn@wexon.dev
          </a>
        </p>
      </section>

      <PublicFeatureGrid
        items={[
          { title: "Ürün & tasarım", description: "Business OS deneyimi ve ürün netliği." },
          { title: "Yazılım", description: "Next.js, platform güvenliği ve operasyon panelleri." },
          { title: "Müşteri başarısı", description: "Kurulum, demo ve erken erişim süreçleri." },
        ]}
      />

      <PublicCTASection
        title="Wexon ile iletişime geçin"
        primary={{ label: "E-posta gönder", href: "mailto:mlevn@wexon.dev" }}
        secondary={{ label: "İletişim sayfası", href: "/contact" }}
      />
    </WexonStaticPageShell>
  );
}
