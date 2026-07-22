import {
  ActivationJourneyStatus,
  ActivationJourneyStepStatus,
  ActivationStepKey,
  type Prisma,
  type PrismaClient,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { ActivationJourneyError } from "@/lib/wexpay-activation-journey";
import { goLiveWexPayActivationInTx } from "@/lib/wexpay-activation-go-live";

type AdminActivationDbClient = PrismaClient | Prisma.TransactionClient;

export type ActivationAdminActor = {
  email: string;
};

export type SanitizedAdminActivationBlockInput = {
  reasonCode: string;
  noteLength: number;
};

function sanitizeReasonCode(reason: string) {
  const reasonCode = reason
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (reasonCode.length < 3) {
    throw new ActivationJourneyError("BLOCK_REASON_REQUIRED", "Engelleme nedeni gerekli.");
  }
  return reasonCode;
}

function requireAdminActor(actor: ActivationAdminActor) {
  const email = actor.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new ActivationJourneyError("ADMIN_ACTOR_REQUIRED", "Geçerli admin aktörü gerekli.");
  }
  return email;
}

export function sanitizeAdminActivationBlockInput(input: {
  reason: string;
  note: string;
}): SanitizedAdminActivationBlockInput {
  const reasonCode = sanitizeReasonCode(input.reason);
  const note = input.note.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (note.length < 8) {
    throw new ActivationJourneyError(
      "BLOCK_NOTE_REQUIRED",
      "Engelleme notu en az 8 karakter olmalıdır.",
    );
  }
  return { reasonCode, noteLength: Math.min(note.length, 500) };
}

async function loadAdminJourney(tx: AdminActivationDbClient, organizationId: string) {
  const journey = await tx.activationJourney.findFirst({
    where: { organizationId, product: { key: "wexpay" } },
    include: { steps: { orderBy: { stepKey: "asc" } } },
  });
  if (!journey) {
    throw new ActivationJourneyError("NOT_STARTED", "Akıllı Aktivasyon henüz başlamadı.");
  }
  return journey;
}

export async function blockWexPayActivationAsAdmin(input: {
  organizationId: string;
  expectedVersion: number;
  actor: ActivationAdminActor;
  reason: string;
  note: string;
}) {
  const actorEmail = requireAdminActor(input.actor);
  const safeReason = sanitizeAdminActivationBlockInput({
    reason: input.reason,
    note: input.note,
  });
  return prisma.$transaction(async (tx) => {
    const journey = await loadAdminJourney(tx, input.organizationId);
    if (
      journey.status !== ActivationJourneyStatus.IN_PROGRESS &&
      journey.status !== ActivationJourneyStatus.READY
    ) {
      throw new ActivationJourneyError(
        "BLOCK_STATE_INVALID",
        "Yalnızca devam eden veya hazır aktivasyon engellenebilir.",
      );
    }
    const updated = await tx.activationJourney.updateMany({
      where: {
        id: journey.id,
        version: input.expectedVersion,
        status: {
          in: [ActivationJourneyStatus.IN_PROGRESS, ActivationJourneyStatus.READY],
        },
      },
      data: {
        version: { increment: 1 },
        status: ActivationJourneyStatus.BLOCKED,
        blockedReasonCode: "ADMIN_BLOCKED",
      },
    });
    if (updated.count !== 1) {
      throw new ActivationJourneyError(
        "VERSION_CONFLICT",
        "Aktivasyon başka bir oturumda güncellendi.",
      );
    }
    await writeAuditLog(
      {
        action: "activation.admin.blocked",
        organizationId: input.organizationId,
        entityType: "ActivationJourney",
        entityId: journey.id,
        source: "activation_admin",
        level: "WARN",
        metadata: {
          actorType: "admin_session",
          actorEmail,
          reasonCode: safeReason.reasonCode,
          noteLength: safeReason.noteLength,
        },
      },
      tx,
    );
    return loadAdminJourney(tx, input.organizationId);
  });
}

export async function unblockWexPayActivationAsAdmin(input: {
  organizationId: string;
  expectedVersion: number;
  actor: ActivationAdminActor;
  reason: string;
}) {
  const actorEmail = requireAdminActor(input.actor);
  const reasonCode = sanitizeReasonCode(input.reason);
  return prisma.$transaction(async (tx) => {
    const journey = await loadAdminJourney(tx, input.organizationId);
    if (
      journey.status !== ActivationJourneyStatus.BLOCKED ||
      journey.blockedReasonCode !== "ADMIN_BLOCKED"
    ) {
      throw new ActivationJourneyError(
        "UNBLOCK_STATE_INVALID",
        "Yalnızca yönetici tarafından engellenmiş aktivasyon açılabilir.",
      );
    }
    const validationCompleted = journey.steps.some(
      (step) =>
        step.stepKey === ActivationStepKey.VALIDATION &&
        step.status === ActivationJourneyStepStatus.COMPLETED,
    );
    const restoredStatus =
      journey.currentStep === ActivationStepKey.GO_LIVE && validationCompleted
        ? ActivationJourneyStatus.READY
        : ActivationJourneyStatus.IN_PROGRESS;
    const updated = await tx.activationJourney.updateMany({
      where: {
        id: journey.id,
        version: input.expectedVersion,
        status: ActivationJourneyStatus.BLOCKED,
        blockedReasonCode: "ADMIN_BLOCKED",
      },
      data: {
        version: { increment: 1 },
        status: restoredStatus,
        blockedReasonCode: null,
      },
    });
    if (updated.count !== 1) {
      throw new ActivationJourneyError(
        "VERSION_CONFLICT",
        "Aktivasyon başka bir oturumda güncellendi.",
      );
    }
    await writeAuditLog(
      {
        action: "activation.admin.unblocked",
        organizationId: input.organizationId,
        entityType: "ActivationJourney",
        entityId: journey.id,
        source: "activation_admin",
        metadata: {
          actorType: "admin_session",
          actorEmail,
          reasonCode,
        },
      },
      tx,
    );
    return loadAdminJourney(tx, input.organizationId);
  });
}

export async function adminAssistedWexPayGoLive(input: {
  organizationId: string;
  expectedVersion: number;
  actor: ActivationAdminActor;
  reason: string;
  note: string;
  confirmed: boolean;
  confirmationText: string;
  env?: NodeJS.ProcessEnv;
}) {
  const actorEmail = requireAdminActor(input.actor);
  const safeReason = sanitizeAdminActivationBlockInput({
    reason: input.reason,
    note: input.note,
  });
  return prisma.$transaction(
    (tx) =>
      goLiveWexPayActivationInTx(tx, {
        organizationId: input.organizationId,
        expectedVersion: input.expectedVersion,
        confirmed: input.confirmed,
        confirmationText: input.confirmationText,
        actor: {
          kind: "ADMIN",
          email: actorEmail,
          reasonCode: safeReason.reasonCode,
          noteLength: safeReason.noteLength,
        },
        env: input.env,
      }),
    { timeout: 20_000 },
  );
}
