import {
  ActivationJourneySource,
  ActivationJourneyStatus,
  ActivationStepKey,
  type ActivationJourney,
  type ActivationJourneyStep,
  type Prisma,
  type PrismaClient,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";

export const WEXPAY_PRODUCT_KEY = "wexpay";

export const ACTIVATION_STEP_ORDER: ActivationStepKey[] = [
  ActivationStepKey.BUSINESS_PROFILE,
  ActivationStepKey.BRANCH_SETUP,
  ActivationStepKey.TABLE_SETUP,
  ActivationStepKey.STAFF_INVITE,
  ActivationStepKey.MENU_IMPORT,
  ActivationStepKey.PAYMENT_PROVIDER,
  ActivationStepKey.VALIDATION,
  ActivationStepKey.GO_LIVE,
];

/** Derived UI status when no ActivationJourney row exists. Never persisted. */
export const ACTIVATION_UI_NOT_STARTED = "NOT_STARTED" as const;

export type ActivationUiStatus = ActivationJourneyStatus | typeof ACTIVATION_UI_NOT_STARTED;

export const SETTLED_ACTIVATION_FEE_STATUSES = ["PAID", "WAIVED", "WAIVED_LEGACY"] as const;

export class ActivationJourneyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ActivationJourneyError";
    this.code = code;
  }
}

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ActivationJourneyWithSteps = ActivationJourney & {
  steps: ActivationJourneyStep[];
};

export type ActivationJourneyView = {
  uiStatus: ActivationUiStatus;
  setupMode: boolean;
  publicLive: boolean;
  journey: ActivationJourneyWithSteps | null;
  /** Human-readable labels for read-only UI */
  statusLabel: string;
  sourceLabel: string | null;
  currentStepLabel: string | null;
};

function stepLabel(step: ActivationStepKey): string {
  const labels: Record<ActivationStepKey, string> = {
    BUSINESS_PROFILE: "İşletme profili",
    BRANCH_SETUP: "Şube kurulumu",
    TABLE_SETUP: "Masa kurulumu",
    STAFF_INVITE: "Personel daveti",
    MENU_IMPORT: "Menü aktarımı",
    PAYMENT_PROVIDER: "Ödeme sağlayıcısı",
    VALIDATION: "Doğrulama",
    GO_LIVE: "Canlıya Geçiş",
  };
  return labels[step];
}

function statusLabel(status: ActivationUiStatus): string {
  switch (status) {
    case ACTIVATION_UI_NOT_STARTED:
      return "Başlamadı";
    case "IN_PROGRESS":
      return "Devam ediyor";
    case "BLOCKED":
      return "Engellendi";
    case "READY":
      return "Canlıya Geçişe hazır";
    case "ACTIVE":
      return "Canlı Kullanım";
    case "CANCELLED":
      return "İptal edildi";
    default:
      return status;
  }
}

function sourceLabel(source: ActivationJourneySource): string {
  switch (source) {
    case "SELF_SERVE":
      return "Self-serve";
    case "ADMIN_ASSISTED":
      return "Admin destekli";
    case "LEGACY_BACKFILL":
      return "Kurucu İşletmeler Programı";
    default:
      return source;
  }
}

export function buildActivationJourneyView(
  journey: ActivationJourneyWithSteps | null,
): ActivationJourneyView {
  if (!journey) {
    return {
      uiStatus: ACTIVATION_UI_NOT_STARTED,
      setupMode: true,
      publicLive: false,
      journey: null,
      statusLabel: statusLabel(ACTIVATION_UI_NOT_STARTED),
      sourceLabel: null,
      currentStepLabel: null,
    };
  }
  const publicLive = journey.status === ActivationJourneyStatus.ACTIVE;
  return {
    uiStatus: journey.status,
    setupMode: !publicLive,
    publicLive,
    journey,
    statusLabel: statusLabel(journey.status),
    sourceLabel: sourceLabel(journey.source),
    currentStepLabel: stepLabel(journey.currentStep),
  };
}

/**
 * Central public-live gate. Public QR/menu/order/payment must call this
 * (via resolvePublicTableByQr / opaque token resolve) — never copy per-route.
 */
export async function assertWexPayPublicLiveReady(
  organizationId: string,
  client: DbClient = prisma,
): Promise<boolean> {
  const product = await client.product.findFirst({
    where: { key: WEXPAY_PRODUCT_KEY },
    select: { id: true },
  });
  if (!product) return false;

  const journey = await client.activationJourney.findUnique({
    where: {
      organizationId_productId: {
        organizationId,
        productId: product.id,
      },
    },
    select: { status: true },
  });

  return journey?.status === ActivationJourneyStatus.ACTIVE;
}

export async function getActivationJourneyForOrg(
  organizationId: string,
  client: DbClient = prisma,
): Promise<ActivationJourneyWithSteps | null> {
  const product = await client.product.findFirst({
    where: { key: WEXPAY_PRODUCT_KEY },
    select: { id: true },
  });
  if (!product) return null;

  return client.activationJourney.findUnique({
    where: {
      organizationId_productId: {
        organizationId,
        productId: product.id,
      },
    },
    include: { steps: { orderBy: { stepKey: "asc" } } },
  });
}

