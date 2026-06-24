"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Route-level page enter animation. Keyed by pathname only so query-string
 * updates (e.g. WexPay branchId polling) do not re-trigger transitions.
 */
export default function WexonRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="wx-page-shell wx-page-enter min-h-full flex flex-1 flex-col">
      {children}
    </div>
  );
}
