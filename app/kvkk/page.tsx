import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const sections = [
  {
    title: "Veri sorumlusu",
    description: "Wexon hizmetleri kapsaminda iletilen basvuru, iletisim ve musteri operasyon verileri icin temel bilgilendirme.",
  },
  {
    title: "Isleme amaclari",
    description: "Demo taleplerini degerlendirme, manuel musteri kurulumu, destek surecleri ve WexPay hizmet operasyonlari.",
  },
  {
    title: "Saklama ve guvenlik",
    description: "Veriler yalnizca hizmet, destek ve yasal yukumlulukler icin gerekli sure boyunca saklanir.",
  },
  {
    title: "Basvuru kanali",
    description: "KVKK kapsamindaki talepler info@wexon.dev adresi uzerinden Wexon ekibine iletilebilir.",
  },
];

export default function KvkkPage() {
  return (
    <WexonStaticPageShell
      badge="KVKK"
      headline="KVKK Aydinlatma Metni"
      description="Wexon KVKK aydinlatma metni taslak bilgilendirme sayfasidir. Production yayina gecmeden once hukuki metinler profesyonel olarak guncellenecektir."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => (
          <WexonInfoCard key={section.title} title={section.title} description={section.description} />
        ))}
      </section>
      <section className="rounded-[32px] border border-amber-200 bg-amber-50 p-8 text-sm font-bold text-amber-900">
        Bu metin nihai hukuki metin degildir. Canli kullanim oncesi avukat/onayli KVKK metni ile guncellenmelidir.
      </section>
    </WexonStaticPageShell>
  );
}
