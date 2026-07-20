import type { ReactNode } from "react";
import { Suspense } from "react";
import { WexPayEmptyAccess } from "@/components/wexpay/WexPayBusinessUI";
import WexPayBusinessShell from "@/components/wexpay/WexPayBusinessShell";
import WexPayKeyboardShortcuts from "@/components/wexpay/WexPayKeyboardShortcuts";
import { writeAuditFailure } from "@/lib/wexon-audit";
import { getWexPayAccess } from "@/lib/wexpay-auth";
import { formatCoreStatus } from "@/lib/wexon-core-dashboard";
import { resolvePlatformOrganizationSelector } from "@/lib/wexon-organization-context";
import { getActivationJourneyViewForOrg } from "@/lib/wexpay-activation-journey";

function buildBranchOptions(access: Extract<Awaited<ReturnType<typeof getWexPayAccess>>, { allowed: true }>) {
  return access.organization.restaurants.flatMap((restaurant) =>
    restaurant.branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ id: branch.id, name: branch.name, restaurantName: restaurant.name })),
  );
}

/**
 * WexPay access gate + sticky sidebar workspace shell.
 * License+Install ACTIVE → panel open (Kurulum Modu if journey ≠ ACTIVE).
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
  const activationView = await getActivationJourneyViewForOrg(access.organization.id);

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
        {activationView.setupMode ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800/80">Akıllı Aktivasyon</p>
            <p className="mt-1 text-sm font-black">Kurulum Modu</p>
            <p className="mt-1 text-sm font-semibold text-amber-900/80">
              Çalışma alanı kurulum için açık. Canlı QR bağlantıları Canlıya Geçiş sonrası açılır.
            </p>
            <a
              href={`/dashboard/wexpay/activation?organizationId=${encodeURIComponent(access.organization.id)}`}
              className="mt-2 inline-flex text-sm font-bold text-amber-900 underline"
            >
              Kuruluma devam et
            </a>
          </div>
        ) : null}
        <Suspense fallback={null}>
          <WexPayKeyboardShortcuts />
        </Suspense>
        {children}
      </WexPayBusinessShell>
    </Suspense>
  );
}
