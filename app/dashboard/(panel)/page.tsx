import Link from "next/link";
import { publicUrl } from "@/lib/wexon/urls";
import {
  DashboardAccountStatusNotice,
  DashboardCompactPanel,
  DashboardEmptyState,
  DashboardInfoRow,
  DashboardMetricList,
  DashboardMetricRow,
  DashboardStatusBar,
  DashboardStatusItem,
  DashboardUsageRow,
} from "@/components/marketing/WexonDashboardCards";
import {
  dashboardHref,
  entitlementNumber,
  formatCoreStatus,
  getCustomerDashboardData,
} from "@/lib/wexon-core-dashboard";
import { wexpayHref } from "@/lib/wexon-organization-context";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string; checkout?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const {
    organization,
    organizationContext,
    wexPayAccess,
    wexPayLicense,
    wexPayInstallation,
    linkedRestaurant,
    branchCount,
    tableCount,
    menuProductCount,
    entitlementMap,
  } = await getCustomerDashboardData(params);

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bilgileri bulunamadı."
        description="Wexon Core müşteri paneli için organizasyon kaydı gereklidir."
      />
    );
  }

  const displayOrganizationName = linkedRestaurant?.name ?? organization.name;
  const onboarding = wexPayInstallation?.settingsJson as { onboardingStatus?: string; message?: string; estimatedBusinessDays?: number } | null;
  const isCheckoutSuccess = params.checkout === "success";
  const hasPendingOnboarding = onboarding?.onboardingStatus === "PENDING_SETUP";
  const hasWexPayAccess = wexPayAccess?.allowed === true;
  const wexpayAppHref = wexpayHref("/apps/wexpay", organizationContext.organizationId);
  const attentionItems = [
    !hasWexPayAccess ? "WexPay erişimi Core tarafından aktif değil" : null,
    organization.restaurants.length === 0 ? "Bağlı restoran bulunmuyor" : null,
    menuProductCount === 0 ? "Menü ürünü bulunmuyor" : null,
    organization.invoices.length === 0 ? "Fatura kaydı yok" : null,
  ].filter(Boolean) as string[];
  const todoItems = [
    {
      title: "Bağlı restoran ekleyin",
      description: "WexPay operasyonlarını başlatmak için işletme bilgilerinizi tamamlayın.",
      href: dashboardHref("/dashboard/organization", organizationContext),
      show: organization.restaurants.length === 0,
    },
    {
      title: "Menü ürünlerinizi oluşturun",
      description: "Ürün ve menü kapsamınızı WexPay tarafında hazırlayın.",
      href: wexpayAppHref,
      show: menuProductCount === 0,
    },
    {
      title: "Fatura bilgilerinizi kontrol edin",
      description: "Fatura kayıtları oluştuğunda bu alandan takip edebilirsiniz.",
      href: dashboardHref("/dashboard/billing", organizationContext),
      show: organization.invoices.length === 0,
    },
    {
      title: "Kullanıcılarınızı gözden geçirin",
      description: "Ekip erişimlerini ve rollerini düzenli kontrol edin.",
      href: dashboardHref("/dashboard/users", organizationContext),
      show: organization.memberships.length <= 1,
    },
  ].filter((item) => item.show);

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      {isCheckoutSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <p className="text-sm font-black">Aboneliğiniz başarıyla başlatıldı.</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed">WexPay lisansınız aktif edildi ve kurulum süreciniz başlatıldı. Ekibimiz 5 iş günü içinde kurulum detaylarını netleştirmek için sizinle iletişime geçecektir.</p>
        </div>
      )}
      {!isCheckoutSuccess && hasPendingOnboarding && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">WexPay kurulum süreci devam ediyor.</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">Kurulum süreciniz başlatıldı. Ekibimiz 5 iş günü içinde kurulum detaylarını netleştirmek için sizinle iletişime geçecektir.</p>
        </div>
      )}
      {!organization.isActive && <DashboardAccountStatusNotice />}
          <section className="relative min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] p-5 text-white shadow-2xl shadow-slate-950/20 sm:rounded-[32px] sm:p-8">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
            <div className="relative grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:items-center">
              <div className="min-w-0 max-w-4xl">
                <span className="mb-6 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
                  Wexon Core
                </span>
                <h1 className="break-words text-3xl font-black leading-tight tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
                  Hoş geldiniz, {displayOrganizationName}
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  Wexon Core üzerinden hesabınızı, ürün erişimlerinizi ve operasyon durumunuzu tek yerden takip edin.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href={wexpayAppHref}
                    className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-600 sm:w-auto"
                  >
                    WexPay uygulamasına git
                  </Link>
                  <Link
                    href={publicUrl("/contact")}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
                  >
                    Destek talebi oluştur
                  </Link>
                </div>
              </div>
              <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-slate-950/20 backdrop-blur sm:rounded-[28px]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Bugün dikkat gerekenler</p>
                    <p className="mt-1 text-lg font-black text-white">Operasyon uyarıları</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                    {attentionItems.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {attentionItems.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-bold text-slate-200">
                      Şu anda kritik bir uyarı bulunmuyor.
                    </div>
                  ) : (
                    attentionItems.map((item) => (
                      <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-bold text-slate-200">
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <DashboardStatusBar>
            <DashboardStatusItem label="Organizasyon" value="Oluşturuldu" />
            <DashboardStatusItem label="WexPay erişimi" value={hasWexPayAccess ? "Aktif" : "Bekliyor"} />
            <DashboardStatusItem label="İlk kullanıcı" value={organization.memberships.length > 0 ? "Eklendi" : "Eksik"} />
            <DashboardStatusItem label="Restoran" value={organization.restaurants.length > 0 ? "Eklendi" : "Eklenmedi"} />
            <DashboardStatusItem label="Menü" value={menuProductCount > 0 ? "Hazır" : "Hazırlanmadı"} />
            <DashboardStatusItem label="Fatura" value={organization.invoices.length > 0 ? "Kayıt var" : "Eksik"} />
          </DashboardStatusBar>

          <section className="grid gap-5 xl:grid-cols-2">
            <DashboardCompactPanel title="Yapılacaklar" description="Hesabınızı kullanıma hazır hale getiren öneriler">
              {todoItems.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                  Şu anda tamamlanması gereken kritik bir adım görünmüyor.
                </div>
              ) : (
                <div className="space-y-3">
                  {todoItems.map((item) => (
                    <Link key={item.title} href={item.href} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-white">
                      <p className="text-sm font-black text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{item.description}</p>
                    </Link>
                  ))}
                </div>
              )}
            </DashboardCompactPanel>

            <DashboardCompactPanel title="WexPay operasyon durumu" description="Operasyonel kapsam ve kullanım">
              <DashboardMetricList>
                <DashboardMetricRow label="Bağlı restoranlar" value={organization.restaurants.length} />
                <DashboardMetricRow label="Şube" value={branchCount} />
                <DashboardMetricRow label="Masa" value={tableCount} />
                <DashboardMetricRow label="Menü ürünü" value={menuProductCount} />
                <DashboardMetricRow label="Kullanıcı / personel" value={organization.memberships.length} />
              </DashboardMetricList>
            </DashboardCompactPanel>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <DashboardCompactPanel title="Kullanım ve kapasite" description="Paket limitlerine göre kullanım">
              <div className="space-y-3">
                <DashboardUsageRow label="Şube" used={branchCount} limit={entitlementNumber(entitlementMap, "branch_limit")} />
                <DashboardUsageRow label="Masa" used={tableCount} limit={entitlementNumber(entitlementMap, "table_limit")} />
                <DashboardUsageRow label="Menü ürünü" used={menuProductCount} limit={entitlementNumber(entitlementMap, "product_limit")} />
                <DashboardUsageRow label="Personel" used={organization.memberships.length} limit={entitlementNumber(entitlementMap, "staff_limit")} />
              </div>
            </DashboardCompactPanel>

            <DashboardCompactPanel title="Finans ve abonelik" description="Lisans ve fatura görünümü">
              <DashboardMetricList>
                <DashboardMetricRow label="Fatura durumu" value={organization.invoices.length > 0 ? "Kayıt var" : "Kayıt yok"} />
                <DashboardMetricRow label="Lisans tipi" value={wexPayLicense ? formatCoreStatus(wexPayLicense.licenseType) : "-"} />
                <DashboardMetricRow label="Yenileme tarihi" value={wexPayLicense?.endsAt ? wexPayLicense.endsAt.toLocaleDateString("tr-TR") : "-"} />
                <DashboardMetricRow label="Paket" value={wexPayLicense ? wexPayLicense.plan.name : "-"} />
              </DashboardMetricList>
            </DashboardCompactPanel>
          </section>

          <section className="grid gap-5">
            <DashboardCompactPanel title="Son işlemler" description="Hesap ve ürün erişimiyle ilgili son kayıtlar">
              {organization.auditLogs.length === 0 ? (
                <DashboardEmptyState title="Henüz işlem geçmişi bulunmuyor." description="İşlem kayıtları oluştuğunda burada görüntülenir." />
              ) : (
                <div className="space-y-3">
                  {organization.auditLogs.slice(0, 3).map((log) => (
                    <DashboardInfoRow key={log.id} label={log.action} value={log.createdAt.toLocaleString("tr-TR")} />
                  ))}
                </div>
              )}
              <Link href={dashboardHref("/dashboard/activity", organizationContext)} className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50">
                Aktiviteleri görüntüle
              </Link>
            </DashboardCompactPanel>
          </section>
    </div>
  );
}
