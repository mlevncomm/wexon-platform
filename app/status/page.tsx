import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const statuses = [
  { title: "Wexon.dev", description: "Çalışıyor", tone: "emerald" as const },
  { title: "WexPay Demo", description: "Çalışıyor", tone: "emerald" as const },
  { title: "Wexon Core", description: "Geliştirme aşamasında", tone: "slate" as const },
  { title: "WexHotel", description: "Yakında", tone: "indigo" as const },
  { title: "WexB2B", description: "Yakında", tone: "amber" as const },
];

export default function StatusPage() {
  return (
    <WexonStaticPageShell
      badge="Durum"
      headline="Wexon servis durumu"
      description="Wexon servislerinin çalışma durumunu bu sayfadan takip edebilirsiniz."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {statuses.map((status) => (
          <WexonInfoCard key={status.title} title={status.title} description={status.description} tone={status.tone} />
        ))}
      </section>
      <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/60">
        <p className="text-sm font-semibold leading-relaxed text-slate-600">
          Bu sayfa şu an statik bilgilendirme amaçlıdır. Production servis izleme sistemi daha sonra eklenecektir.
        </p>
      </section>
    </WexonStaticPageShell>
  );
}
