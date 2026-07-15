import { getRequestIpAddress } from "@/lib/wexon-server-request";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import {
  buildHealthLivenessBody,
  healthResponseHeaders,
} from "@/lib/wexon-health";

export const runtime = "nodejs";

/**
 * Liveness probe — process is up and can answer.
 * Does not touch the database. Public; rate-limited to curb scrape noise.
 */
export async function GET(request: Request) {
  const ip = getRequestIpAddress(request) || "unknown";
  const limited = enforceRateLimit("health.liveness", ip, RATE_LIMITS.healthProbe);
  if (!limited.ok) {
    return new Response(null, {
      status: 429,
      headers: {
        ...healthResponseHeaders(),
        "Retry-After": String(limited.retryAfterSeconds),
      },
    });
  }

  return Response.json(buildHealthLivenessBody(), {
    status: 200,
    headers: healthResponseHeaders(),
  });
}
