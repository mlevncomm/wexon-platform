import { headers } from "next/headers";

/**
 * Prefer the platform-trusted client IP.
 * On Vercel, `x-real-ip` is set by the edge and is not attacker-controlled.
 * `x-forwarded-for` leftmost value is client-spoofable, so it is only a last resort.
 */
function pickTrustedIp(realIp: string | null, forwardedFor: string | null): string | null {
  if (realIp?.trim()) return realIp.trim();
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((part) => part.trim()).filter(Boolean);
    // Prefer the rightmost hop when XFF is the only signal (closer to the trusted proxy).
    if (parts.length > 0) return parts[parts.length - 1] ?? null;
  }
  return null;
}

/** Best-effort client IP extraction from a Fetch `Request` for audit context. */
export function getRequestIpAddress(request: Request): string | null {
  return pickTrustedIp(request.headers.get("x-real-ip"), request.headers.get("x-forwarded-for"));
}

/** Best-effort IP extraction for Server Actions (login, etc.). */
export async function getServerActionIpAddress(): Promise<string> {
  const headerList = await headers();
  return pickTrustedIp(headerList.get("x-real-ip"), headerList.get("x-forwarded-for")) ?? "unknown";
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
