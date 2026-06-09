import type { ReactNode } from "react";
import { Suspense } from "react";
import { WexPayEmptyAccess } from "@/components/wexpay/WexPayAppCards";
import WexPayBusinessShell from "@/components/wexpay/WexPayBusinessShell";
import { getWexPayAccess } from "@/lib/wexpay-auth";
import { formatCoreStatus } from "@/lib/wexon-core-dashboard";
import { readActiveOrganizationId } from "@/lib/wexon-organization-context";

function buildBranchOptions(access: Extract<Awaited<ReturnType<typeof getWexPayAccess>>, { allowed: true }>) {
  return access.organization.restaurants.flatMap((restaurant) =>
    restaurant.branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ id: branch.id, name: branch.name, restaurantName: restaurant.name })),
  );
}

/**
 * WexPay access gate + demo-business operasyon layout.
 * Sidebar/dashboard shell kaldırıldı; tüm sayfalar geniş yatay panel kullanır.
 */
export default async function WexPayLayout({ children }: { children: ReactNode }) {
  const [access, activeOrganizationId] = await Promise.all([getWexPayAccess(), readActiveOrganizationId()]);

  if (!access.allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-4 py-10">
        <WexPayEmptyAccess organizationId={activeOrganizationId} />
      </main>
    );
  }

  const branches = buildBranchOptions(access);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8f7] text-sm font-semibold text-slate-500">
          WexPay paneli yükleniyor...
        </div>
      }
    >
      <WexPayBusinessShell
        organizationName={access.organization.name}
        organizationId={access.organization.id}
        isAdminPreview={access.mode === "admin_preview"}
        branches={branches}
        packageInfo={{
          planName: access.license.plan.name,
          licenseStatus: formatCoreStatus(access.license.status),
        }}
      >
        {children}
      </WexPayBusinessShell>
    </Suspense>
  );
}
