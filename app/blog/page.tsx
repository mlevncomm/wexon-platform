import WexonInfoCard from "@/components/marketing/WexonInfoCard";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

const topics = [
  "WexPay geliştirme notları",
  "SaaS ve lisans yönetimi",
  "QR menü ve ödeme deneyimi",
  "Wexon Core mimarisi",
];

export default function BlogPage() {
  return (
    <WexonStaticPageShell
      badge="Blog"
      headline="Wexon blog yakında yayında"
      description="Wexon ürünleri, SaaS mimarisi, restoran teknolojileri, ödeme sistemleri ve dijital operasyon yönetimi üzerine içerikler burada yayınlanacaktır."
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {topics.map((topic) => (
          <WexonInfoCard key={topic} title={topic} />
        ))}
      </section>
      <section className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-800 sm:p-10">
        <p className="text-base font-bold">Blog içerikleri yayınlandığında bu sayfa güncellenecektir.</p>
      </section>
    </WexonStaticPageShell>
  );
}
