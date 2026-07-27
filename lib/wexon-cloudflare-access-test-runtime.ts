/**
 * Shared host guard for local Cloudflare Access test login / JWT cookie injection.
 * Fail-closed: test mode alone is insufficient — request host must be loopback.
 */

import { isCloudflareAccessTestMode } from "@/lib/wexon-cloudflare-access-config";

/**
 * True for localhost / 127.0.0.1 / ::1, including bracketed IPv6 and `:port` forms.
 * Rejects empty, spoofed, or remote hosts.
 */
export function isLoopbackAdminHost(host: string | null | undefined): boolean {
  if (!host) return false;
  let value = host.trim().toLowerCase();
  if (!value) return false;

  // Strip trailing dots (DNS FQDN form).
  value = value.replace(/\.+$/, "");

  // [IPv6]:port or [IPv6]
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end <= 1) return false;
    const ipv6 = value.slice(1, end);
    return ipv6 === "::1";
  }

  // hostname:port — only split on last ':' when it looks like host:port (not bare ::1).
  if (value.includes(":") && !value.startsWith("::")) {
    const colon = value.lastIndexOf(":");
    const maybePort = value.slice(colon + 1);
    if (/^\d+$/.test(maybePort)) {
      value = value.slice(0, colon);
    }
  }

  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

/**
 * Local CF Access test runtime: env test mode AND loopback Host.
 * Login page, server action, and proxy must all use this gate.
 */
export function isLocalCloudflareAccessTestRuntime(host: string | null | undefined): boolean {
  return isCloudflareAccessTestMode() && isLoopbackAdminHost(host);
}

/**
 * Cookie `Secure` must be false for local/CI HTTP (`next start` + test mode),
 * otherwise browsers drop session cookies and admin login appears to succeed then bounce.
 * Production/preview never enable CF test mode, so Secure stays true there.
 */
export function adminCookieSecureFlag(): boolean {
  if (process.env.WEXON_CF_ACCESS_TEST_MODE === "1") return false;
  if (process.env.NODE_ENV === "test") return false;
  return process.env.NODE_ENV === "production";
}
