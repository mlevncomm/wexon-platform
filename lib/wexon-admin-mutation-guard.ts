import { createHash, randomUUID } from "crypto";
import type { Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/lib/wexon-admin-auth";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import { writeAuditLog, writeAuditFailure } from "@/lib/wexon-audit";
import { getServerActionIpAddressSafe } from "@/lib/wexon-server-request";
import {
  lockActivePlatformAdminMatchesIdentity,
  PlatformAdminCloudflareAccessError,
} from "@/lib/wexon-platform-admin-cloudflare-bind";
import {
  isAdminMutationIdempotentAction,
  isValidAdminMutationKey,
  requiresAdminRowLock,
  requiresHighRiskConfirmation,
  resolveAdminMutationRiskClass,
  sanitizeAdminMutationReason,
  type AdminMutationRiskClass,
} from "@/lib/wexon-admin-mutation-policy";

function maskEmailForAudit(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}
import {
  ADMIN_MUTATION_GENERIC_USER_MESSAGE,
  AdminMutationGuardError,
  type AdminMutationDenyCode,
} from "@/lib/wexon-admin-mutation-errors";
import { enforceAdminMutationRateLimit } from "@/lib/wexon-admin-mutation-rate-limit";
import {
  claimAdminMutationIdempotency,
  completeAdminMutationIdempotency,
  hashAdminIdempotencyKey,
  hashAdminMutationRequestPayload,
  maybeCleanupExpiredAdminIdempotency,
} from "@/lib/wexon-admin-mutation-idempotency";
import { LastActiveOwnerError } from "@/lib/wexon-active-owner";
import { SubscriptionAccessSyncError } from "@/lib/wexon-subscription-lifecycle";
import { ActivationFeeError } from "@/lib/wexon-activation-fee";

export const ADMIN_MUTATION_TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

export type AdminMutationExecuteResult = {
  entityId?: string | null;
  organizationId?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  transition?: string | null;
  metadata?: Record<string, unknown>;
  /** Safe replay payload stored on SUCCEEDED idempotency rows. */
  replayResult?: unknown;
};

export type AdminMutationContext = {
  tx: Prisma.TransactionClient;
  actor: AdminSession;
  requestId: string;
  ipAddress: string;
  riskClass: AdminMutationRiskClass;
  action: string;
  organizationId: string | null;
};

export type RunAdminMutationInput = {
  action: string;
  actor: AdminSession;
  organizationId?: string | null;
  entityType: string;
  entityId?: string | null;
  /** Required for idempotent create/delete actions. */
  mutationId?: string | null;
  reason?: string | null;
  confirmed?: boolean;
  /** Hashed into idempotency requestHash when mutationId present. */
  requestHashPayload?: unknown;
  /**
   * Skip FOR UPDATE PlatformAdmin lock when the execute path already locks
   * (e.g. PR4 commercial domain). Rate limit + audit envelope still apply.
   */
  skipAdminLock?: boolean;
  /**
   * When true, runAdminMutation only does preflight (rate limit / confirm) and
   * calls execute outside its own transaction (execute manages tx).
   */
  externalTransaction?: boolean;
  execute: (ctx: AdminMutationContext) => Promise<AdminMutationExecuteResult>;
};

const recentRateLimitDenies = new Map<string, number>();

function hashCloudflareSubject(subject: string): string {
  return createHash("sha256").update(`cfsub:${subject}`).digest("hex").slice(0, 16);
}

export function buildAdminMutationAuditMetadata(input: {
  actor: AdminSession;
  requestId: string;
  riskClass: AdminMutationRiskClass;
  action: string;
  organizationId?: string | null;
  reason?: string | null;
  confirmed?: boolean;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  transition?: string | null;
  idempotencyKeyHash?: string | null;
  rateLimitBucketHash?: string | null;
  extra?: Record<string, unknown>;
}) {
  return {
    actorAdminId: input.actor.adminId,
    actorEmailMasked: maskEmailForAudit(input.actor.email),
    cloudflareSubjectHash: hashCloudflareSubject(input.actor.cloudflareSubject),
    source: "admin_mutation",
    requestId: input.requestId,
    riskClass: input.riskClass,
    action: input.action,
    organizationId: input.organizationId ?? null,
    reason: input.reason ?? null,
    confirmed: input.confirmed ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    transition: input.transition ?? null,
    idempotencyKeyHash: input.idempotencyKeyHash ?? null,
    rateLimitBucketHash: input.rateLimitBucketHash ?? null,
    ...(input.extra ?? {}),
  };
}

function coalesceRateLimitDenyAudit(bucketHash: string): boolean {
  const now = Date.now();
  const last = recentRateLimitDenies.get(bucketHash) ?? 0;
  if (now - last < 60_000) return false;
  recentRateLimitDenies.set(bucketHash, now);
  if (recentRateLimitDenies.size > 500) {
    for (const [key, ts] of recentRateLimitDenies) {
      if (now - ts > 120_000) recentRateLimitDenies.delete(key);
    }
  }
  return true;
}

export function writeAdminMutationDeniedAudit(input: {
  actor: AdminSession;
  action: string;
  riskClass: AdminMutationRiskClass;
  requestId: string;
  organizationId?: string | null;
  entityType?: string;
  entityId?: string | null;
  code: AdminMutationDenyCode;
  message: string;
  rateLimitBucketHash?: string | null;
  ipAddress?: string | null;
}) {
  if (input.code === "rate_limit_denied" && input.rateLimitBucketHash) {
    if (!coalesceRateLimitDenyAudit(input.rateLimitBucketHash)) return;
  }
  writeAuditFailure({
    action: `admin.mutation.denied.${input.code}`,
    organizationId: input.organizationId ?? null,
    entityType: input.entityType,
    entityId: input.entityId ?? undefined,
    ipAddress: input.ipAddress ?? null,
    level: "WARN",
    status: "FAILURE",
    message: input.message,
    metadata: buildAdminMutationAuditMetadata({
      actor: input.actor,
      requestId: input.requestId,
      riskClass: input.riskClass,
      action: input.action,
      organizationId: input.organizationId,
      rateLimitBucketHash: input.rateLimitBucketHash,
      extra: { denyCode: input.code },
    }),
  });
}

/**
 * Map unknown errors to a UI-safe message. Only allowlisted domain errors leak text.
 */
export function getSafeAdminActionErrorMessage(error: unknown, fallback = ADMIN_MUTATION_GENERIC_USER_MESSAGE): string {
  if (error instanceof AdminValidationError) return error.message;
  if (error instanceof AdminMutationGuardError) return error.safeMessage;
  if (error instanceof PlatformAdminCloudflareAccessError) return fallback;
  if (error instanceof LastActiveOwnerError) return error.message;
  if (error instanceof SubscriptionAccessSyncError) return error.message;
  if (error instanceof ActivationFeeError) {
    if (
      error.code === "ACTIVATION_FEE_RESERVED" ||
      error.code === "ACTIVATION_FEE_IMMUTABLE" ||
      error.code === "ACTIVATION_FEE_STALE_QUOTE"
    ) {
      return error.message;
    }
  }
  return fallback;
}

export function logAdminMutationInternalError(input: {
  requestId: string;
  action: string;
  adminId: string;
  entityId?: string | null;
  error: unknown;
}) {
  const err = input.error;
  const code =
    err instanceof AdminMutationGuardError
      ? err.code
      : err instanceof Error
        ? err.name
        : "unknown";
  console.error("[admin-mutation]", {
    requestId: input.requestId,
    action: input.action,
    adminId: input.adminId,
    entityId: input.entityId ?? null,
    code,
  });
}

/**
 * Deadlock-safe commercial + mutation lock order:
 * 1) PlatformAdmin FOR UPDATE
 * 2) License plan advisory (PR4 plan-change)
 * 3) ActivationFee advisory (PR4)
 * 4) Idempotency / finance entity rows
 * 5) post-lock reads → mutate → success audit → commit
 */
export async function runAdminMutation(input: RunAdminMutationInput): Promise<AdminMutationExecuteResult> {
  const riskClass = resolveAdminMutationRiskClass(input.action);
  const requestId = randomUUID();
  const ipAddress = await getServerActionIpAddressSafe();
  const organizationId = input.organizationId ?? null;

  let reason: string | null = null;
  if (requiresHighRiskConfirmation(riskClass)) {
    if (!input.confirmed) {
      const err = new AdminMutationGuardError(
        "confirmation_missing",
        "Bu işlem için onay zorunludur.",
      );
      writeAdminMutationDeniedAudit({
        actor: input.actor,
        action: input.action,
        riskClass,
        requestId,
        organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        code: err.code,
        message: err.safeMessage,
        ipAddress,
      });
      throw err;
    }
    try {
      reason = sanitizeAdminMutationReason(input.reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : "İşlem gerekçesi geçersiz.";
      const err = new AdminMutationGuardError("confirmation_missing", message);
      writeAdminMutationDeniedAudit({
        actor: input.actor,
        action: input.action,
        riskClass,
        requestId,
        organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        code: err.code,
        message: err.safeMessage,
        ipAddress,
      });
      throw err;
    }
  } else if (input.reason) {
    reason = input.reason.trim().replace(/\s+/g, " ").slice(0, 500) || null;
  }

  const rate = await enforceAdminMutationRateLimit({
    adminId: input.actor.adminId,
    riskClass,
    organizationId,
    ipAddress,
  }).catch((error) => {
    if (error instanceof AdminMutationGuardError) {
      writeAdminMutationDeniedAudit({
        actor: input.actor,
        action: input.action,
        riskClass,
        requestId,
        organizationId,
        entityType: input.entityType,
        code: error.code,
        message: error.safeMessage,
        ipAddress,
      });
    }
    throw error;
  });

  if (!rate.ok) {
    const err = new AdminMutationGuardError(
      "rate_limit_denied",
      "Çok fazla işlem denemesi. Lütfen bir süre sonra tekrar deneyin.",
    );
    writeAdminMutationDeniedAudit({
      actor: input.actor,
      action: input.action,
      riskClass,
      requestId,
      organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      code: err.code,
      message: err.safeMessage,
      rateLimitBucketHash: rate.bucketHash,
      ipAddress,
    });
    throw err;
  }

  const needsIdempotency = isAdminMutationIdempotentAction(input.action);
  let mutationKey: string | null = null;
  let requestHash: string | null = null;
  let idempotencyKeyHash: string | null = null;

  if (needsIdempotency) {
    if (!isValidAdminMutationKey(input.mutationId)) {
      const err = new AdminMutationGuardError(
        "mutation_key_invalid",
        "İşlem anahtarı geçersiz. Sayfayı yenileyip tekrar deneyin.",
      );
      writeAdminMutationDeniedAudit({
        actor: input.actor,
        action: input.action,
        riskClass,
        requestId,
        organizationId,
        entityType: input.entityType,
        code: err.code,
        message: err.safeMessage,
        ipAddress,
      });
      throw err;
    }
    mutationKey = input.mutationId!.trim();
    requestHash = hashAdminMutationRequestPayload(input.requestHashPayload ?? {});
    idempotencyKeyHash = hashAdminIdempotencyKey(mutationKey);
    void maybeCleanupExpiredAdminIdempotency();
  }

  const lockAdmin = !input.skipAdminLock && requiresAdminRowLock(riskClass);
  const rateLimitBucketHash = rate.bucketHashes[0] ?? null;

  if (input.externalTransaction) {
    const ctx: AdminMutationContext = {
      tx: prisma as unknown as Prisma.TransactionClient,
      actor: input.actor,
      requestId,
      ipAddress,
      riskClass,
      action: input.action,
      organizationId,
    };
    const result = await input.execute(ctx);
    await writeAuditLog({
      action: `admin.${input.action.replace(/\./g, "_")}`,
      organizationId: result.organizationId ?? organizationId,
      entityType: input.entityType,
      entityId: result.entityId ?? input.entityId ?? undefined,
      ipAddress,
      source: "admin_mutation",
      metadata: buildAdminMutationAuditMetadata({
        actor: input.actor,
        requestId,
        riskClass,
        action: input.action,
        organizationId: result.organizationId ?? organizationId,
        reason,
        confirmed: input.confirmed,
        before: result.before,
        after: result.after,
        transition: result.transition,
        idempotencyKeyHash,
        rateLimitBucketHash,
        extra: result.metadata,
      }),
    });
    return result;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (lockAdmin) {
        try {
          await lockActivePlatformAdminMatchesIdentity(tx, {
            adminId: input.actor.adminId,
            emailNormalized: input.actor.email,
            cloudflareSubject: input.actor.cloudflareSubject,
          });
        } catch (error) {
          if (error instanceof PlatformAdminCloudflareAccessError) {
            throw new AdminMutationGuardError("inactive_admin", "Bu işlem için yetkiniz yok.");
          }
          throw error;
        }
      }

      let idempotencyRecordId: string | null = null;
      if (needsIdempotency && mutationKey && requestHash) {
        const claim = await claimAdminMutationIdempotency(tx, {
          adminId: input.actor.adminId,
          action: input.action,
          mutationKey,
          requestHash,
          organizationId,
          entityType: input.entityType,
        });
        if (claim.kind === "conflict") {
          throw new AdminMutationGuardError(
            "idempotency_conflict",
            "Bu işlem anahtarı farklı bir içerikle kullanılmış. Sayfayı yenileyip tekrar deneyin.",
          );
        }
        if (claim.kind === "in_progress") {
          throw new AdminMutationGuardError(
            "idempotency_in_progress",
            "İşlem devam ediyor. Sayfayı yenileyip sonucu kontrol edin.",
          );
        }
        if (claim.kind === "replay") {
          return {
            entityId: input.entityId ?? null,
            organizationId,
            metadata: { idempotentReplay: true, replayResult: claim.result },
            replayResult: claim.result,
          };
        }
        idempotencyRecordId = claim.recordId;
      }

      const ctx: AdminMutationContext = {
        tx,
        actor: input.actor,
        requestId,
        ipAddress,
        riskClass,
        action: input.action,
        organizationId,
      };

      let result: AdminMutationExecuteResult;
      try {
        result = await input.execute(ctx);
      } catch (error) {
        if (idempotencyRecordId) {
          await completeAdminMutationIdempotency(tx, {
            recordId: idempotencyRecordId,
            status: "FAILED",
            denyCode:
              error instanceof AdminMutationGuardError
                ? error.code
                : error instanceof AdminValidationError
                  ? "finance_invariant_failed"
                  : "unknown",
          });
        }
        throw error;
      }

      await writeAuditLog(
        {
          action: `admin.${input.action.replace(/\./g, "_")}`,
          organizationId: result.organizationId ?? organizationId,
          entityType: input.entityType,
          entityId: result.entityId ?? input.entityId ?? undefined,
          ipAddress,
          source: "admin_mutation",
          metadata: buildAdminMutationAuditMetadata({
            actor: input.actor,
            requestId,
            riskClass,
            action: input.action,
            organizationId: result.organizationId ?? organizationId,
            reason,
            confirmed: input.confirmed,
            before: result.before,
            after: result.after,
            transition: result.transition,
            idempotencyKeyHash,
            rateLimitBucketHash,
            extra: result.metadata,
          }),
        },
        tx,
      );

      if (idempotencyRecordId) {
        await completeAdminMutationIdempotency(tx, {
          recordId: idempotencyRecordId,
          status: "SUCCEEDED",
          entityId: result.entityId ?? null,
          result: result.replayResult ?? {
            entityId: result.entityId ?? null,
            organizationId: result.organizationId ?? organizationId,
          },
        });
      }

      return result;
    }, ADMIN_MUTATION_TX_OPTIONS);
  } catch (error) {
    if (
      error instanceof AdminMutationGuardError ||
      error instanceof AdminValidationError ||
      error instanceof LastActiveOwnerError ||
      error instanceof SubscriptionAccessSyncError
    ) {
      const code: AdminMutationDenyCode =
        error instanceof AdminMutationGuardError
          ? error.code
          : error instanceof AdminValidationError
            ? "finance_invariant_failed"
            : "invalid_state_transition";
      writeAdminMutationDeniedAudit({
        actor: input.actor,
        action: input.action,
        riskClass,
        requestId,
        organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        code,
        message: getSafeAdminActionErrorMessage(error),
        rateLimitBucketHash,
        ipAddress,
      });
    } else {
      logAdminMutationInternalError({
        requestId,
        action: input.action,
        adminId: input.actor.adminId,
        entityId: input.entityId,
        error,
      });
    }
    throw error;
  }
}

