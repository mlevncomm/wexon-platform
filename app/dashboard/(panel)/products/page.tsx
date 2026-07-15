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
import { WORKSPACE_GRID_GAP } from "@/lib/wexon-workspace-layout";
import { wexpayHref } from "@/lib/wexon-organization-context";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

function dashboardCtaClass(variant: "primary" | "secondary" = "secondary") {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition-colors";
  if (variant === "primary") {
    return `${base} bg-emerald-500 text-white hover:bg-emerald-600`;
  }
  return `${base} border border-slate-200 bg-white text-slate-900 hover:bg-slate-50`;
}

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
  const hasWexPayLicense = Boolean(wexPayLicense);
  const wexPayDenialMessage =
    wexPayAccess && !wexPayAccess.allowed && wexPayAccess.reason
      ? coreAccessDenialMessage(wexPayAccess.reason)
      : null;
  const wexpayAppHref = wexpayHref("/apps/wexpay", organizationContext.organizationId);
  const onboarding = wexPayInstallation?.settingsJson as { onboardingStatus?: string; message?: string } | null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Ürünler"
        title="Ürün erişimleri"
        description="Organizasyonunuzun kullanabildiği Wexon ürünlerini ve erişim durumlarını buradan takip edebilirsiniz."
      />
      <div className={`grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 ${WORKSPACE_GRID_GAP}`}>
        {products.map((product) => {
          const isWexPay = product.key === "wexpay";
          return (
            <article
              key={product.id}
              className={`min-w-0 rounded-[24px] border bg-white p-6 shadow-sm shadow-slate-200/60 sm:rounded-[28px] sm:p-7 ${
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
                    : hasWexPayLicense
                      ? wexPayDenialMessage ??
                        "Lisansınız kayıtlı ancak erişim şu anda kapalı. Paket değişikliği veya ticari görüşme ile ilerleyebilirsiniz."
                      : "WexPay için önce uygunluk değerlendirmesi ve satış onayı gereklidir. Canlı online ödeme kapalıdır; başvuru veya görüşme ile ilerlersiniz."
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
                  <p className="mt-2 text-slate-500">
                    Paket ve fiyatlar veritabanındaki güncel planlardan gelir. Uygunluk ve ticari onay olmadan erişim
                    açılmaz.
                  </p>
                </div>
              )}
              {isWexPay ? (
                <div className="mt-6 grid gap-3">
                  <DashboardInfoRow label="Paket" value={wexPayLicense?.plan.name ?? "-"} />
                  <DashboardInfoRow label="Lisans" value={wexPayLicense ? formatCoreStatus(wexPayLicense.status) : "-"} />
                  <DashboardInfoRow
                    label="Uygulama"
                    value={wexPayInstallation ? formatCoreStatus(wexPayInstallation.status) : "-"}
                  />
                  {onboarding?.onboardingStatus === "PENDING_SETUP" && (
                    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                      Kurulum süreci devam ediyor. Ekibimiz 5 iş günü içinde kurulum detaylarını netleştirmek için sizinle
                      iletişime geçecektir.
                    </p>
                  )}
                  {hasActiveWexPay ? (
                    <>
                      <Link href={wexpayAppHref} className={dashboardCtaClass("primary")}>
                        Uygulamaya git
                      </Link>
                      <Link
                        href="/demo-request?product=wexpay&intent=plan_change"
                        className={dashboardCtaClass("secondary")}
                      >
                        Paket Değişikliği Talep Et
                      </Link>
                      <Link href="/book-demo?product=wexpay" className={dashboardCtaClass("secondary")}>
                        Üst Pakete / Ticari Görüşme
                      </Link>
                    </>
                  ) : hasWexPayLicense ? (
                    <>
                      <Link
                        href="/demo-request?product=wexpay&intent=plan_change"
                        className={dashboardCtaClass("primary")}
                      >
                        Paket Değişikliği Talep Et
                      </Link>
                      <Link href="/book-demo?product=wexpay" className={dashboardCtaClass("secondary")}>
                        Ticari Görüşme
                      </Link>
                      <Link href="/packages" className={dashboardCtaClass("secondary")}>
                        Paketleri İncele
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/demo-request?product=wexpay&intent=eligibility"
                        className={dashboardCtaClass("primary")}
                      >
                        Uygunluğunu Kontrol Et
                      </Link>
                      <Link href="/on-basvuru?product=wexpay" className={dashboardCtaClass("secondary")}>
                        WexPay&apos;e Başvur
                      </Link>
                      <Link href="/packages" className={dashboardCtaClass("secondary")}>
                        Paketleri İncele
                      </Link>
                    </>
                  )}
                  <Link
                    href={dashboardHref("/dashboard/subscription", organizationContext)}
                    className={dashboardCtaClass("secondary")}
                  >
                    Paket detaylarını görüntüle
                  </Link>
                </div>
              ) : (
                <Link href={`/products/${product.key}`} className={`mt-7 ${dashboardCtaClass("secondary")}`}>
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
