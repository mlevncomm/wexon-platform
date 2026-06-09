import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell, { WexonPageCTA } from "@/components/marketing/WexonStaticPageShell";

const futureTeams = [
  "Frontend geliştirme",
  "Backend geliştirme",
  "Ürün tasarımı",
  "Müşteri başarısı",
  "Satış ve iş geliştirme",
];

export default function CareersPage() {
  return (
    <WexonStaticPageShell
      badge="Kariyer"
      headline="Wexon ekibine katılın"
      description="Wexon; ürün, yazılım, tasarım, müşteri başarısı ve iş geliştirme alanlarında büyümeyi hedefleyen bir SaaS girişimidir."
    >
      <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/60 sm:p-10">
        <span className="mb-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-600">
          Açık Pozisyonlar
        </span>
        <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950">Şu an açık pozisyon bulunmuyor</h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
          Wexon ekibi büyüdükçe yeni roller bu sayfada duyurulacaktır.
        </p>
      </section>

      <section>
        <h2 className="mb-8 text-3xl font-black tracking-[-0.02em] text-slate-950">Gelecekteki ekip alanları</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {futureTeams.map((team) => (
            <WexonInfoCard key={team} title={team} />
          ))}
        </div>
      </section>

      <WexonPageCTA
        title="Wexon ekibiyle iletişime geçin"
        primary={{ label: "İletişime Geç", href: "/contact" }}
      />
    </WexonStaticPageShell>
  );
}
