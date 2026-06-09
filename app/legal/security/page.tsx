import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const sections = [
  "Kimlik ve erişim yönetimi",
  "Veri güvenliği",
  "Ödeme güvenliği",
  "İzleme ve kayıtlar",
  "Production güvenlik planı",
];

export default function SecurityPage() {
  return (
    <WexonStaticPageShell
      badge="Güvenlik"
      headline="Wexon güvenlik yaklaşımı"
      description="Wexon; kimlik, erişim, ödeme ve işletme verilerinin güvenliğini production mimarisinde temel öncelik olarak ele alır."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {sections.map((section) => (
          <WexonInfoCard key={section} title={section} />
        ))}
      </section>
      <section className="rounded-[32px] border border-slate-200 bg-white p-8 text-sm font-semibold leading-relaxed text-slate-600 shadow-sm shadow-slate-200/60">
        Gerçek production güvenlik detayları Wexon Core ve WexPay production sistemi tamamlandığında güncellenecektir.
      </section>
    </WexonStaticPageShell>
  );
}
