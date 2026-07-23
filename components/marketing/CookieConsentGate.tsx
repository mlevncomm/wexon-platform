import { headers } from "next/headers";
import CookieConsentBanner from "@/components/marketing/CookieConsentBanner";
import { isAdminHost, normalizeHost, resolveHostSurface } from "@/lib/wexon-canonical-host";

/**
 * Server gate: never mount the marketing cookie banner on the admin host.
 * Local `/admin` paths are additionally suppressed client-side in CookieConsentBanner
 * to avoid hydration mismatches (pathname is not always available in root layout headers).
 */
export default async function CookieConsentGate() {
  const headerStore = await headers();
  const host = normalizeHost(headerStore.get("host") ?? headerStore.get("x-forwarded-host"));

  if (isAdminHost(host) || resolveHostSurface(host) === "admin") {
    return null;
  }

  return <CookieConsentBanner />;
}
