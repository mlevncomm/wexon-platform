import type { Metadata } from "next";
import Link from "next/link";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";
import { PublicCTASection } from "@/components/marketing/PublicMarketingBlocks";
import { getPublicWexPayPricingPlans } from "@/lib/wexon-public-pricing";

export const metadata: Metadata = {
  title: "Paketler",
  description: "WexPay Business Suite paketleri: Basic, Standard ve Pro. Demo veya ön başvuru ile başlayın.",
  alternates: { canonical: "/packages" },
};

export default async function PackagesPage() {
  const plans = await getPublicWexPayPricingPlans();

  return (
    <WexonStaticPageShell
      badge="Paketler"
      headline="WexPay Business Suite paketleri"
      description="Fiyatlar veritabanındaki güncel planlardan gelir. Canlı online ödeme yapılandırılırken demo veya ön başvuru ile sürece başlayabilirsiniz."
    >
      <section className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-3xl border p-6 shadow-sm shadow-slate-900/5 sm:p-7 ${
              plan.highlighted
                ? "border-emerald-300 bg-gradient-to-b from-emerald-50 to-white"
                : "border-slate-200/80 bg-white"
            }`}
          >
            {plan.highlighted ? (
              <span className="mb-3 inline-flex rounded-full border border-emerald-200 bg-emerald-100/80 px-3 py-1 text-[11px] font-bold text-emerald-800">
                Önerilen
              </span>
            ) : null}
            <h2 className="text-xl font-black tracking-tight text-slate-950">{plan.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{plan.audience}</p>
            <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">{plan.priceLabel}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{plan.billingNote}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/demo-request?product=wexpay&plan=${encodeURIComponent(plan.id)}`}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              Demo Talep Et
            </Link>
          </div>
        ))}
      </section>

      <PublicCTASection
        title="Kurumsal ihtiyaçlarınız için konuşalım"
        description="Özel kurulum, çok şube veya entegrasyon talepleri için ön başvuru bırakabilirsiniz."
        primary={{ label: "Ön Başvuru", href: "/on-basvuru" }}
        secondary={{ label: "İletişim", href: "/contact" }}
      />
    </WexonStaticPageShell>
  );
}
