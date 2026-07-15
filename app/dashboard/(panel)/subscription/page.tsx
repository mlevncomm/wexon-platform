import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardInfoRow,
  DashboardPanel,
  DashboardSectionTitle,
  DashboardUsageCard,
} from "@/components/marketing/WexonDashboardCards";
import {
  entitlementLabels,
  entitlementNumber,
  formatCoreDate,
  formatCoreStatus,
  getCustomerDashboardData,
} from "@/lib/wexon-core-dashboard";
import { isPaytrSubscriptionEnabled } from "@/lib/paytr/paytr-client";

const textEntitlements = ["reporting_level", "integration_level", "support_level", "role_level"];

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

export default async function DashboardSubscriptionPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const {
    organization,
    wexPayLicense,
    wexPayInstallation,
    branchCount,
    tableCount,
    menuProductCount,
    entitlementMap,
  } = await getCustomerDashboardData(params);
  const paytrOn = isPaytrSubscriptionEnabled();

  if (!organization || !wexPayLicense) {
    return (
      <DashboardEmptyState
        title="Aktif lisans bulunamadı."
        description="Lisans ve paket bilgileri oluştuğunda bu alanda görüntülenecektir."
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Lisanslar"
        title="Lisans ve paket durumu"
        description="WexPay paketinizin kapsamını, lisans durumunu ve kullanım limitlerini buradan takip edebilirsiniz."
      />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardPanel>
          <div className="mb-6">
            <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
              Lisans Bilgileri
            </span>
            <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950">Aktif WexPay lisansı</h2>
          </div>
          <div className="grid gap-3">
            <DashboardInfoRow label="Ürün" value={wexPayLicense.product.name} />
            <DashboardInfoRow label="Paket" value={wexPayLicense.plan.name} />
            <DashboardInfoRow label="Lisans tipi" value={formatCoreStatus(wexPayLicense.licenseType)} />
            <DashboardInfoRow label="Durum" value={formatCoreStatus(wexPayLicense.status)} />
            <DashboardInfoRow label="Başlangıç tarihi" value={formatCoreDate(wexPayLicense.startsAt)} />
            <DashboardInfoRow label="Bitiş / yenileme tarihi" value={formatCoreDate(wexPayLicense.endsAt)} />
            <DashboardInfoRow
              label="Uygulama kurulumu"
              value={wexPayInstallation ? formatCoreStatus(wexPayInstallation.status) : "-"}
            />
            <DashboardInfoRow
              label="Otomatik ödeme"
              value={
                paytrOn
                  ? "Sağlayıcı yapılandırmasına bağlı — otomatik ödeme garantisi gösterilmez"
                  : "Aktif değil (online abonelik tahsilatı kapalı)"
              }
            />
          </div>
        </DashboardPanel>

        <DashboardPanel>
          <div className="mb-6">
            <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
              Paket Limitleri
            </span>
            <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950">Kullanım limitleri</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DashboardUsageCard label="Şube limiti" used={branchCount} limit={entitlementNumber(entitlementMap, "branch_limit")} />
            <DashboardUsageCard label="Masa limiti" used={tableCount} limit={entitlementNumber(entitlementMap, "table_limit")} />
            <DashboardUsageCard label="Ürün limiti" used={menuProductCount} limit={entitlementNumber(entitlementMap, "product_limit")} />
            <DashboardUsageCard
              label="Personel limiti"
              used={organization.memberships.length}
              limit={entitlementNumber(entitlementMap, "staff_limit")}
            />
            <DashboardUsageCard label="Aylık işlem limiti" used={0} limit={entitlementNumber(entitlementMap, "monthly_order_limit")} />
            <DashboardUsageCard label="API kullanım limiti" used={0} limit={entitlementNumber(entitlementMap, "api_request_limit")} />
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel>
        <div className="mb-6">
          <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
            Paket Kapsamı
          </span>
          <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950">Yetki ve hizmet seviyeleri</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {textEntitlements.map((key) => (
            <DashboardInfoRow key={key} label={entitlementLabels[key] ?? key} value={String(entitlementMap[key] ?? "-")} />
          ))}
        </div>
      </DashboardPanel>
    </div>
  );
}
