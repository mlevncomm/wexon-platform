import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell, { WexonPageCTA } from "@/components/marketing/WexonStaticPageShell";

const reasons = [
  "Tek ekosistem",
  "Ürün bazlı büyüme",
  "Wexon Core altyapısı",
  "WexPay ile başlayan canlı ürün deneyimi",
];

export default function AboutPage() {
  return (
    <WexonStaticPageShell
      badge="Hakkımızda"
      headline="Wexon işletmeler için birleşik SaaS ekosistemi kuruyor"
      description="Wexon; restoran, otel ve B2B operasyonlarını tek lisans, abonelik, fatura, ödeme ve müşteri yönetim altyapısında birleştirmeyi hedefleyen modern bir SaaS platformudur."
    >
      <section>
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950">Neden Wexon?</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => (
            <WexonInfoCard key={reason} title={reason} />
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/60 sm:p-10">
        <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
          Bugünkü odak
        </span>
        <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950">WexPay aktif, ekosistem büyüyor</h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
          Wexon ekosisteminde şu anda aktif ürün WexPay&apos;dir. Restoran ve kafeler için QR menü,
          sipariş, ödeme ve işletme paneli canlı demo akışıyla gösterilebilir. WexHotel ve WexB2B ise
          Wexon ürün yol haritasında yakında geliştirilmesi planlanan ürünlerdir.
        </p>
      </section>

      <WexonPageCTA
        title="Wexon ekosistemini işletmeniz için değerlendirelim"
        primary={{ label: "Demo Talep Et", href: "/demo-request" }}
        secondary={{ label: "WexPay’i İncele", href: "/products/wexpay" }}
      />
    </WexonStaticPageShell>
  );
}
