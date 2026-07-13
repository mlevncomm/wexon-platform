import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Değişiklik Günlüğü",
  description: "Wexon platform kilometre taşları: legal sayfalar, PayTR test-mode altyapısı, DB pricing ve UI polish.",
  alternates: { canonical: "/changelog" },
};

const changes = [
  {
    title: "Public footer sayfaları ve WexPay Business Suite adlandırma",
    detail: "Paketler, çözümler, Wexon Core, Randevu AI ve pazarlama kopyası production-ready hale getirildi.",
  },
  {
    title: "Legal sayfalar ve KVKK içeriği",
    detail: "/kvkk, /gizlilik, /kullanim-sartlari, /cerez-politikasi yayınlandı; Mehmet Levlen / Wexon.dev | Business OS dili.",
  },
  {
    title: "PayTR test-mode altyapısı (safe-blocked)",
    detail: "İframe / subscription yolları hazır; production enable flag’leri kapalı, canlı charge yok.",
  },
  {
    title: "DB-first public pricing",
    detail: "Paket kartları veritabanı planlarından okunur; ödeme kapalıyken demo / ön başvuru CTA’sı.",
  },
  {
    title: "Fixture hesapların production’da kapatılması",
    detail: "Demo/fixture kimlikleri üretim ortamında erişime kapalı tutulur.",
  },
  {
    title: "UI / social polish",
    detail: "Instagram tek resmi sosyal kanal; cookie banner ve static sayfa shell hizalaması iyileştirildi.",
  },
];

export default function ChangelogPage() {
  return (
    <WexonStaticPageShell
      badge="Değişiklik Günlüğü"
      headline="Wexon değişiklik günlüğü"
      description="Gerçek kilometre taşları — uydurma başarı istatistiği veya sahte müşteri logosu yok."
    >
      <section className="space-y-4">
        {changes.map((change, index) => (
          <article
            key={change.title}
            className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-black text-white">
              {index + 1}
            </span>
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">{change.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{change.detail}</p>
            </div>
          </article>
        ))}
      </section>

      <PublicCTASection
        title="Sıradaki adım"
        description="Demo talep ederek güncel ürün durumunu birlikte netleştirebiliriz."
        primary={{ label: "Demo Talep Et", href: "/demo-request" }}
        secondary={{ label: "Durum", href: "/status" }}
      />
    </WexonStaticPageShell>
  );
}
