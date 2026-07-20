import {
  ActivationJourneySource,
  ActivationJourneyStatus,
  ActivationJourneyStepStatus,
  ActivationStepKey,
  type ActivationJourney,
  type ActivationJourneyStep,
  type Prisma,
  type PrismaClient,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { evaluateProductAccess, evaluateSubscriptionLifecycle } from "@/lib/wexon-core-access";

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

const ALLOWED_LICENSE_STATUSES = new Set(["ACTIVE", "TRIAL"]);

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

function mapAccessDenialToJourneyCode(reason: string | undefined): string {
  switch (reason) {
    case "organization_missing":
      return "ORG_NOT_FOUND";
    case "organization_inactive":
      return "ORG_INACTIVE";
    case "license_missing":
    case "license_inactive":
    case "license_suspended":
    case "license_cancelled":
    case "license_expired":
    case "license_not_started":
      return "LICENSE_INACTIVE";
    case "installation_missing":
    case "installation_inactive":
      return "INSTALL_INACTIVE";
    case "subscription_cancelled":
    case "subscription_expired":
    case "subscription_period_ended":
      return "LICENSE_INACTIVE";
    case "subscription_past_due":
      // Existing Core policy retains access on PAST_DUE — should not reach here as deny.
      return "LICENSE_INACTIVE";
    default:
      return "ACCESS_DENIED";
  }
}

async function assertSelfServeActorMembership(
  client: DbClient,
  organizationId: string,
  actorUserId: string,
): Promise<void> {
  const user = await client.user.findUnique({
    where: { id: actorUserId },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new ActivationJourneyError("ACTOR_INACTIVE", "Kullanıcı aktif değil.");
  }

  const membership = await client.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: actorUserId,
      },
    },
    select: { status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new ActivationJourneyError(
      "TENANT_FORBIDDEN",
      "Bu organizasyon için aktivasyon başlatma yetkiniz yok.",
    );
  }
}

/**
 * Transaction-boundary revalidation of org/product/license/subscription/install/fee.
 * Uses evaluateSubscriptionLifecycle — no new grace policy.
 */
async function assertJourneyStartPreconditionsInTx(
  tx: DbClient,
  organizationId: string,
  productId: string,
  at: Date,
): Promise<void> {
  const organization = await tx.organization.findUnique({
    where: { id: organizationId },
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

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true, status: true },
  });
  if (!product || !product.isActive || product.status !== "ACTIVE") {
    throw new ActivationJourneyError("PRODUCT_MISSING", "WexPay ürünü aktif değil.");
  }

  const license = await tx.license.findFirst({
    where: {
      organizationId,
      productId,
      status: { in: ["ACTIVE", "TRIAL"] },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      subscription: {
        select: { status: true, cancelAt: true, currentPeriodEnd: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!license || !ALLOWED_LICENSE_STATUSES.has(license.status)) {
    throw new ActivationJourneyError("LICENSE_INACTIVE", "Aktif WexPay lisansı gerekli.");
  }
  if (license.startsAt > at) {
    throw new ActivationJourneyError("LICENSE_INACTIVE", "Lisans henüz başlamadı.");
  }
  if (license.endsAt && license.endsAt < at) {
    throw new ActivationJourneyError("LICENSE_INACTIVE", "Lisans süresi dolmuş.");
  }

  const lifecycle = evaluateSubscriptionLifecycle(license.subscription ?? null, at);
  if (!lifecycle.ok) {
    throw new ActivationJourneyError(
      "LICENSE_INACTIVE",
      "Abonelik durumu aktivasyon başlatmaya uygun değil.",
    );
  }

  const installation = await tx.appInstallation.findUnique({
    where: {
      organizationId_productId: { organizationId, productId },
    },
    select: { status: true },
  });
  if (!installation || installation.status !== "ACTIVE") {
    throw new ActivationJourneyError("INSTALL_INACTIVE", "Aktif WexPay kurulumu gerekli.");
  }

  const fee = await tx.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: { organizationId, productId },
    },
    select: { status: true },
  });
  if (
    !fee ||
    !SETTLED_ACTIVATION_FEE_STATUSES.includes(fee.status as (typeof SETTLED_ACTIVATION_FEE_STATUSES)[number])
  ) {
    throw new ActivationJourneyError(
      "FEE_UNSETTLED",
      "Aktivasyon ücreti tamamlanmadan yolculuk başlatılamaz.",
    );
  }
}

/**
 * Self-serve journey start. Requires authenticated actor with ACTIVE membership.
 * Auth/membership/access always run before returning an existing journey.
 */
