import type { ReactNode } from "react";
import { Suspense } from "react";
import { WexPayEmptyAccess } from "@/components/wexpay/WexPayBusinessUI";
import WexPayBusinessShell from "@/components/wexpay/WexPayBusinessShell";
import WexPayKeyboardShortcuts from "@/components/wexpay/WexPayKeyboardShortcuts";
import { writeAuditFailure } from "@/lib/wexon-audit";
import { getWexPayAccess } from "@/lib/wexpay-auth";
import { formatCoreStatus } from "@/lib/wexon-core-dashboard";
import { resolvePlatformOrganizationSelector } from "@/lib/wexon-organization-context";

function buildBranchOptions(access: Extract<Awaited<ReturnType<typeof getWexPayAccess>>, { allowed: true }>) {
  return access.organization.restaurants.flatMap((restaurant) =>
    restaurant.branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ id: branch.id, name: branch.name, restaurantName: restaurant.name })),
  );
}

/**
 * WexPay access gate + sticky sidebar workspace shell.
 */
export default async function WexPayLayout({ children }: { children: ReactNode }) {
  const selector = await resolvePlatformOrganizationSelector();
  const access = await getWexPayAccess(selector);

  if (!access.allowed) {
    await writeAuditFailure({
      action: "wexpay.access.denied",
      message: "WexPay layout erişimi reddedildi.",
      level: "WARN",
      organizationId: selector?.organizationId ?? access.organization?.id ?? null,
      source: "wexpay_app",
      metadata: { reason: access.reason, mode: access.mode },
    });

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-4 py-10">
        <WexPayEmptyAccess organizationId={selector?.organizationId ?? null} reason={access.reason} />
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
        <Suspense fallback={null}>
          <WexPayKeyboardShortcuts />
        </Suspense>
        {children}
      </WexPayBusinessShell>
    </Suspense>
  );
}
