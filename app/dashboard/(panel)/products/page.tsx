import Link from "next/link";
import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardInfoRow,
  DashboardSectionTitle,
  DashboardStatusPill,
} from "@/components/marketing/WexonDashboardCards";
import { coreAccessDenialMessage } from "@/lib/wexon-core-access";
import { dashboardHref, formatCoreStatus, getCustomerDashboardData } from "@/lib/wexon-core-dashboard";
import { wexpayHref } from "@/lib/wexon-organization-context";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

export default async function DashboardProductsPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const { organization, organizationContext, products, wexPayAccess, wexPayLicense, wexPayInstallation } =
    await getCustomerDashboardData(params);

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bilgileri bulunamadı."
        description="Ürün erişimlerini görüntülemek için organizasyon kaydı gereklidir."
      />
    );
  }
  const hasActiveWexPay = wexPayAccess?.allowed === true;
  const wexPayDenialMessage =
    wexPayAccess && !wexPayAccess.allowed && wexPayAccess.reason
      ? coreAccessDenialMessage(wexPayAccess.reason)
      : null;
  const wexpayAppHref = wexpayHref("/apps/wexpay", organizationContext.organizationId);
  const onboarding = wexPayInstallation?.settingsJson as { onboardingStatus?: string; message?: string } | null;

  return (
    <div className="space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Ürünler"
        title="Ürün erişimleri"
        description="Organizasyonunuzun kullanabildiği Wexon ürünlerini ve erişim durumlarını buradan takip edebilirsiniz."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {products.map((product) => {
          const isWexPay = product.key === "wexpay";
          return (
            <article
              key={product.id}
              className={`rounded-[32px] border bg-white p-7 shadow-sm shadow-slate-200/60 ${
                isWexPay && hasActiveWexPay
                  ? "border-emerald-200 shadow-xl shadow-emerald-100/50"
                  : "border-slate-200"
              }`}
            >
              <DashboardStatusPill active={product.status === "ACTIVE"}>
                {formatCoreStatus(product.status)}
              </DashboardStatusPill>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">{product.name}</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {isWexPay
                  ? hasActiveWexPay
                    ? "WexPay erişiminiz aktif. Restoran operasyonlarınızı Wexon Core üzerinden yönetilen lisans ile kullanabilirsiniz."
                    : wexPayDenialMessage ??
                      "WexPay erişiminiz şu anda aktif değil. Lisans ve kurulum durumunu kontrol edin veya abonelik başlatın."
                  : "Bu ürün yakında Wexon ekosistemine eklenecek."}
              </p>
              {isWexPay && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                  <p>
                    Core erişim:{" "}
                    <span className={hasActiveWexPay ? "text-emerald-700" : "text-amber-700"}>
                      {hasActiveWexPay ? "Aktif" : "Kapalı"}
                    </span>
                  </p>
                  {!hasActiveWexPay && wexPayAccess?.reason && (
                    <p className="mt-1 text-slate-500">Neden: {wexPayDenialMessage}</p>
                  )}
                  {wexPayAccess?.billingState && wexPayAccess.billingState !== "ok" && (
                    <p className="mt-1 text-slate-500">Fatura durumu: {wexPayAccess.billingState}</p>
                  )}
                </div>
              )}
              {isWexPay ? (
                <div className="mt-6 grid gap-3">
                  <DashboardInfoRow label="Paket" value={wexPayLicense?.plan.name ?? "-"} />
                  <DashboardInfoRow label="Lisans" value={wexPayLicense ? formatCoreStatus(wexPayLicense.status) : "-"} />
                  <DashboardInfoRow label="Uygulama" value={wexPayInstallation ? formatCoreStatus(wexPayInstallation.status) : "-"} />
                  {onboarding?.onboardingStatus === "PENDING_SETUP" && (
                    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                      Kurulum süreci devam ediyor. Ekibimiz 5 iş günü içinde kurulum detaylarını netleştirmek için sizinle iletişime geçecektir.
                    </p>
                  )}
                  <Link href={hasActiveWexPay ? wexpayAppHref : "/checkout?product=wexpay&plan=standard"} className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600">
                    {hasActiveWexPay ? "Uygulamaya git" : "Abonelik başlat"}
                  </Link>
                  <Link href={dashboardHref("/dashboard/subscription", organizationContext)} className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50">
                    Paket detaylarını görüntüle
                  </Link>
                </div>
              ) : (
                <Link href={`/products/${product.key}`} className="mt-7 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50">
                  Ürün sayfası
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
