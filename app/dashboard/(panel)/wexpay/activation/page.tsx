import { ActivationWizardClient } from "@/components/wexpay/ActivationWizardClient";
import { SetupModeBanner } from "@/components/wexpay/SetupModeBanner";
import { DashboardEmptyState, DashboardSectionTitle } from "@/components/marketing/WexonDashboardCards";
import { dashboardHref, getCustomerDashboardData } from "@/lib/wexon-core-dashboard";
import { loadOrStartActivationJourneyView } from "@/lib/wexpay-activation-journey";
import { listOrganizationStaffInvites } from "@/lib/wexpay-staff-invite";
import { getActiveMenuImportJobView } from "@/lib/wexpay-menu-import";
import { getCustomerSession } from "@/lib/wexon-customer-auth";
import { prisma } from "@/lib/prisma";
import { ActivationStepKey, type MembershipRole } from ".prisma/client";
import type { ActivationPaymentProviderSafeMetadata } from "@/lib/wexpay-activation-payment-provider";
import type { ActivationValidationSafeMetadata } from "@/lib/wexpay-activation-validation";

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

  const tableStep = view.journey?.steps.find((s) => s.stepKey === ActivationStepKey.TABLE_SETUP);
  const tableMeta =
    tableStep?.safeMetadataJson && typeof tableStep.safeMetadataJson === "object"
      ? (tableStep.safeMetadataJson as { awaitingQrAck?: boolean; branchId?: string })
      : {};

  const providerStep = view.journey?.steps.find(
    (s) => s.stepKey === ActivationStepKey.PAYMENT_PROVIDER,
  );
  const providerRaw =
    providerStep?.safeMetadataJson && typeof providerStep.safeMetadataJson === "object"
      ? (providerStep.safeMetadataJson as Record<string, unknown>)
      : {};
  const selectedProvider: ActivationPaymentProviderSafeMetadata | null =
    providerRaw.provider === "MANUAL" &&
    providerRaw.acknowledged === true &&
    providerRaw.onlinePaymentReady === false
      ? { provider: "MANUAL", acknowledged: true, onlinePaymentReady: false }
      : providerRaw.provider === "PAYTR" &&
          typeof providerRaw.credentialId === "string" &&
          (providerRaw.mode === "TEST" || providerRaw.mode === "LIVE") &&
          typeof providerRaw.keyFingerprint === "string" &&
          typeof providerRaw.configCheckedAt === "string" &&
          typeof providerRaw.onlinePaymentApiEnabled === "boolean"
        ? {
            provider: "PAYTR",
            credentialId: providerRaw.credentialId,
            mode: providerRaw.mode,
            keyFingerprint: providerRaw.keyFingerprint,
            configCheckedAt: providerRaw.configCheckedAt,
            onlinePaymentApiEnabled: providerRaw.onlinePaymentApiEnabled,
          }
        : null;

  const validationStep = view.journey?.steps.find(
    (s) => s.stepKey === ActivationStepKey.VALIDATION,
  );
  const validationRaw =
    validationStep?.safeMetadataJson && typeof validationStep.safeMetadataJson === "object"
      ? (validationStep.safeMetadataJson as Record<string, unknown>)
      : {};
  const latestValidationSummary: ActivationValidationSafeMetadata | null =
    (validationRaw.result === "PASS" ||
      validationRaw.result === "WARNING" ||
      validationRaw.result === "FAIL") &&
    typeof validationRaw.passCount === "number" &&
    typeof validationRaw.warningCount === "number" &&
    typeof validationRaw.failCount === "number" &&
    Array.isArray(validationRaw.checks)
      ? {
          result: validationRaw.result,
          passCount: validationRaw.passCount,
          warningCount: validationRaw.warningCount,
          failCount: validationRaw.failCount,
          checks: validationRaw.checks.flatMap((check) => {
            if (!check || typeof check !== "object") return [];
            const row = check as Record<string, unknown>;
            if (
              typeof row.key !== "string" ||
              (row.status !== "PASS" && row.status !== "WARNING" && row.status !== "FAIL")
            ) {
              return [];
            }
            return [{ key: row.key, status: row.status }];
          }),
        }
      : null;

  const actorRole: MembershipRole | null = session
    ? (
        await prisma.membership.findFirst({
          where: {
            organizationId: organization.id,
            userId: session.userId,
            status: "ACTIVE",
          },
          select: { role: true },
        })
      )?.role ?? null
    : null;

  // Explicit owner-only continue is always offered; server enforces OWNER_ONLY skip rules.
  const canSkipStaffInvite = true;

  const invites = await listOrganizationStaffInvites(organization.id);
  const menuImportJob = view.journey
    ? await getActiveMenuImportJobView({
        organizationId: organization.id,
        journeyId: view.journey.id,
      })
    : null;
  const continueHref = dashboardHref("/dashboard/wexpay/activation", organizationContext);

  const stepStatuses = Object.fromEntries(
    (view.journey?.steps ?? []).map((s) => [s.stepKey, s.status]),
  ) as Record<ActivationStepKey, string>;

  const isLegacyActive =
    view.journey?.status === "ACTIVE" && view.journey.source === "LEGACY_BACKFILL";
  const publicOrigin = (
    process.env.NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  // Prefer IDs stored in journey step metadata — never invent "first restaurant/branch".
  const restaurantId = typeof meta.restaurantId === "string" ? meta.restaurantId : null;
  const branchId =
    (typeof meta.branchId === "string" ? meta.branchId : null) ??
    (typeof tableMeta.branchId === "string" ? tableMeta.branchId : null);

  return (
    <div className="space-y-6">
      <DashboardSectionTitle badge="WexPay" title="Akıllı Aktivasyon" description="Kurulum Modu sihirbazı" />
      <SetupModeBanner view={view} continueHref={continueHref} />
      <ActivationWizardClient
        organizationId={organization.id}
        organization={{
          name: organization.name,
          slug: organization.slug,
          legalName: organization.legalName,
          taxNo: organization.taxNo,
          phone: organization.phone,
          email: organization.email,
          country: organization.country,
        }}
        journeyVersion={view.journey?.version ?? 1}
        currentStep={(view.journey?.currentStep ?? "BUSINESS_PROFILE") as ActivationStepKey}
        stepStatuses={stepStatuses}
        branchId={branchId}
        restaurantId={restaurantId}
        restaurants={restaurants}
        branches={branches}
        invites={invites.map((i) => ({
          ...i,
          expiresAt: i.expiresAt.toISOString(),
          acceptedAt: i.acceptedAt?.toISOString() ?? null,
          revokedAt: i.revokedAt?.toISOString() ?? null,
        }))}
        isLegacyActive={Boolean(isLegacyActive) || view.uiStatus === "ACTIVE"}
        awaitingQrAck={Boolean(tableMeta.awaitingQrAck)}
        canSkipStaffInvite={canSkipStaffInvite}
        menuImportJob={menuImportJob}
        publicOrigin={publicOrigin}
        actorRole={actorRole}
        journeyStatus={view.journey?.status ?? "IN_PROGRESS"}
        blockedReasonCode={view.journey?.blockedReasonCode ?? null}
        selectedProvider={selectedProvider}
        latestValidationSummary={latestValidationSummary}
        paytrApiEnabled={process.env.WEXPAY_PAYTR_ENABLE_API === "true"}
        isProductionEnvironment={process.env.VERCEL_ENV === "production"}
      />
    </div>
  );
}
