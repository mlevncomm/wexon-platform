import type { Metadata } from "next";
import Link from "next/link";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection } from "@/components/marketing/PublicMarketingBlocks";
import { WEXON_INSTAGRAM } from "@/lib/wexon/social-links";

export const metadata: Metadata = {
  title: "İletişim",
  description: "Wexon.dev iletişim: mlevn@wexon.dev, Instagram ve demo talebi.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <WexonStaticPageShell
      badge="İletişim"
      headline="Wexon ekibiyle iletişime geçin"
      description="Demo, ön başvuru, iş birliği veya KVKK talepleri için buradayız. Fiziksel adres yayınlanmıyorsa uydurma adres kullanmıyoruz."
    >
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">E-posta</p>
          <a href="mailto:mlevn@wexon.dev" className="mt-2 inline-flex text-base font-bold text-emerald-700 underline-offset-2 hover:underline">
            mlevn@wexon.dev
          </a>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Web</p>
          <a href="https://www.wexon.dev" className="mt-2 inline-flex text-base font-bold text-emerald-700 underline-offset-2 hover:underline" rel="noopener noreferrer">
            https://www.wexon.dev
          </a>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Instagram</p>
          <a
            href={WEXON_INSTAGRAM.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={WEXON_INSTAGRAM.ariaLabel}
            className="mt-2 inline-flex text-base font-bold text-emerald-700 underline-offset-2 hover:underline"
          >
            {WEXON_INSTAGRAM.handle}
          </a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Demo Talep Et", href: "/demo-request" },
          { label: "Ön Başvuru", href: "/on-basvuru" },
          { label: "Randevu talebi", href: "/randevu-ai" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-3xl border border-slate-200/80 bg-white p-5 text-sm font-bold text-slate-950 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800"
          >
            {item.label}
          </Link>
        ))}
      </section>

      <PublicCTASection
        title="Ürün demosu için en hızlı yol"
        description="Formu doldurun; Wexon ekibi uygunluk durumuna göre size dönüş yapsın."
        primary={{ label: "Demo Talep Et", href: "/demo-request" }}
        secondary={{ label: "Paketler", href: "/packages" }}
      />
    </WexonStaticPageShell>
  );
}
