import WexPayReportsBoard from "@/components/wexpay/WexPayReportsBoard";
import { getWexPayAdminPreviewAccess } from "@/lib/wexpay-auth";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";
import { isWexPayFeatureEnabled } from "@/lib/wexpay-entitlements";
import {
  getBranchDailyReport,
  getOpenTablesSummary,
  getPaymentBreakdownByProvider,
  getTopSellingProducts,
  getWexPayOperationsOverview,
} from "@/lib/wexpay-read";
import { WexPayPanel } from "@/components/wexpay/WexPayBusinessUI";
import Link from "next/link";

type SearchParams = Promise<{ branchId?: string }>;

export default async function WexPayReportsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: SearchParams  }) {
  const { organizationId } = await params;
  const basePath = wexpayAdminPreviewBasePath(organizationId);
  const access = await getWexPayAdminPreviewAccess(organizationId);
  if (!access.allowed) return null;

  const { branchId } = await searchParams;
  const branchOptions = access.organization.restaurants.flatMap((restaurant) =>
    restaurant.branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ id: branch.id, name: branch.name, restaurantName: restaurant.name })),
  );
  const activeBranch = branchOptions.find((branch) => branch.id === branchId) ?? branchOptions[0] ?? null;

  if (!activeBranch) {
    return (
      <WexPayPanel
        eyebrow="Raporlar"
        title="Rapor için aktif şube gerekli"
        description="Satış ve operasyon raporlarını görmek için önce bir şube oluşturun."
        headerAction={
          <Link
            href={`${basePath}/branches`}
            className="inline-flex rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            Şube oluştur
          </Link>
        }
      />
    );
  }

  const [dailyReport, providerBreakdown, topProducts, openTables, overview] = await Promise.all([
    getBranchDailyReport(access.organization.id, activeBranch.id),
    getPaymentBreakdownByProvider(access.organization.id, activeBranch.id),
    getTopSellingProducts(access.organization.id, activeBranch.id, 8),
    getOpenTablesSummary(access.organization.id, activeBranch.id),
    getWexPayOperationsOverview(access.organization.id, activeBranch.id),
  ]);

  const tableStatusRows = [
    { label: "Boş", count: overview.tables.filter((table) => table.status === "EMPTY").length },
    { label: "Dolu", count: overview.tables.filter((table) => table.status === "OCCUPIED").length },
    { label: "Ödeme bekliyor", count: overview.tables.filter((table) => table.status === "PAYMENT_PENDING").length },
    { label: "Kısmi ödendi", count: overview.tables.filter((table) => table.status === "PARTIALLY_PAID").length },
    { label: "Ödendi", count: overview.tables.filter((table) => table.status === "PAID").length },
  ];

  return (
    <WexPayReportsBoard
      branchId={activeBranch.id}
      organizationId={access.organization.id}
      dailyPaidTotal={dailyReport.paidTotal}
      paidCount={dailyReport.paidCount}
      providerBreakdown={providerBreakdown}
      topProducts={topProducts}
      openTables={openTables}
      tableStatusRows={tableStatusRows}
      canExportCsv={isWexPayFeatureEnabled(access.entitlementMap, "feature_csv_export")}
      hasAdvancedReports={
        isWexPayFeatureEnabled(access.entitlementMap, "feature_advanced_reports") ||
        isWexPayFeatureEnabled(access.entitlementMap, "feature_reporting_advanced")
      }
    />
  );
}
