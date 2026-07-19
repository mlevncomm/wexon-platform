import { handlePaytrSubscriptionCallback } from "@/lib/paytr/paytr-callback";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { getRequestIpAddress } from "@/lib/wexon-server-request";

export const runtime = "nodejs";

async function readRawBody(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = (await request.json()) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          params.set(key, String(value));
        }
      }
      return params.toString();
    } catch {
      return "";
    }
  }
  return request.text();
}

/**
 * PayTR expects plain-text "OK" only when the callback is fully accepted.
 * Transient activation failures return non-OK (503) so PayTR retries and
 * self-heal can complete License/Subscription linkage.
 */
export async function POST(request: Request) {
  const ip = getRequestIpAddress(request) ?? "unknown";
  const rate = enforceRateLimit("billing.paytr.callback", ip, {
    ...RATE_LIMITS.paytrWebhook,
    limit: 600,
  });
  if (!rate.ok) {
    return new Response("TOO_MANY_REQUESTS", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const rawBody = await readRawBody(request);
  const result = await handlePaytrSubscriptionCallback({ rawBody, request });

  if (!result.ok) {
    return new Response(result.reason.toUpperCase(), {
      status: result.status ?? 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
