import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const apiCards = [
  "Kimlik doğrulama",
  "WexPay restoran API",
  "Ödeme entegrasyonları",
  "Webhook olayları",
  "Lisans ve abonelik API",
];

export default function ApiReferencePage() {
  return (
    <WexonStaticPageShell
      badge="API Referansı"
      headline="Wexon API referansı yakında"
      description="Wexon Core ve WexPay production API yapısı tamamlandığında entegrasyon dokümantasyonu bu sayfada yayınlanacaktır."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {apiCards.map((card) => (
          <WexonInfoCard key={card} title={card} />
        ))}
      </section>
      <section className="rounded-[32px] border border-amber-200 bg-amber-50 p-8 text-amber-900">
        <p className="text-sm font-bold">
          Şu an canlı demo API&apos;leri yalnızca demo ortamı içindir; production API değildir.
        </p>
      </section>
    </WexonStaticPageShell>
  );
}
