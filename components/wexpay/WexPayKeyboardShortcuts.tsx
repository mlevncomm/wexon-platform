"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { appNavigationUrl } from "@/lib/wexon/urls";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

const HELP_ROWS: Array<{ keys: string; label: string }> = [
  { keys: "/", label: "Aramaya odaklan" },
  { keys: "g t", label: "Masalar" },
  { keys: "g o", label: "Siparişler" },
  { keys: "g k", label: "Mutfak" },
  { keys: "g m", label: "Menü" },
  { keys: "n", label: "Yeni sipariş (masalar)" },
  { keys: "Esc", label: "Drawer / yardım kapat" },
  { keys: "?", label: "Bu yardımı aç" },
];

export function WexPayShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0" aria-label="Yardımı kapat" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Klavye kısayolları"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Kısayollar</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">Hızlı navigasyon</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Ödeme alma, iptal, masa kapatma ve pasife alma kısayola bağlı değildir.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-2">
          {HELP_ROWS.map((row) => (
            <li key={row.keys} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700">{row.label}</span>
              <kbd className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-bold text-slate-800">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Safe ops navigation shortcuts — no finance/destructive mutations. */
export default function WexPayKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const withOrgBranch = useCallback(
    (path: string, extra?: Record<string, string>) => {
      const params = new URLSearchParams();
      const organizationId = searchParams.get("organizationId");
      const branchId = searchParams.get("branchId");
      if (organizationId) params.set("organizationId", organizationId);
      if (branchId) params.set("branchId", branchId);
      if (extra) {
        for (const [key, value] of Object.entries(extra)) params.set(key, value);
      }
      return appNavigationUrl(path, params.toString());
    },
    [searchParams],
  );

  useEffect(() => {
    function clearG() {
      pendingG.current = false;
      if (gTimer.current) clearTimeout(gTimer.current);
      gTimer.current = null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        if (helpOpen) {
          event.preventDefault();
          setHelpOpen(false);
        }
        clearG();
        return;
      }

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setHelpOpen((open) => !open);
        clearG();
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        const search = document.querySelector<HTMLInputElement>("[data-wexpay-search]");
        search?.focus();
        clearG();
        return;
      }

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        router.push(withOrgBranch("/apps/wexpay/tables", { composer: "1" }));
        clearG();
        return;
      }

      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        pendingG.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(clearG, 900);
        return;
      }

      if (pendingG.current) {
        const key = event.key.toLowerCase();
        const map: Record<string, string> = {
          t: "/apps/wexpay/tables",
          o: "/apps/wexpay/orders",
          k: "/apps/wexpay/kitchen",
          m: "/apps/wexpay/menu",
        };
        if (map[key]) {
          event.preventDefault();
          router.push(withOrgBranch(map[key]!));
        }
        clearG();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearG();
    };
  }, [helpOpen, pathname, router, withOrgBranch]);

  return <WexPayShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
