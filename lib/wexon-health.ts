/**
 * Safe liveness / readiness helpers for deployment probes.
 * Never include secrets, connection strings, hostnames, stacks, or Prisma messages.
 */

export const HEALTH_SERVICE_NAME = "wexon-platform";

export type HealthLivenessBody = {
  status: "ok";
  service: typeof HEALTH_SERVICE_NAME;
};

export type HealthReadinessBody = {
  status: "ready" | "not_ready";
};

export function buildHealthLivenessBody(): HealthLivenessBody {
  return { status: "ok", service: HEALTH_SERVICE_NAME };
}

export function buildHealthReadinessBody(ready: boolean): HealthReadinessBody {
  return { status: ready ? "ready" : "not_ready" };
}

const DEFAULT_READY_TIMEOUT_MS = 4_000;

async function defaultDatabaseSelectOne() {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$queryRaw`SELECT 1`;
}

/**
 * Read-only DB probe with timeout. Returns boolean only — never throws diagnostic details.
 * `query` is injectable for unit tests.
 */
export async function probeDatabaseReadiness(
  timeoutMs = DEFAULT_READY_TIMEOUT_MS,
  query: () => Promise<unknown> = defaultDatabaseSelectOne,
): Promise<boolean> {
  const databaseUrl = (process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "").trim();
  if (!databaseUrl) return false;

  try {
    await Promise.race([
      query(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("ready_timeout")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Headers for health responses (public probe — no caching). */
export function healthResponseHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
}
