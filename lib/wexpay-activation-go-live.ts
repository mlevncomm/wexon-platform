import {
  ActivationJourneySource,
  ActivationJourneyStatus,
  ActivationJourneyStepStatus,
  ActivationStepKey,
  MembershipRole,
  type Prisma,
  type PrismaClient,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { ActivationJourneyError } from "@/lib/wexpay-activation-journey";
import { assertActorManageMembershipInTx } from "@/lib/wexpay-activation-tx-access";
import { lockWexPayActivationJourneyForUpdate } from "@/lib/wexpay-locks";
import {
  buildActivationValidationSafeMetadata,
  validateWexPayActivationInTx,
  type ActivationValidationReport,
} from "@/lib/wexpay-activation-validation";

type GoLiveDbClient = PrismaClient | Prisma.TransactionClient;

export type GoLiveConfirmationMatch = "NAME" | "SLUG";

export type GoLiveActor =
  | { kind: "CUSTOMER"; userId: string }
  | {
      kind: "ADMIN";
      email: string;
      reasonCode: string;
      noteLength: number;
    };

export function isGoLiveIdempotentReplayVersion(
  journeyVersion: number,
  expectedVersion: number,
) {
  return journeyVersion === expectedVersion + 1;
}

function assertGoLiveIdempotentReplayVersion(
  journeyVersion: number,
  expectedVersion: number,
) {
  if (!isGoLiveIdempotentReplayVersion(journeyVersion, expectedVersion)) {
    throw new ActivationJourneyError(
      "VERSION_CONFLICT",
      "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
    );
  }
}

export function validateGoLiveConfirmation(input: {
  confirmed: boolean;
  confirmationText: string;
  organizationName: string;
  organizationSlug: string;
}): GoLiveConfirmationMatch {
  if (!input.confirmed) {
    throw new ActivationJourneyError(
      "CONFIRM_REQUIRED",
      "Yayına alma onay kutusu işaretlenmelidir.",
    );
  }
  const confirmation = input.confirmationText.trim();
  if (confirmation === input.organizationName) return "NAME";
  if (confirmation === input.organizationSlug) return "SLUG";
  throw new ActivationJourneyError(
    "CONFIRM_MISMATCH",
    "Organizasyon adı veya slug değeri tam olarak eşleşmelidir.",
  );
}

function safeActorMetadata(actor: GoLiveActor) {
  return actor.kind === "CUSTOMER"
    ? { actorType: "customer_user" }
    : {
        actorType: "admin_session",
        actorEmail: actor.email.trim().toLowerCase(),
        reasonCode: actor.reasonCode,
        noteLength: actor.noteLength,
      };
}

async function loadJourneyResult(tx: GoLiveDbClient, journeyId: string) {
  return tx.activationJourney.findUniqueOrThrow({
    where: { id: journeyId },
    include: { steps: { orderBy: { stepKey: "asc" } } },
  });
}

/**
 * Central go-live transaction body used by both customer and admin-assisted
 * entry points. Admin assistance changes actor/source only; readiness checks
 * and state transitions are identical.
 */
export async function goLiveWexPayActivationInTx(
  tx: GoLiveDbClient,
  input: {
    organizationId: string;
    expectedVersion: number;
    confirmed: boolean;
    confirmationText: string;
    actor: GoLiveActor;
    env?: NodeJS.ProcessEnv;
  },
): Promise<{
  activated: boolean;
  idempotent: boolean;
  report: ActivationValidationReport | null;
  journey: Awaited<ReturnType<typeof loadJourneyResult>>;
}> {
  if (input.actor.kind === "CUSTOMER") {
    await assertActorManageMembershipInTx(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actor.userId,
      roles: [MembershipRole.OWNER, MembershipRole.ADMIN],
    });
  } else {
    if (!input.actor.email.trim()) {
      throw new ActivationJourneyError("ADMIN_ACTOR_REQUIRED", "Admin aktörü gerekli.");
    }
    if (
      input.actor.reasonCode.trim().length < 3 ||
      input.actor.noteLength < 8
    ) {
      throw new ActivationJourneyError(
        "ADMIN_REASON_REQUIRED",
        "Admin destekli yayına alma için güvenli neden ve not gerekli.",
      );
    }
  }

  const organization = await tx.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true, slug: true },
  });
  if (!organization) {
    throw new ActivationJourneyError("ORG_NOT_FOUND", "Organizasyon bulunamadı.");
  }
  const confirmationMatch = validateGoLiveConfirmation({
    confirmed: input.confirmed,
    confirmationText: input.confirmationText,
    organizationName: organization.name,
    organizationSlug: organization.slug,
  });

  const journeyId = await lockWexPayActivationJourneyForUpdate(
    tx,
    input.organizationId,
  );
  if (!journeyId) {
    throw new ActivationJourneyError("NOT_STARTED", "Akıllı Aktivasyon henüz başlamadı.");
  }

  const journey = await tx.activationJourney.findUnique({
    where: { id: journeyId },
    include: { steps: true },
  });
  if (!journey) {
    throw new ActivationJourneyError("NOT_STARTED", "Akıllı Aktivasyon henüz başlamadı.");
  }

  if (journey.status === ActivationJourneyStatus.ACTIVE) {
    assertGoLiveIdempotentReplayVersion(
      journey.version,
      input.expectedVersion,
    );
    return {
      activated: true,
      idempotent: true,
      report: null,
      journey: await loadJourneyResult(tx, journey.id),
    };
  }
  if (journey.blockedReasonCode === "ADMIN_BLOCKED") {
    throw new ActivationJourneyError(
      "ADMIN_BLOCKED",
      "Aktivasyon yönetici tarafından durduruldu.",
    );
  }
  if (journey.version !== input.expectedVersion) {
    throw new ActivationJourneyError(
      "VERSION_CONFLICT",
      "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
    );
  }
  if (
    journey.status !== ActivationJourneyStatus.READY ||
    journey.currentStep !== ActivationStepKey.GO_LIVE
  ) {
    throw new ActivationJourneyError(
      "NOT_READY",
      "Aktivasyon yayına alınmaya hazır değil.",
    );
  }
  const validationStep = journey.steps.find(
    (step) => step.stepKey === ActivationStepKey.VALIDATION,
  );
  const goLiveStep = journey.steps.find((step) => step.stepKey === ActivationStepKey.GO_LIVE);
  if (
    validationStep?.status !== ActivationJourneyStepStatus.COMPLETED ||
    !goLiveStep
  ) {
    throw new ActivationJourneyError(
      "VALIDATION_REQUIRED",
      "Yayına almadan önce doğrulama tamamlanmalıdır.",
    );
  }

  // Validator performs database/config checks only; no external network call is
  // permitted while the journey row lock is held.
  const report = await validateWexPayActivationInTx(tx, {
    organizationId: input.organizationId,
    journeyId: journey.id,
    env: input.env,
  });
  const safeValidation = buildActivationValidationSafeMetadata(report);
  const now = new Date();

  if (report.failCount > 0) {
    const regressed = await tx.activationJourney.updateMany({
      where: {
        id: journey.id,
        version: input.expectedVersion,
        status: ActivationJourneyStatus.READY,
        currentStep: ActivationStepKey.GO_LIVE,
      },
      data: {
        version: { increment: 1 },
        status: ActivationJourneyStatus.BLOCKED,
        currentStep: ActivationStepKey.VALIDATION,
        blockedReasonCode: "VALIDATION_FAILED",
      },
    });
    if (regressed.count !== 1) {
      const raced = await tx.activationJourney.findUnique({ where: { id: journey.id } });
      if (raced?.status === ActivationJourneyStatus.ACTIVE) {
        assertGoLiveIdempotentReplayVersion(
          raced.version,
          input.expectedVersion,
        );
        return {
          activated: true,
          idempotent: true,
          report: null,
          journey: await loadJourneyResult(tx, journey.id),
        };
      }
      throw new ActivationJourneyError(
        "VERSION_CONFLICT",
        "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
      );
    }

    await tx.activationJourneyStep.update({
      where: {
        journeyId_stepKey: {
          journeyId: journey.id,
          stepKey: ActivationStepKey.VALIDATION,
        },
      },
      data: {
        status: ActivationJourneyStepStatus.ERROR,
        completedAt: null,
        attemptCount: { increment: 1 },
        lastErrorCode: "VALIDATION_FAILED",
        safeMetadataJson: safeValidation as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog(
      {
        action: "activation.go_live.regressed",
        organizationId: input.organizationId,
        userId: input.actor.kind === "CUSTOMER" ? input.actor.userId : null,
        entityType: "ActivationJourney",
        entityId: journey.id,
        source: "activation_go_live",
        level: "WARN",
        status: "FAILURE",
        metadata: {
          ...safeActorMetadata(input.actor),
          ...safeValidation,
        },
      },
      tx,
    );
    return {
      activated: false,
      idempotent: false,
      report,
      journey: await loadJourneyResult(tx, journey.id),
    };
  }

  const activated = await tx.activationJourney.updateMany({
    where: {
      id: journey.id,
      version: input.expectedVersion,
      status: ActivationJourneyStatus.READY,
      currentStep: ActivationStepKey.GO_LIVE,
    },
    data: {
      version: { increment: 1 },
      status: ActivationJourneyStatus.ACTIVE,
      blockedReasonCode: null,
      completedAt: now,
      ...(input.actor.kind === "ADMIN"
        ? { source: ActivationJourneySource.ADMIN_ASSISTED }
        : {}),
    },
  });
  if (activated.count !== 1) {
    const raced = await tx.activationJourney.findUnique({ where: { id: journey.id } });
    if (raced?.status === ActivationJourneyStatus.ACTIVE) {
      assertGoLiveIdempotentReplayVersion(
        raced.version,
        input.expectedVersion,
      );
      return {
        activated: true,
        idempotent: true,
        report: null,
        journey: await loadJourneyResult(tx, journey.id),
      };
    }
    throw new ActivationJourneyError(
      "VERSION_CONFLICT",
      "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
    );
  }

  await tx.activationJourneyStep.update({
    where: {
      journeyId_stepKey: {
        journeyId: journey.id,
        stepKey: ActivationStepKey.GO_LIVE,
      },
    },
    data: {
      status: ActivationJourneyStepStatus.COMPLETED,
      completedAt: now,
      attemptCount: { increment: 1 },
      lastErrorCode: null,
      safeMetadataJson: {
        confirmationMatch,
        validationResult: report.overall,
      },
    },
  });
  await writeAuditLog(
    {
      action:
        input.actor.kind === "ADMIN"
          ? "activation.go_live.admin_assisted"
          : "activation.go_live.completed",
      organizationId: input.organizationId,
      userId: input.actor.kind === "CUSTOMER" ? input.actor.userId : null,
      entityType: "ActivationJourney",
      entityId: journey.id,
      source: "activation_go_live",
      metadata: {
        ...safeActorMetadata(input.actor),
        confirmationMatch,
        validationResult: report.overall,
        warningCount: report.warningCount,
      },
    },
    tx,
  );

  return {
    activated: true,
    idempotent: false,
    report,
    journey: await loadJourneyResult(tx, journey.id),
  };
}

export async function goLiveWexPayActivation(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  confirmed: boolean;
  confirmationText: string;
  env?: NodeJS.ProcessEnv;
}) {
  return prisma.$transaction(
    (tx) =>
      goLiveWexPayActivationInTx(tx, {
        organizationId: input.organizationId,
        expectedVersion: input.expectedVersion,
        confirmed: input.confirmed,
        confirmationText: input.confirmationText,
        actor: { kind: "CUSTOMER", userId: input.actorUserId },
        env: input.env,
      }),
    { timeout: 20_000 },
  );
}