export async function startSelfServeActivationJourney(input: {
  organizationId: string;
  actorUserId: string;
}): Promise<ActivationJourneyWithSteps> {
  if (!input.actorUserId?.trim()) {
    throw new ActivationJourneyError("ACTOR_REQUIRED", "Oturum gerekli.");
  }

  const product = await prisma.product.findFirst({
    where: { key: WEXPAY_PRODUCT_KEY },
    select: { id: true },
  });
  if (!product) {
    throw new ActivationJourneyError("PRODUCT_MISSING", "WexPay ürünü bulunamadı.");
  }

  // 1–3: actor + membership before any journey disclosure.
  await assertSelfServeActorMembership(prisma, input.organizationId, input.actorUserId);

  // 4: Core product access (dates + subscription lifecycle).
  const access = await evaluateProductAccess({
    organizationId: input.organizationId,
    productKey: WEXPAY_PRODUCT_KEY,
  });
  if (!access.allowed) {
    throw new ActivationJourneyError(
      mapAccessDenialToJourneyCode(access.reason),
      "WexPay erişimi aktivasyon başlatmak için uygun değil.",
    );
  }

  // 5: Only after auth — idempotent return of existing journey.
  const existing = await getActivationJourneyForOrg(input.organizationId);
  if (existing) return existing;

  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertSelfServeActorMembership(tx, input.organizationId, input.actorUserId);

        const raced = await tx.activationJourney.findUnique({
          where: {
            organizationId_productId: {
              organizationId: input.organizationId,
              productId: product.id,
            },
          },
          include: { steps: { orderBy: { stepKey: "asc" } } },
        });
        if (raced) return raced;

        await assertJourneyStartPreconditionsInTx(tx, input.organizationId, product.id, new Date());

        const created = await tx.activationJourney.create({
          data: {
            organizationId: input.organizationId,
            productId: product.id,
            status: ActivationJourneyStatus.IN_PROGRESS,
            source: ActivationJourneySource.SELF_SERVE,
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

        await writeAuditLog(
          {
            action: "activation.journey.started",
            organizationId: input.organizationId,
            userId: input.actorUserId,
            entityType: "ActivationJourney",
            entityId: created.id,
            source: "activation_journey",
            message: "Akıllı Aktivasyon yolculuğu başlatıldı.",
            metadata: {
              source: ActivationJourneySource.SELF_SERVE,
              status: created.status,
            },
          },
          tx,
        );

        return created;
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      await assertSelfServeActorMembership(prisma, input.organizationId, input.actorUserId);
      const raced = await getActivationJourneyForOrg(input.organizationId);
      if (raced) return raced;
    }
    throw error;
  }
}

/**
 * @deprecated Prefer startSelfServeActivationJourney. Kept as thin alias for SELF_SERVE only.
 */
export async function ensureActivationJourneyStarted(input: {
  organizationId: string;
  actorUserId: string;
}): Promise<ActivationJourneyWithSteps> {
  return startSelfServeActivationJourney(input);
}

/**
 * Dashboard helper: never returns an existing journey without actor membership.
 * Unauthorized callers see derived NOT_STARTED (no journey disclosure).
 */
export async function loadOrStartActivationJourneyView(input: {
  organizationId: string;
  actorUserId?: string | null;
}): Promise<ActivationJourneyView> {
  if (!input.actorUserId) {
    return buildActivationJourneyView(null);
  }

  try {
    const started = await startSelfServeActivationJourney({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    });
    return buildActivationJourneyView(started);
  } catch (error) {
    if (error instanceof ActivationJourneyError) {
      return buildActivationJourneyView(null);
    }
    throw error;
  }
}

export type CompleteActivationStepInput = {
  journeyId: string;
  expectedVersion: number;
  stepKey: ActivationStepKey;
  safeMetadata?: Record<string, unknown>;
  advanceTo?: ActivationStepKey;
  markStatus?: ActivationJourneyStepStatus;
};

/**
 * Gate for domain mutations: version + currentStep + non-terminal step + priors.
 * Call at TX start BEFORE Organization/Restaurant/Branch/Table writes.
 * Completed/past steps must not mutate domain state (no fake idempotent replay).
 */
export async function assertWizardStepMutableInTx(
  tx: DbClient,
  input: {
    journeyId: string;
    expectedVersion: number;
    stepKey: ActivationStepKey;
  },
): Promise<ActivationJourneyWithSteps> {
  const journey = await tx.activationJourney.findUnique({
    where: { id: input.journeyId },
    include: { steps: { orderBy: { stepKey: "asc" } } },
  });
  if (!journey) {
    throw new ActivationJourneyError("NOT_STARTED", "Akıllı Aktivasyon henüz başlamadı.");
  }
  if (journey.version !== input.expectedVersion) {
    throw new ActivationJourneyError(
      "VERSION_CONFLICT",
      "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
    );
  }
  if (journey.currentStep !== input.stepKey) {
    throw new ActivationJourneyError(
      "OUT_OF_ORDER",
      "Bu adım şu an aktif değil. Lütfen sıradaki adımdan devam edin.",
    );
  }

  const existingStep = journey.steps.find((s) => s.stepKey === input.stepKey);
  if (!existingStep) {
    throw new ActivationJourneyError("STEP_MISSING", "Kurulum adımı bulunamadı.");
  }
  if (
    existingStep.status === ActivationJourneyStepStatus.COMPLETED ||
    existingStep.status === ActivationJourneyStepStatus.SKIPPED
  ) {
    throw new ActivationJourneyError(
      "OUT_OF_ORDER",
      "Bu kurulum adımı zaten tamamlandı; tekrar değiştirilemez.",
    );
  }

  const stepIndex = ACTIVATION_STEP_ORDER.indexOf(input.stepKey);
  for (let i = 0; i < stepIndex; i++) {
    const priorKey = ACTIVATION_STEP_ORDER[i]!;
    const prior = journey.steps.find((s) => s.stepKey === priorKey);
    if (
      !prior ||
      (prior.status !== ActivationJourneyStepStatus.COMPLETED &&
        prior.status !== ActivationJourneyStepStatus.SKIPPED)
    ) {
      throw new ActivationJourneyError(
        "PRIOR_INCOMPLETE",
        "Önceki kurulum adımları tamamlanmadan ilerlenemez.",
      );
    }
  }

  return journey;
}

/**
 * Optimistic concurrency: bumps journey.version only when expectedVersion matches.
 * Marks step COMPLETED (or SKIPPED) and optionally advances currentStep.
 * Server-authoritative: only journey.currentStep may complete; prior PR-2 steps must be done.
 * Past/completed step replay (currentStep already advanced) → OUT_OF_ORDER, not silent success.
 */
export async function completeActivationStepInTx(
  tx: DbClient,
  input: CompleteActivationStepInput,
): Promise<ActivationJourneyWithSteps> {
  const markStatus = input.markStatus ?? ActivationJourneyStepStatus.COMPLETED;
  const now = new Date();

  const journeyBefore = await tx.activationJourney.findUnique({
    where: { id: input.journeyId },
    include: { steps: true },
  });
  if (!journeyBefore) {
    throw new ActivationJourneyError("NOT_STARTED", "Akıllı Aktivasyon henüz başlamadı.");
  }
  if (journeyBefore.version !== input.expectedVersion) {
    throw new ActivationJourneyError(
      "VERSION_CONFLICT",
      "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
    );
  }

  const existingStep = journeyBefore.steps.find((s) => s.stepKey === input.stepKey);
  if (!existingStep) {
    throw new ActivationJourneyError("STEP_MISSING", "Kurulum adımı bulunamadı.");
  }

  // Past-step replay: step may be terminal but journey already moved on.
  if (journeyBefore.currentStep !== input.stepKey) {
    throw new ActivationJourneyError(
      "OUT_OF_ORDER",
      "Bu adım şu an aktif değil. Lütfen sıradaki adımdan devam edin.",
    );
  }

  // Prior required PR-2 steps must be COMPLETED|SKIPPED.
  const stepIndex = ACTIVATION_STEP_ORDER.indexOf(input.stepKey);
  for (let i = 0; i < stepIndex; i++) {
    const priorKey = ACTIVATION_STEP_ORDER[i]!;
    const prior = journeyBefore.steps.find((s) => s.stepKey === priorKey);
    if (
      !prior ||
      (prior.status !== ActivationJourneyStepStatus.COMPLETED &&
        prior.status !== ActivationJourneyStepStatus.SKIPPED)
    ) {
      throw new ActivationJourneyError(
        "PRIOR_INCOMPLETE",
        "Önceki kurulum adımları tamamlanmadan ilerlenemez.",
      );
    }
  }

  // Idempotent only while still on this currentStep (e.g. concurrent double-complete).
  if (
    existingStep.status === ActivationJourneyStepStatus.COMPLETED ||
    existingStep.status === ActivationJourneyStepStatus.SKIPPED
  ) {
    if (input.advanceTo && journeyBefore.currentStep === input.stepKey) {
      const bumpedIdempotent = await tx.activationJourney.updateMany({
        where: { id: input.journeyId, version: input.expectedVersion },
        data: { version: { increment: 1 }, currentStep: input.advanceTo, updatedAt: now },
      });
      if (bumpedIdempotent.count !== 1) {
        throw new ActivationJourneyError(
          "VERSION_CONFLICT",
          "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
        );
      }
    }
    return tx.activationJourney.findUniqueOrThrow({
      where: { id: input.journeyId },
      include: { steps: { orderBy: { stepKey: "asc" } } },
    });
  }

  const bumped = await tx.activationJourney.updateMany({
    where: {
      id: input.journeyId,
      version: input.expectedVersion,
      status: { in: [ActivationJourneyStatus.IN_PROGRESS, ActivationJourneyStatus.BLOCKED] },
    },
    data: {
      version: { increment: 1 },
      ...(input.advanceTo ? { currentStep: input.advanceTo } : {}),
      updatedAt: now,
    },
  });
  if (bumped.count !== 1) {
    throw new ActivationJourneyError(
      "VERSION_CONFLICT",
      "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
    );
  }

  await tx.activationJourneyStep.update({
    where: { id: existingStep.id },
    data: {
      status: markStatus,
      completedAt: now,
      attemptCount: { increment: 1 },
      lastErrorCode: null,
      ...(input.safeMetadata
        ? { safeMetadataJson: input.safeMetadata as Prisma.InputJsonValue }
        : {}),
    },
  });

  return tx.activationJourney.findUniqueOrThrow({
    where: { id: input.journeyId },
    include: { steps: { orderBy: { stepKey: "asc" } } },
  });
}

export async function assertJourneyWritableForActor(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
}): Promise<ActivationJourneyWithSteps> {
  await assertSelfServeActorMembership(prisma, input.organizationId, input.actorUserId);
  const journey = await getActivationJourneyForOrg(input.organizationId);
  if (!journey) {
    throw new ActivationJourneyError("NOT_STARTED", "Akıllı Aktivasyon henüz başlamadı.");
  }
  if (journey.source === ActivationJourneySource.LEGACY_BACKFILL && journey.status === ActivationJourneyStatus.ACTIVE) {
    throw new ActivationJourneyError("LEGACY_ACTIVE", "Canlı kullanımda sihirbaz yeniden açılmaz.");
  }
  if (journey.status === ActivationJourneyStatus.ACTIVE) {
    throw new ActivationJourneyError("ALREADY_ACTIVE", "Kurulum tamamlandı; sihirbaz kapalı.");
  }
  if (journey.status === ActivationJourneyStatus.CANCELLED) {
    throw new ActivationJourneyError("CANCELLED", "Kurulum iptal edilmiş.");
  }
  if (journey.version !== input.expectedVersion) {
    throw new ActivationJourneyError(
      "VERSION_CONFLICT",
      "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
    );
  }
  return journey;
}

