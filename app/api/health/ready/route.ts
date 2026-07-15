import { getRequestIpAddress } from "@/lib/wexon-server-request";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import {
  buildHealthReadinessBody,
  healthResponseHeaders,
  probeDatabaseReadiness,
} from "@/lib/wexon-health";

export const runtime = "nodejs";

/**
 * Readiness probe — dependency check via safe read-only SELECT 1.
 * Failures return generic not_ready (no URL, host, stack, or Prisma text).
 */
export async function GET(request: Request) {
  const ip = getRequestIpAddress(request) || "unknown";
  const limited = enforceRateLimit("health.readiness", ip, RATE_LIMITS.healthProbe);
  if (!limited.ok) {
    return Response.json(buildHealthReadinessBody(false), {
      status: 503,
      headers: {
        ...healthResponseHeaders(),
        "Retry-After": String(limited.retryAfterSeconds),
      },
    });
  }

  const ready = await probeDatabaseReadiness();
  return Response.json(buildHealthReadinessBody(ready), {
    status: ready ? 200 : 503,
    headers: healthResponseHeaders(),
  });
}
