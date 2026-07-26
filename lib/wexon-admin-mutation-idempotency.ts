import { createHash, randomUUID } from "crypto";
import { Prisma, type AdminMutationIdempotencyStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_MUTATION_IDEMPOTENCY_TTL_MS } from "@/lib/wexon-admin-mutation-policy";
import { AdminMutationGuardError } from "@/lib/wexon-admin-mutation-errors";

type IdempotencyClient = {
  adminMutationIdempotency: Prisma.TransactionClient["adminMutationIdempotency"];
};

export type AdminIdempotencyClaim =
  | { kind: "new"; recordId: string }
  | { kind: "replay"; result: unknown }
  | { kind: "in_progress" }
  | { kind: "conflict" };

export function hashAdminMutationRequestPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function hashAdminIdempotencyKey(mutationKey: string): string {
  return createHash("sha256").update(`amik:${mutationKey}`).digest("hex").slice(0, 24);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export function generateAdminMutationKey(): string {
  return randomUUID();
}

/**
 * Claim or replay an idempotency row. Run inside the mutation transaction
 * after PlatformAdmin lock when both apply.
 *
 * FAILED + same payload → retry (re-open PROCESSING).
 * Same key + different payload → conflict.
 */
export async function claimAdminMutationIdempotency(
  tx: IdempotencyClient,
  input: {
    adminId: string;
    action: string;
    mutationKey: string;
    requestHash: string;
    organizationId?: string | null;
    entityType?: string | null;
    now?: Date;
  },
): Promise<AdminIdempotencyClaim> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_MUTATION_IDEMPOTENCY_TTL_MS);

  const existing = await tx.adminMutationIdempotency.findUnique({
    where: {
      adminId_action_mutationKey: {
        adminId: input.adminId,
        action: input.action,
        mutationKey: input.mutationKey,
      },
    },
  });

  if (existing) {
    if (existing.requestHash !== input.requestHash) {
      return { kind: "conflict" };
    }
    if (existing.status === "SUCCEEDED") {
      return { kind: "replay", result: existing.resultJson };
    }
    if (existing.status === "PROCESSING" && existing.expiresAt.getTime() > now.getTime()) {
      return { kind: "in_progress" };
    }
    await tx.adminMutationIdempotency.update({
      where: { id: existing.id },
      data: {
        status: "PROCESSING",
        expiresAt,
        denyCode: null,
        resultJson: Prisma.JsonNull,
      },
    });
    return { kind: "new", recordId: existing.id };
  }

  try {
    const created = await tx.adminMutationIdempotency.create({
      data: {
        id: randomUUID(),
        adminId: input.adminId,
        action: input.action,
        mutationKey: input.mutationKey,
        requestHash: input.requestHash,
        status: "PROCESSING",
        organizationId: input.organizationId ?? null,
        entityType: input.entityType ?? null,
        expiresAt,
      },
    });
    return { kind: "new", recordId: created.id };
  } catch {
    const raced = await tx.adminMutationIdempotency.findUnique({
      where: {
        adminId_action_mutationKey: {
          adminId: input.adminId,
          action: input.action,
          mutationKey: input.mutationKey,
        },
      },
    });
    if (!raced) {
      throw new AdminMutationGuardError(
        "idempotency_conflict",
        "İşlem tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyin.",
      );
    }
    if (raced.requestHash !== input.requestHash) return { kind: "conflict" };
    if (raced.status === "SUCCEEDED") return { kind: "replay", result: raced.resultJson };
    if (raced.status === "PROCESSING") return { kind: "in_progress" };
    return { kind: "new", recordId: raced.id };
  }
}

export async function completeAdminMutationIdempotency(
  tx: IdempotencyClient,
  input: {
    recordId: string;
    status: Extract<AdminMutationIdempotencyStatus, "SUCCEEDED" | "FAILED">;
    entityId?: string | null;
    result?: unknown;
    denyCode?: string | null;
  },
) {
  await tx.adminMutationIdempotency.update({
    where: { id: input.recordId },
    data: {
      status: input.status,
      entityId: input.entityId ?? undefined,
      resultJson:
        input.result === undefined ? undefined : (input.result as Prisma.InputJsonValue),
      denyCode: input.denyCode ?? null,
    },
  });
}

export async function maybeCleanupExpiredAdminIdempotency(
  client: IdempotencyClient = prisma,
  now = new Date(),
): Promise<number> {
  if (Math.random() > 0.02) return 0;
  const expired = await client.adminMutationIdempotency.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true },
    take: 50,
    orderBy: { expiresAt: "asc" },
  });
  if (expired.length === 0) return 0;
  const result = await client.adminMutationIdempotency.deleteMany({
    where: { id: { in: expired.map((row) => row.id) }, expiresAt: { lt: now } },
  });
  return result.count;
}
