import { createHash, randomUUID } from "crypto";
import type { Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_MUTATION_GLOBAL_PER_MINUTE,
  ADMIN_MUTATION_RATE_LIMITS,
  type AdminMutationRiskClass,
  type AdminRateLimitWindow,
} from "@/lib/wexon-admin-mutation-policy";
import { AdminMutationGuardError } from "@/lib/wexon-admin-mutation-errors";

type RateLimitClient = {
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
  adminMutationRateLimit: {
    deleteMany: (args: {
      where: { expiresAt: { lt: Date }; id?: { in?: string[] } };
    }) => Promise<{ count: number }>;
    findMany: (args: {
      where: { expiresAt: { lt: Date } };
      select: { id: true };
      take: number;
      orderBy: { expiresAt: "asc" };
    }) => Promise<Array<{ id: string }>>;
  };
};

export function hashAdminIpBucket(ipAddress: string): string {
  return createHash("sha256").update(`admin-ip:${ipAddress || "unknown"}`).digest("hex").slice(0, 24);
}

/**
 * Risk buckets may include org + IP.
 * Global backstop is admin-scoped only: adminId + GLOBAL + global (no IP/org/risk split).
 */
export function buildAdminRateLimitBucketKey(input: {
  adminId: string;
  riskClass: AdminMutationRiskClass | "GLOBAL";
  organizationId?: string | null;
  ipHash: string;
  scope: "short" | "long" | "global";
}): string {
  if (input.scope === "global" || input.riskClass === "GLOBAL") {
    return ["amrl", input.adminId, "GLOBAL", "global"].join(":");
  }
  const org = input.organizationId?.trim() || "global";
  return ["amrl", input.adminId, input.riskClass, org, input.ipHash, input.scope].join(":");
}

function floorWindowStart(now: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

async function incrementBucket(
  tx: RateLimitClient,
  input: {
    bucketKey: string;
    window: AdminRateLimitWindow;
    now: Date;
  },
): Promise<{ count: number; limited: boolean }> {
  const windowStart = floorWindowStart(input.now, input.window.windowSeconds);
  const expiresAt = new Date(windowStart.getTime() + input.window.windowSeconds * 1000 + 60_000);
  const id = randomUUID();

  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "AdminMutationRateLimit" ("id", "bucketKey", "windowStart", "windowSeconds", "count", "expiresAt", "createdAt", "updatedAt")
    VALUES (${id}, ${input.bucketKey}, ${windowStart}, ${input.window.windowSeconds}, 1, ${expiresAt}, ${input.now}, ${input.now})
    ON CONFLICT ("bucketKey", "windowStart", "windowSeconds")
    DO UPDATE SET
      "count" = "AdminMutationRateLimit"."count" + 1,
      "updatedAt" = ${input.now},
      "expiresAt" = GREATEST("AdminMutationRateLimit"."expiresAt", ${expiresAt})
    RETURNING "count"
  `;
  const count = rows[0]?.count ?? 1;
  return { count, limited: count > input.window.maxCount };
}

/** Low-probability bounded cleanup — never unbounded delete. */
export async function maybeCleanupExpiredAdminRateLimits(
  client: RateLimitClient = prisma as unknown as RateLimitClient,
  now = new Date(),
): Promise<number> {
  if (Math.random() > 0.02) return 0;
  const expired = await client.adminMutationRateLimit.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true },
    take: 50,
    orderBy: { expiresAt: "asc" },
  });
  if (expired.length === 0) return 0;
  const result = await client.adminMutationRateLimit.deleteMany({
    where: { id: { in: expired.map((row) => row.id) }, expiresAt: { lt: now } },
  });
  return result.count;
}

export async function enforceAdminMutationRateLimit(input: {
  adminId: string;
  riskClass: AdminMutationRiskClass;
  organizationId?: string | null;
  ipAddress: string;
  now?: Date;
  client?: RateLimitClient;
}): Promise<
  | { ok: true; bucketHashes: string[]; increments: Array<{ bucketHash: string; count: number; maxCount: number }> }
  | {
      ok: false;
      retryAfterSeconds: number;
      bucketHash: string;
      /** True only when this request crossed the limit (count === max + 1). */
      shouldAuditDeny: boolean;
      count: number;
      maxCount: number;
    }
> {
  const client = input.client ?? (prisma as unknown as RateLimitClient);
  const now = input.now ?? new Date();
  const ipHash = hashAdminIpBucket(input.ipAddress || "unknown");
  const limits = ADMIN_MUTATION_RATE_LIMITS[input.riskClass];
  const increments: Array<{ bucketHash: string; count: number; maxCount: number }> = [];

  try {
    void maybeCleanupExpiredAdminRateLimits(client, now);

    const checks: Array<{ key: string; window: AdminRateLimitWindow }> = [
      {
        key: buildAdminRateLimitBucketKey({
          adminId: input.adminId,
          riskClass: input.riskClass,
          organizationId: input.organizationId,
          ipHash,
          scope: "short",
        }),
        window: limits.short,
      },
      {
        key: buildAdminRateLimitBucketKey({
          adminId: input.adminId,
          riskClass: input.riskClass,
          organizationId: input.organizationId,
          ipHash,
          scope: "long",
        }),
        window: limits.long,
      },
      {
        key: buildAdminRateLimitBucketKey({
          adminId: input.adminId,
          riskClass: "GLOBAL",
          organizationId: null,
          ipHash: "n/a",
          scope: "global",
        }),
        window: { windowSeconds: 60, maxCount: ADMIN_MUTATION_GLOBAL_PER_MINUTE },
      },
    ];

    for (const check of checks) {
      const bucketHash = createHash("sha256").update(check.key).digest("hex").slice(0, 16);
      const result = await incrementBucket(client, {
        bucketKey: check.key,
        window: check.window,
        now,
      });
      increments.push({ bucketHash, count: result.count, maxCount: check.window.maxCount });
      if (result.limited) {
        return {
          ok: false,
          retryAfterSeconds: check.window.windowSeconds,
          bucketHash,
          // Serverless-safe coalescing: only the request that crossed the threshold audits.
          shouldAuditDeny: result.count === check.window.maxCount + 1,
          count: result.count,
          maxCount: check.window.maxCount,
        };
      }
    }

    return { ok: true, bucketHashes: increments.map((i) => i.bucketHash), increments };
  } catch (error) {
    throw new AdminMutationGuardError(
      "rate_limit_unavailable",
      "İşlem tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyin.",
      { cause: error },
    );
  }
}
