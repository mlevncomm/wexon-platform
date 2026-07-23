"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import CookieConsentBanner from "@/components/marketing/CookieConsentBanner";

/**
 * Client-only gate so root layout does not call `headers()` (avoids forcing
 * the entire app into dynamic rendering). Hydration-safe: renders nothing
 * until mounted, then hides on admin host / local `/admin` paths.
 */
export default function CookieConsentGate() {
  const pathname = usePathname() ?? "";
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    setHostname(window.location.hostname.toLowerCase());
  }, []);

  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminPath) return null;

  // Wait for mount before host-based decisions (production admin host uses `/login`).
  if (hostname === null) return null;

  if (hostname === "admin.wexon.dev" || hostname.startsWith("admin.")) {
    return null;
  }

  return <CookieConsentBanner />;
}
