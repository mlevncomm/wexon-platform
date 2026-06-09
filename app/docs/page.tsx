import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const docs = ["WexPay kullanım rehberi", "Wexon Core lisans yapısı", "Demo akışı", "Kurulum ve entegrasyon"];

export default function DocsPage() {
  return (
    <WexonStaticPageShell
      badge="Dokümantasyon"
      headline="Wexon dokümantasyonu yakında"
      description="Wexon Core, WexPay ve gelecek Wexon ürünleri için kullanım ve entegrasyon dokümantasyonu bu alanda yayınlanacaktır."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {docs.map((doc) => (
          <WexonInfoCard key={doc} title={doc}>
            <span className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
              Yakında
            </span>
          </WexonInfoCard>
        ))}
      </section>
    </WexonStaticPageShell>
  );
}
