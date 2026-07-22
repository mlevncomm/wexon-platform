"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildOperationsSnapshotSignature } from "@/lib/wexpay-live-refresh";

/** Soft-live SSR refresh for kitchen/cashier boards (≤10s). */
export const WEXPAY_LIVE_REFRESH_MS = 8_000;

type LiveRefreshOptions = {
  enabled?: boolean;
  /** When set, poll snapshot first and only router.refresh when signature changes. */
  organizationId?: string;
  branchId?: string;
};

/**
 * Kitchen/cashier live updates: prefer lightweight snapshot polling and only
 * trigger a full RSC refresh when the operational signature changes.
 */
export function useWexPayLiveRefresh(enabledOrOptions: boolean | LiveRefreshOptions = true) {
  const options: LiveRefreshOptions =
    typeof enabledOrOptions === "boolean" ? { enabled: enabledOrOptions } : enabledOrOptions;
  const enabled = options.enabled ?? true;
  const organizationId = options.organizationId;
  const branchId = options.branchId;

  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = async () => {
      if (document.visibilityState === "hidden" || cancelled) return;

      if (organizationId && branchId) {
        try {
          const response = await fetch(
            `/api/wexpay/operations/snapshot?organizationId=${encodeURIComponent(organizationId)}&branchId=${encodeURIComponent(branchId)}`,
            { credentials: "include" },
          );
          if (!response.ok || cancelled) return;
          const payload = (await response.json()) as {
            metrics?: Record<string, unknown>;
            openTablesCount?: number;
            notifications?: Array<{ id?: string; createdAt?: string }>;
            generatedAt?: string;
          };
          const signature = buildOperationsSnapshotSignature(payload);
          if (lastSignature.current === null) {
            lastSignature.current = signature;
            setLastUpdated(payload.generatedAt ?? new Date().toISOString());
            return;
          }
          if (signature === lastSignature.current) {
            setLastUpdated(payload.generatedAt ?? new Date().toISOString());
            return;
          }
          lastSignature.current = signature;
          router.refresh();
          setLastUpdated(payload.generatedAt ?? new Date().toISOString());
          return;
        } catch {
          // Fall through to full refresh on transport errors.
        }
      }

      router.refresh();
      setLastUpdated(new Date().toISOString());
    };

    const interval = window.setInterval(() => {
      void tick();
    }, WEXPAY_LIVE_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [branchId, enabled, organizationId, router]);

  return lastUpdated;
}
