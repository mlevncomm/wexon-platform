import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const sections = ["Toplanan bilgiler", "Kullanım amacı", "Saklama ve güvenlik", "İletişim"];

export default function PrivacyPage() {
  return (
    <WexonStaticPageShell
      badge="Gizlilik"
      headline="Gizlilik Politikası"
      description="Wexon gizlilik politikası taslak bilgilendirme sayfasıdır. Production yayına geçmeden önce hukuki metinler profesyonel olarak güncellenecektir."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => (
          <WexonInfoCard key={section} title={section} />
        ))}
      </section>
      <section className="rounded-[32px] border border-amber-200 bg-amber-50 p-8 text-sm font-bold text-amber-900">
        Bu metin nihai hukuki metin değildir.
      </section>
    </WexonStaticPageShell>
  );
}