/** Parse confirmation + reason from FormData for high-risk mutations. */
export function readHighRiskConfirmation(formData: FormData): { confirmed: boolean; reason: string } {
  const confirmed =
    String(formData.get("confirmed") ?? "").trim() === "1" ||
    String(formData.get("confirmed") ?? "").trim() === "true";
  const reason = String(formData.get("reason") ?? formData.get("auditNote") ?? "");
  return { confirmed, reason };
}

export function readMutationId(formData: FormData): string | null {
  const value = String(formData.get("mutationId") ?? "").trim();
  return value || null;
}

/**
 * Rate-limit + confirmation gate for domain services that own their transaction
 * (PR4 commercial consistency). Does not open a mutation transaction or duplicate audits.
 */
export async function enforceAdminMutationGate(input: {
  action: string;
  actor: AdminSession;
  organizationId?: string | null;
  entityType?: string;
  entityId?: string | null;
  reason?: string | null;
  confirmed?: boolean;
}): Promise<{ requestId: string; ipAddress: string; riskClass: AdminMutationRiskClass; reason: string | null }> {
  const riskClass = resolveAdminMutationRiskClass(input.action);
  const requestId = randomUUID();
  const ipAddress = await getServerActionIpAddressSafe();
  const organizationId = input.organizationId ?? null;

  let reason: string | null = null;
  if (requiresHighRiskConfirmation(riskClass)) {
    if (!input.confirmed) {
      const err = new AdminMutationGuardError("confirmation_missing", "Bu işlem için onay zorunludur.");
      writeAdminMutationDeniedAudit({
        actor: input.actor,
        action: input.action,
        riskClass,
        requestId,
        organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        code: err.code,
        message: err.safeMessage,
        ipAddress,
      });
      throw err;
    }
    try {
      reason = sanitizeAdminMutationReason(input.reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : "İşlem gerekçesi geçersiz.";
      const err = new AdminMutationGuardError("confirmation_missing", message);
      writeAdminMutationDeniedAudit({
        actor: input.actor,
        action: input.action,
        riskClass,
        requestId,
        organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        code: err.code,
        message: err.safeMessage,
        ipAddress,
      });
      throw err;
    }
  }

  const rate = await enforceAdminMutationRateLimit({
    adminId: input.actor.adminId,
    riskClass,
    organizationId,
    ipAddress,
  });
  if (!rate.ok) {
    const err = new AdminMutationGuardError(
      "rate_limit_denied",
      "Çok fazla işlem denemesi. Lütfen bir süre sonra tekrar deneyin.",
    );
    writeAdminMutationDeniedAudit({
      actor: input.actor,
      action: input.action,
      riskClass,
      requestId,
      organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      code: err.code,
      message: err.safeMessage,
      rateLimitBucketHash: rate.bucketHash,
      ipAddress,
    });
    throw err;
  }

  return { requestId, ipAddress, riskClass, reason };
}
