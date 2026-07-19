import { ActivationWizardClient } from "@/components/wexpay/ActivationWizardClient";
import { SetupModeBanner } from "@/components/wexpay/SetupModeBanner";
import { DashboardEmptyState, DashboardSectionTitle } from "@/components/marketing/WexonDashboardCards";
import { dashboardHref, getCustomerDashboardData } from "@/lib/wexon-core-dashboard";
import { loadOrStartActivationJourneyView } from "@/lib/wexpay-activation-journey";
import { listOrganizationStaffInvites } from "@/lib/wexpay-staff-invite";
import { getCustomerSession } from "@/lib/wexon-customer-auth";
import { prisma } from "@/lib/prisma";
import { ActivationStepKey } from ".prisma/client";

type SearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

export default async function ActivationWizardPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { organization, organizationContext, wexPayAccess } = await getCustomerDashboardData(params);

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bulunamadı"
        description="Akıllı Aktivasyon için organizasyon seçimi gerekli."
      />
    );
  }

  if (!wexPayAccess?.allowed) {
    return (
      <DashboardEmptyState
        title="WexPay erişimi yok"
        description="Kurulum sihirbazı için aktif WexPay lisansı gerekir."
      />
    );
  }

  const session = await getCustomerSession();
  const view = await loadOrStartActivationJourneyView({
    organizationId: organization.id,
    actorUserId: session?.userId ?? null,
  });

  const restaurants = await prisma.restaurant.findMany({
    where: { organizationId: organization.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const branches = await prisma.branch.findMany({
    where: { restaurant: { organizationId: organization.id }, isActive: true },
    select: { id: true, name: true, restaurantId: true, address: true },
    orderBy: { createdAt: "asc" },
  });

  const stepMeta = view.journey?.steps.find((s) => s.stepKey === ActivationStepKey.BRANCH_SETUP);
  const meta =
    stepMeta?.safeMetadataJson && typeof stepMeta.safeMetadataJson === "object"
      ? (stepMeta.safeMetadataJson as { restaurantId?: string; branchId?: string })
      : {};

  const invites = await listOrganizationStaffInvites(organization.id);
  const continueHref = dashboardHref("/dashboard/wexpay/activation", organizationContext);

  const stepStatuses = Object.fromEntries(
    (view.journey?.steps ?? []).map((s) => [s.stepKey, s.status]),
  ) as Record<ActivationStepKey, string>;

  const isLegacyActive =
    view.journey?.status === "ACTIVE" && view.journey.source === "LEGACY_BACKFILL";

  return (
    <div className="space-y-6">
      <DashboardSectionTitle badge="WexPay" title="Akıllı Aktivasyon" description="Kurulum Modu sihirbazı" />
      <SetupModeBanner view={view} continueHref={continueHref} />
      <ActivationWizardClient
        organizationId={organization.id}
        organization={{
          name: organization.name,
          legalName: organization.legalName,
          taxNo: organization.taxNo,
          phone: organization.phone,
          email: organization.email,
          country: organization.country,
        }}
        journeyVersion={view.journey?.version ?? 1}
        currentStep={(view.journey?.currentStep ?? "BUSINESS_PROFILE") as ActivationStepKey}
        stepStatuses={stepStatuses}
        branchId={meta.branchId ?? branches[0]?.id ?? null}
        restaurantId={meta.restaurantId ?? restaurants[0]?.id ?? null}
        restaurants={restaurants}
        branches={branches}
        invites={invites.map((i) => ({
          ...i,
          expiresAt: i.expiresAt.toISOString(),
          acceptedAt: i.acceptedAt?.toISOString() ?? null,
          revokedAt: i.revokedAt?.toISOString() ?? null,
        }))}
        isLegacyActive={Boolean(isLegacyActive) || view.uiStatus === "ACTIVE"}
      />
    </div>
  );
}
