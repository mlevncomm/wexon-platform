import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const sections = ["Hizmet kapsamı", "Demo kullanımı", "Kullanıcı sorumlulukları", "Sınırlamalar", "İletişim"];

export default function TermsPage() {
  return (
    <WexonStaticPageShell
      badge="Kullanım Şartları"
      headline="Kullanım Şartları"
      description="Wexon kullanım şartları taslak bilgilendirme sayfasıdır. Production yayına geçmeden önce hukuki metinler profesyonel olarak güncellenecektir."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
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
