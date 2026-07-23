import type { ReactNode } from "react";
import { Suspense } from "react";
import AdminWexPayPreviewBanner from "@/components/wexpay/AdminWexPayPreviewBanner";
import WexPayBusinessShell from "@/components/wexpay/WexPayBusinessShell";
import { WexPayEmptyAccess } from "@/components/wexpay/WexPayBusinessUI";
import { assertAdminAccess } from "@/lib/wexon-admin-auth";
import { getWexPayAdminPreviewAccess } from "@/lib/wexpay-auth";
import { resolveAdminPreviewWriteState } from "@/lib/wexon-admin-preview-write";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";
import { formatCoreStatus } from "@/lib/wexon-core-dashboard";
import { isWexPayFeatureEnabled } from "@/lib/wexpay-entitlements";
import { writeAuditFailure } from "@/lib/wexon-audit";

export default async function AdminWexPayPreviewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  await assertAdminAccess();
  const { organizationId } = await params;
  const access = await getWexPayAdminPreviewAccess(organizationId);

  if (!access.allowed) {
    await writeAuditFailure({
      action: "wexpay.access.denied",
      message: "Admin WexPay preview erişimi reddedildi.",
      level: "WARN",
      organizationId,
      source: "admin_wexpay_preview",
      metadata: { reason: access.reason, mode: access.mode },
    });
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-4 py-10">
        <WexPayEmptyAccess organizationId={organizationId} reason={access.reason} />
      </main>
    );
  }

  const basePath = wexpayAdminPreviewBasePath(access.organization.id);
  const writeState = await resolveAdminPreviewWriteState(access.organization.id);
  const branches = access.organization.restaurants.flatMap((restaurant) =>
    restaurant.branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ id: branch.id, name: branch.name, restaurantName: restaurant.name })),
  );

  return (
    <div className="min-h-screen bg-[#f4f7f5]">
      <Suspense fallback={null}>
        <AdminWexPayPreviewBanner
          organizationId={access.organization.id}
          organizationName={access.organization.name}
          organizationSlug={access.organization.slug}
          isDemo={access.organization.isDemo}
          writeEnabled={writeState.writeEnabled}
          expiresAt={writeState.expiresAt}
          redirectTo={basePath}
        />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-slate-500">
            WexPay önizleme yükleniyor...
          </div>
        }
      >
        <WexPayBusinessShell
          organizationName={access.organization.name}
          organizationId={access.organization.id}
          isAdminPreview
          basePath={basePath}
          branches={branches}
          packageInfo={{
            planName: access.license.plan.name,
            licenseStatus: formatCoreStatus(access.license.status),
          }}
          features={{
            multiLocation: isWexPayFeatureEnabled(access.entitlementMap, "feature_multi_location"),
            csvExport: isWexPayFeatureEnabled(access.entitlementMap, "feature_csv_export"),
            advancedReports:
              isWexPayFeatureEnabled(access.entitlementMap, "feature_advanced_reports") ||
              isWexPayFeatureEnabled(access.entitlementMap, "feature_reporting_advanced"),
            settings: true,
          }}
        >
          {children}
        </WexPayBusinessShell>
      </Suspense>
    </div>
  );
}
