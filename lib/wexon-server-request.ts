import { headers } from "next/headers";

/**
 * Prefer platform-trusted client IP signals.
 *
 * Trust model (highest → lowest):
 * 1. `x-vercel-forwarded-for` / `cf-connecting-ip` — set by the platform edge
 * 2. `x-real-ip` — typically set by the trusted reverse proxy / Vercel
 * 3. `x-forwarded-for` **rightmost** hop — closer to the trusted proxy;
 *    leftmost values are attacker-spoofable and must not be preferred alone.
 *
 * Public rate limits should treat missing IP as `unknown` (shared bucket) rather
 * than skipping enforcement.
 */
function pickTrustedIp(headerList: {
  get(name: string): string | null;
}): string | null {
  const vercelForwarded = headerList.get("x-vercel-forwarded-for")?.trim();
  if (vercelForwarded) {
    // Vercel documents this as the client address when present.
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const cfConnecting = headerList.get("cf-connecting-ip")?.trim();
  if (cfConnecting) return cfConnecting;

  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((part) => part.trim()).filter(Boolean);
    // Prefer the rightmost hop when XFF is the only signal (closer to the trusted proxy).
    if (parts.length > 0) return parts[parts.length - 1] ?? null;
  }
  return null;
}

/** Best-effort client IP extraction from a Fetch `Request` for audit context. */
export function getRequestIpAddress(request: Request): string | null {
  return pickTrustedIp(request.headers);
}

/** Best-effort IP extraction for Server Actions (login, etc.). */
export async function getServerActionIpAddress(): Promise<string> {
  const headerList = await headers();
  return pickTrustedIp(headerList) ?? "unknown";
}

/** Never throws — safe for public forms that must not crash on missing request scope. */
export async function getServerActionIpAddressSafe(): Promise<string> {
  try {
    return await getServerActionIpAddress();
  } catch (error) {
    console.error("[wexon-server-request] server action ip lookup failed", error);
    return "unknown";
  }
}
