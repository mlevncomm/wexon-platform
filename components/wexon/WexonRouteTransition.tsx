"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Route-level page enter animation. Keyed by pathname only so query-string
 * updates (e.g. WexPay branchId polling) do not re-trigger transitions.
 * Replays CSS animation without remounting children for smoother navigation.
 */
export default function WexonRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const shellRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    shell.classList.remove("wx-page-enter");
    void shell.offsetWidth;
    shell.classList.add("wx-page-enter");
  }, [pathname]);

  return (
    <div ref={shellRef} className="wx-page-shell wx-page-enter min-h-full flex flex-1 flex-col">
      {children}
    </div>
  );
}
