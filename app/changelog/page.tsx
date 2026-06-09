import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const changes = [
  "WexPay canlı demo akışı oluşturuldu",
  "Supabase ve Prisma demo altyapısı eklendi",
  "WexHotel ve WexB2B yakında sayfaları hazırlandı",
  "Wexon.dev müşteri aksiyon sayfaları oluşturuldu",
];

export default function ChangelogPage() {
  return (
    <WexonStaticPageShell
      badge="Değişiklik Günlüğü"
      headline="Wexon değişiklik günlüğü"
      description="Wexon ürünleri ve demo sistemlerindeki önemli geliştirmeler burada listelenecektir."
    >
      <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/60 sm:p-10">
        <div className="space-y-4">
          {changes.map((change, index) => (
            <div key={change} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-black text-white">
                {index + 1}
              </span>
              <p className="text-sm font-bold text-slate-950">{change}</p>
            </div>
          ))}
        </div>
      </section>
    </WexonStaticPageShell>
  );
}
