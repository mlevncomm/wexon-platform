import Link from "next/link";
import { SetupModeBanner } from "@/components/wexpay/SetupModeBanner";
import {
  DashboardAccountStatusNotice,
  DashboardCompactPanel,
  DashboardEmptyState,
  DashboardInfoRow,
  DashboardKpiGrid,
  DashboardMetricList,
  DashboardMetricRow,
  DashboardSectionTitle,
  DashboardStatusBar,
  DashboardStatusItem,
  DashboardSummaryCard,
  DashboardUsageRow,
} from "@/components/marketing/WexonDashboardCards";
import {
  dashboardHref,
  entitlementNumber,
  formatCoreStatus,
  getCustomerDashboardData,
} from "@/lib/wexon-core-dashboard";
import { wexpayHref } from "@/lib/wexon-organization-context";
import { loadOrStartActivationJourneyView } from "@/lib/wexpay-activation-journey";
import { getCustomerSession } from "@/lib/wexon-customer-auth";

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

  const customerSession = await getCustomerSession();
  const activationView = hasWexPayAccess
    ? await loadOrStartActivationJourneyView({
        organizationId: organization.id,
        actorUserId: customerSession?.userId ?? null,
      })
    : null;
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

  const activeUsers = organization.memberships.filter((membership) => membership.status === "ACTIVE").length;
  const activeProducts = organization.appInstallations.filter((installation) => installation.status === "ACTIVE").length;
  const activeLicenses = organization.licenses.filter((license) => license.status === "ACTIVE").length;
  const openSupport = organization.auditLogs.filter((log) => {
    if (log.action !== "customer.support_ticket.created") return false;
    const meta =
      typeof log.metadataJson === "object" && log.metadataJson !== null
        ? (log.metadataJson as { status?: string })
        : {};
    const status = meta.status ?? "OPEN";
    return status === "OPEN" || status === "IN_PROGRESS";
  }).length;
  const subscription = organization.subscriptions[0];
  const renewalSoon =
    wexPayLicense?.endsAt != null
      ? wexPayLicense.endsAt.getTime() - new Date().getTime() <= 30 * 24 * 60 * 60 * 1000 &&
        wexPayLicense.endsAt.getTime() > new Date().getTime()
      : false;

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <DashboardSectionTitle
        badge="Genel bakış"
        title={displayOrganizationName}
        description="Hesap durumu, ürün erişimleri ve operasyon özetini tek yerden takip edin."
        actions={
          <>
            <Link
              href={wexpayAppHref}
              className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white hover:bg-emerald-600"
            >
              WexPay uygulaması
            </Link>
            <Link
              href={dashboardHref("/dashboard/users", organizationContext)}
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Kullanıcılar
            </Link>
            <Link
              href={dashboardHref("/dashboard/support", organizationContext)}
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Destek
            </Link>
          </>
        }
      />

      {isCheckoutSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <p className="text-sm font-black">Aboneliğiniz başarıyla başlatıldı.</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed">
            WexPay lisansınız aktif edildi ve kurulum süreciniz başlatıldı. Ekibimiz 5 iş günü içinde kurulum detaylarını
            netleştirmek için sizinle iletişime geçecektir.
          </p>
        </div>
      )}
      {!isCheckoutSuccess && hasPendingOnboarding && !activationView && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-950">WexPay kurulum süreci devam ediyor.</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
            Kurulum süreciniz başlatıldı. Ekibimiz 5 iş günü içinde kurulum detaylarını netleştirmek için sizinle iletişime
            geçecektir.
          </p>
        </div>
      )}

      {activationView ? (
        <SetupModeBanner
          view={activationView}
          continueHref={dashboardHref("/dashboard/wexpay/activation", organizationContext)}
        />
      ) : null}

      {!activationView?.setupMode && activationView?.uiStatus === "ACTIVE" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-current/70">Akıllı Aktivasyon</p>
          <p className="mt-1 text-sm font-black">Canlı Kullanım</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-current/80">
            Akıllı Aktivasyon tamamlandı. Public QR ve sipariş akışları canlıdır.
          </p>
        </div>
      ) : null}

      {!organization.isActive && <DashboardAccountStatusNotice />}

      <DashboardKpiGrid>
        <DashboardSummaryCard
          label="Aktif kullanıcı"
          value={activeUsers}
          helper={`Toplam üyelik: ${organization.memberships.length}`}
          href={dashboardHref("/dashboard/users", organizationContext)}
        />
        <DashboardSummaryCard
          label="Aktif ürün"
          value={activeProducts}
          helper="Aktif ürün kurulumları"
          href={dashboardHref("/dashboard/products", organizationContext)}
        />
        <DashboardSummaryCard
          label="Aktif lisans"
          value={activeLicenses}
          helper={wexPayLicense ? wexPayLicense.plan.name : "Lisans kaydı yok"}
          href={dashboardHref("/dashboard/subscription", organizationContext)}
        />
        <DashboardSummaryCard
          label="Abonelik"
          value={subscription ? formatCoreStatus(subscription.status) : "Yok"}
          helper={
            subscription
              ? "Otomatik ödeme durumu sağlayıcı yapılandırmasına bağlıdır."
              : "Henüz abonelik kaydı bulunmuyor."
          }
          href={dashboardHref("/dashboard/subscription", organizationContext)}
        />
        <DashboardSummaryCard
          label="Açık destek"
          value={openSupport}
          helper="Yanıt bekleyen talepler"
          href={dashboardHref("/dashboard/support", organizationContext)}
          tone={openSupport > 0 ? "warning" : "default"}
        />
        {wexPayLicense?.endsAt ? (
          <DashboardSummaryCard
            label="Yenileme"
            value={wexPayLicense.endsAt.toLocaleDateString("tr-TR")}
            helper={renewalSoon ? "30 gün içinde yaklaşıyor" : "Lisans bitiş tarihi"}
            tone={renewalSoon ? "warning" : "default"}
            href={dashboardHref("/dashboard/subscription", organizationContext)}
          />
        ) : null}
        <DashboardSummaryCard label="WexPay erişimi" value={hasWexPayAccess ? "Aktif" : "Kapalı"} helper="Core erişim kararı" />
        <DashboardSummaryCard label="Şube / masa" value={`${branchCount} / ${tableCount}`} helper="Operasyon kapsamı" />
      </DashboardKpiGrid>

          <DashboardStatusBar>
            <DashboardStatusItem label="Organizasyon" value={organization.isActive ? "Aktif" : "Pasif"} />
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
