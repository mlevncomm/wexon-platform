"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Soft-live SSR refresh for kitchen/cashier boards (≤10s). */
export const WEXPAY_LIVE_REFRESH_MS = 8_000;

export function useWexPayLiveRefresh(enabled = true) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      router.refresh();
      setLastUpdated(new Date().toISOString());
    };

    const interval = window.setInterval(tick, WEXPAY_LIVE_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, router]);

  return lastUpdated;
}