export async function getActivationJourneyViewForOrg(
  organizationId: string,
  client: DbClient = prisma,
): Promise<ActivationJourneyView> {
  const journey = await getActivationJourneyForOrg(organizationId, client);
  return buildActivationJourneyView(journey);
}

type LazyStartInput = {
  organizationId: string;
  source?: ActivationJourneySource;
  actorUserId?: string | null;
};

/**
 * Idempotent lazy journey start. Never called from PayTR callback.
 * Fail-closed for demo / inactive org / missing license+install / unsettled fee.
 */
export async function ensureActivationJourneyStarted(
  input: LazyStartInput,
  client: DbClient = prisma,
): Promise<ActivationJourneyWithSteps> {
  const source = input.source ?? ActivationJourneySource.SELF_SERVE;

  const product = await client.product.findFirst({
    where: { key: WEXPAY_PRODUCT_KEY },
    select: { id: true },
  });
  if (!product) {
    throw new ActivationJourneyError("PRODUCT_MISSING", "WexPay ürünü bulunamadı.");
  }

  const existing = await client.activationJourney.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: product.id,
      },
    },
    include: { steps: { orderBy: { stepKey: "asc" } } },
  });
  if (existing) return existing;

  const organization = await client.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, isActive: true, isDemo: true },
  });
  if (!organization) {
    throw new ActivationJourneyError("ORG_NOT_FOUND", "Organizasyon bulunamadı.");
  }
  if (!organization.isActive) {
    throw new ActivationJourneyError("ORG_INACTIVE", "Organizasyon aktif değil.");
  }
  if (organization.isDemo) {
    throw new ActivationJourneyError("DEMO_FORBIDDEN", "Demo organizasyonlarda aktivasyon başlatılamaz.");
  }

  const license = await client.license.findFirst({
    where: {
      organizationId: input.organizationId,
      productId: product.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!license) {
    throw new ActivationJourneyError("LICENSE_INACTIVE", "Aktif WexPay lisansı gerekli.");
  }

  const installation = await client.appInstallation.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: product.id,
      },
    },
    select: { status: true },
  });
  if (!installation || installation.status !== "ACTIVE") {
    throw new ActivationJourneyError("INSTALL_INACTIVE", "Aktif WexPay kurulumu gerekli.");
  }

  const fee = await client.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: product.id,
      },
    },
    select: { status: true },
  });
  if (!fee || !SETTLED_ACTIVATION_FEE_STATUSES.includes(fee.status as (typeof SETTLED_ACTIVATION_FEE_STATUSES)[number])) {
    throw new ActivationJourneyError("FEE_UNSETTLED", "Aktivasyon ücreti tamamlanmadan yolculuk başlatılamaz.");
  }

  try {
    const created = await client.activationJourney.create({
      data: {
        organizationId: input.organizationId,
        productId: product.id,
        status: ActivationJourneyStatus.IN_PROGRESS,
        source,
        currentStep: ActivationStepKey.BUSINESS_PROFILE,
        version: 1,
        steps: {
          create: ACTIVATION_STEP_ORDER.map((stepKey) => ({
            stepKey,
            status: "PENDING",
            attemptCount: 0,
          })),
        },
      },
      include: { steps: { orderBy: { stepKey: "asc" } } },
    });

    await writeAuditLog({
      action: "activation.journey.started",
      organizationId: input.organizationId,
      userId: input.actorUserId ?? null,
      entityType: "ActivationJourney",
      entityId: created.id,
      source: "activation_journey",
      message: "Akıllı Aktivasyon yolculuğu başlatıldı.",
      metadata: {
        source,
        status: created.status,
        // never include secrets
      },
    });

    return created;
  } catch (error) {
    // Concurrent start: unique conflict → return the winner row.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const raced = await client.activationJourney.findUnique({
        where: {
          organizationId_productId: {
            organizationId: input.organizationId,
            productId: product.id,
          },
        },
        include: { steps: { orderBy: { stepKey: "asc" } } },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

/**
 * Dashboard helper: try lazy start when eligible; otherwise return derived view.
 * Never throws for fee/demo gates — returns NOT_STARTED / existing view.
 */
export async function loadOrStartActivationJourneyView(input: {
  organizationId: string;
  actorUserId?: string | null;
  source?: ActivationJourneySource;
}): Promise<ActivationJourneyView> {
  const existing = await getActivationJourneyForOrg(input.organizationId);
  if (existing) return buildActivationJourneyView(existing);

  try {
    const started = await ensureActivationJourneyStarted({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      source: input.source,
    });
    return buildActivationJourneyView(started);
  } catch (error) {
    if (error instanceof ActivationJourneyError) {
      return buildActivationJourneyView(null);
    }
    throw error;
  }
}
