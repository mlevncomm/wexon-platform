"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import CookieConsentBanner from "@/components/marketing/CookieConsentBanner";

const SSR_HOST = "";

function subscribeHostname() {
  // Hostname is stable for the page lifetime; no subscription needed.
  return () => {};
}

function getHostnameSnapshot() {
  return window.location.hostname.toLowerCase();
}

function getServerHostnameSnapshot() {
  return SSR_HOST;
}

/**
 * Client-only gate so root layout does not call `headers()` (avoids forcing
 * the entire app into dynamic rendering). Hydration-safe via useSyncExternalStore:
 * SSR/host-unknown renders nothing; after hydrate, hides on admin host / `/admin`.
 */
export default function CookieConsentGate() {
  const pathname = usePathname() ?? "";
  const hostname = useSyncExternalStore(subscribeHostname, getHostnameSnapshot, getServerHostnameSnapshot);

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminPath) return null;

  // SSR / first paint without host: hide to avoid admin-host flash on `/login`.
  if (!hostname) return null;

  if (hostname === "admin.wexon.dev" || hostname.startsWith("admin.")) {
    return null;
  }

  return <CookieConsentBanner />;
}