export function computeWizardProgress(journey: ActivationJourneyWithSteps | null): {
  completed: number;
  total: number;
  percent: number;
  activeStep: ActivationStepKey | null;
} {
  if (!journey) {
    return { completed: 0, total: ACTIVATION_STEP_ORDER.length, percent: 0, activeStep: null };
  }
  const completed = journey.steps.filter(
    (s) =>
      s.status === ActivationJourneyStepStatus.COMPLETED ||
      s.status === ActivationJourneyStepStatus.SKIPPED,
  ).length;
  const total = ACTIVATION_STEP_ORDER.length;
  const percent = Math.round((completed / total) * 100);
  return {
    completed,
    total,
    percent,
    activeStep: journey.currentStep,
  };
}

/** PR-3 wizard steps that are interactive. Later steps are upcoming/disabled. */
export const PR3_WIZARD_STEPS: ActivationStepKey[] = [
  ActivationStepKey.BUSINESS_PROFILE,
  ActivationStepKey.BRANCH_SETUP,
  ActivationStepKey.TABLE_SETUP,
  ActivationStepKey.STAFF_INVITE,
  ActivationStepKey.MENU_IMPORT,
];

/** @deprecated Use PR3_WIZARD_STEPS — kept for older call sites. */
export const PR2_WIZARD_STEPS: ActivationStepKey[] = PR3_WIZARD_STEPS.slice(0, 4);

export function isPr2WizardStep(step: ActivationStepKey): boolean {
  return PR2_WIZARD_STEPS.includes(step);
}

export function isPr3WizardStep(step: ActivationStepKey): boolean {
  return PR3_WIZARD_STEPS.includes(step);
}

export function maskTaxNoForAudit(taxNo: string | null | undefined): string | null {
  if (!taxNo) return null;
  const digits = taxNo.replace(/\s+/g, "");
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

export { ActivationJourneyStepStatus };
