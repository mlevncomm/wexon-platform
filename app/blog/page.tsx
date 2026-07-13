import type { Metadata } from "next";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection } from "@/components/marketing/PublicMarketingBlocks";

export const metadata: Metadata = {
  title: "Blog",
  description: "Wexon notları, ürün güncellemeleri ve Business OS yaklaşımları burada yayınlanır.",
  alternates: { canonical: "/blog" },
};

const posts = [
  {
    title: "Wexon.dev ile işletmeler için Business OS yaklaşımı",
    summary:
      "Tek Core üzerinde ürün erişimi, abonelik ve operasyon panellerini birleştirmenin nedeni: daha az parçalı yazılım yığını.",
  },
  {
    title: "WexPay Business Suite: abonelik ve ödeme süreçleri",
    summary:
      "Restoran operasyonu için masa, sipariş ve tahsilat akışları; online ödeme PayTR onay ve test-mode sürecine bağlı olarak açılır.",
  },
];

export default function BlogPage() {
  return (
    <WexonStaticPageShell
      badge="Blog"
      headline="Wexon notları ve ürün güncellemeleri"
      description="Yeni yazılar burada yayınlanacak. Aşağıdaki kartlar yaklaşımımızı özetleyen başlangıç notlarıdır; sahte başarı istatistiği içermez."
    >
      <section className="grid gap-5 lg:grid-cols-2">
        {posts.map((post) => (
          <article key={post.title} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">Not</p>
            <h2 className="mt-3 text-lg font-black tracking-tight text-slate-950 sm:text-xl">{post.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{post.summary}</p>
          </article>
        ))}
      </section>

      <PublicCTASection
        title="Güncellemelerden haberdar olun"
        description="Ürün demosu veya ön başvuru için bizimle iletişime geçebilirsiniz."
        primary={{ label: "Demo Talep Et", href: "/demo-request" }}
        secondary={{ label: "İletişim", href: "/contact" }}
      />
    </WexonStaticPageShell>
  );
}
