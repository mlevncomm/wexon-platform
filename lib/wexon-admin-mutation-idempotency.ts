import { createHash, randomUUID } from "crypto";
import { Prisma, type AdminMutationIdempotencyStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_MUTATION_IDEMPOTENCY_TTL_MS } from "@/lib/wexon-admin-mutation-policy";
import { AdminMutationGuardError } from "@/lib/wexon-admin-mutation-errors";

type IdempotencyClient = {
  adminMutationIdempotency: Prisma.TransactionClient["adminMutationIdempotency"];
  $executeRaw?: Prisma.TransactionClient["$executeRaw"];
  $queryRaw?: Prisma.TransactionClient["$queryRaw"];
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

function classifyExisting(
  existing: {
    id: string;
    requestHash: string;
    status: AdminMutationIdempotencyStatus;
    resultJson: Prisma.JsonValue | null;
    expiresAt: Date;
  },
  requestHash: string,
  now: Date,
): AdminIdempotencyClaim | { kind: "reopen"; recordId: string } {
  if (existing.requestHash !== requestHash) {
    return { kind: "conflict" };
  }
  if (existing.status === "SUCCEEDED") {
    return { kind: "replay", result: existing.resultJson };
  }
  if (existing.status === "PROCESSING" && existing.expiresAt.getTime() > now.getTime()) {
    return { kind: "in_progress" };
  }
  // FAILED or expired PROCESSING + same payload → reopen for retry.
  return { kind: "reopen", recordId: existing.id };
}

/**
 * Short independent claim transaction (atomic INSERT ON CONFLICT DO NOTHING).
 * Never leave an aborted Postgres transaction for the caller to reuse.
 */
export async function claimAdminMutationIdempotencyIndependent(input: {
  adminId: string;
  action: string;
  mutationKey: string;
  requestHash: string;
  organizationId?: string | null;
  entityType?: string | null;
  now?: Date;
}): Promise<AdminIdempotencyClaim> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_MUTATION_IDEMPOTENCY_TTL_MS);
  const id = randomUUID();

  const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AdminMutationIdempotency" (
      "id", "adminId", "action", "mutationKey", "requestHash", "status",
      "organizationId", "entityType", "expiresAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${id}, ${input.adminId}, ${input.action}, ${input.mutationKey}, ${input.requestHash},
      CAST('PROCESSING' AS "AdminMutationIdempotencyStatus"),
      ${input.organizationId ?? null}, ${input.entityType ?? null}, ${expiresAt}, ${now}, ${now}
    )
    ON CONFLICT ("adminId", "action", "mutationKey") DO NOTHING
    RETURNING "id"
  `;

  if (inserted[0]?.id) {
    return { kind: "new", recordId: inserted[0].id };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.adminMutationIdempotency.findUnique({
      where: {
        adminId_action_mutationKey: {
          adminId: input.adminId,
          action: input.action,
          mutationKey: input.mutationKey,
        },
      },
    });
    if (!existing) {
      throw new AdminMutationGuardError(
        "idempotency_conflict",
        "İşlem tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyin.",
      );
    }
    const classified = classifyExisting(existing, input.requestHash, now);
    if (classified.kind === "reopen") {
      const updated = await tx.adminMutationIdempotency.updateMany({
        where: {
          id: existing.id,
          status: { in: ["FAILED", "PROCESSING"] },
          requestHash: input.requestHash,
        },
        data: {
          status: "PROCESSING",
          expiresAt,
          denyCode: null,
          resultJson: Prisma.JsonNull,
          updatedAt: now,
        },
      });
      if (updated.count === 0) {
        const raced = await tx.adminMutationIdempotency.findUnique({ where: { id: existing.id } });
        if (!raced) return { kind: "conflict" };
        const again = classifyExisting(raced, input.requestHash, now);
        if (again.kind === "reopen") return { kind: "in_progress" };
        return again;
      }
      return { kind: "new", recordId: existing.id };
    }
    return classified;
  });
}

/**
 * Lock + validate an already-claimed PROCESSING row inside the mutation transaction.
 */
export async function lockAdminMutationIdempotencyRow(
  tx: IdempotencyClient,
  input: {
    recordId: string;
    adminId: string;
    action: string;
    mutationKey: string;
    requestHash: string;
  },
): Promise<void> {
  const rows = await tx.$queryRaw!<
    Array<{ id: string; status: string; requestHash: string; adminId: string; action: string; mutationKey: string }>
  >`
    SELECT "id", "status"::text AS "status", "requestHash", "adminId", "action", "mutationKey"
    FROM "AdminMutationIdempotency"
    WHERE "id" = ${input.recordId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (
    !row ||
    row.adminId !== input.adminId ||
    row.action !== input.action ||
    row.mutationKey !== input.mutationKey ||
    row.requestHash !== input.requestHash
  ) {
    throw new AdminMutationGuardError(
      "idempotency_conflict",
      "Bu işlem anahtarı farklı bir içerikle kullanılmış. Sayfayı yenileyip tekrar deneyin.",
    );
  }
  if (row.status === "SUCCEEDED") {
    throw new AdminMutationGuardError(
      "idempotency_conflict",
      "İşlem zaten tamamlanmış. Sayfayı yenileyip sonucu kontrol edin.",
    );
  }
  if (row.status !== "PROCESSING") {
    throw new AdminMutationGuardError(
      "idempotency_in_progress",
      "İşlem devam ediyor. Sayfayı yenileyip sonucu kontrol edin.",
    );
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
    expectedStatus?: AdminMutationIdempotencyStatus;
    requestHash?: string;
    adminId?: string;
    action?: string;
    mutationKey?: string;
  },
): Promise<boolean> {
  const where: Prisma.AdminMutationIdempotencyWhereInput = {
    id: input.recordId,
  };
  if (input.expectedStatus) where.status = input.expectedStatus;
  if (input.requestHash) where.requestHash = input.requestHash;
  if (input.adminId) where.adminId = input.adminId;
  if (input.action) where.action = input.action;
  if (input.mutationKey) where.mutationKey = input.mutationKey;

  const result = await tx.adminMutationIdempotency.updateMany({
    where,
    data: {
      status: input.status,
      entityId: input.entityId ?? undefined,
      resultJson:
        input.result === undefined ? undefined : (input.result as Prisma.InputJsonValue),
      denyCode: input.denyCode ?? null,
    },
  });
  return result.count > 0;
}

/**
 * Separate finalizer transaction after known mutation failure.
 * Only marks FAILED when still PROCESSING with matching hash/admin/action/key.
 */
export async function finalizeAdminMutationIdempotencyFailed(input: {
  recordId: string;
  adminId: string;
  action: string;
  mutationKey: string;
  requestHash: string;
  denyCode?: string | null;
}): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      return completeAdminMutationIdempotency(tx, {
        recordId: input.recordId,
        status: "FAILED",
        expectedStatus: "PROCESSING",
        requestHash: input.requestHash,
        adminId: input.adminId,
        action: input.action,
        mutationKey: input.mutationKey,
        denyCode: input.denyCode ?? null,
      });
    });
  } catch {
    // Crash-safe: PROCESSING TTL retry will reopen later.
    return false;
  }
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

/** @deprecated Prefer claimAdminMutationIdempotencyIndependent + lockAdminMutationIdempotencyRow */
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
  void tx;
  return claimAdminMutationIdempotencyIndependent(input);
}
