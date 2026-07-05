import { headers } from "next/headers";

/** Best-effort client IP extraction from a Fetch `Request` for audit context. */
export function getRequestIpAddress(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }

  return request.headers.get("x-real-ip");
}

/** Best-effort IP extraction for Server Actions (login, etc.). */
export async function getServerActionIpAddress(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }

  return headerList.get("x-real-ip") ?? "unknown";
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
