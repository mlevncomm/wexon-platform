"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  adminNavigation,
  adminNavSectionLabels,
  adminSecondaryNavigation,
  type AdminNavItem,
} from "@/lib/wexon-admin-navigation";
import { adminNavigationUrl } from "@/lib/wexon/urls";

function AdminIcon({ type }: { type: string }) {
  const className = "h-4 w-4";
  if (type === "organization" || type === "customers") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 21V7l8-4 8 4v14" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "products" || type === "plans") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "license") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h8M17 12v4M20 12v3" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "billing" || type === "subscription") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "integrations") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 12h8M7 7l-4 5 4 5M17 7l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "activity") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "settings") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function isNavActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href || pathname === "/admin/" : pathname.startsWith(href);
}

function NavLinkItem({
  item,
  pathname,
  onNavigate,
}: {
  item: AdminNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = isNavActive(pathname, item.href);
  return (
    <Link
      href={adminNavigationUrl(item.href)}
      onClick={onNavigate}
      className={`group relative flex min-h-[44px] min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
        isActive
          ? "border border-emerald-200/80 bg-emerald-50 text-slate-950 shadow-sm shadow-emerald-900/5"
          : "border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      {isActive ? (
        <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-emerald-500" aria-hidden />
      ) : null}
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"
        }`}
      >
        <AdminIcon type={item.icon} />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

const SECTION_ORDER: Array<"operasyon" | "finans" | "sistem"> = ["operasyon", "finans", "sistem"];

/** Desktop vertical navigation with section labels. */
export function WexonAdminDesktopNav({ environmentBadge }: { environmentBadge?: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Admin menü">
      {SECTION_ORDER.map((section) => {
        const items = adminNavigation.filter((item) => item.section === section);
        if (items.length === 0) return null;
        return (
          <div key={section} className="mb-3">
            <p className="mb-1.5 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              {adminNavSectionLabels[section]}
            </p>
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLinkItem key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="my-2 border-t border-slate-200/80" />
      <p className="mb-1.5 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
        {adminNavSectionLabels.teknik}
      </p>
      <div className="flex flex-col gap-1">
        {adminSecondaryNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={adminNavigationUrl(item.href)}
              className={`min-h-[42px] rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                isActive ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {environmentBadge ? (
        <div className="mt-auto border-t border-slate-200/80 pt-4">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            {environmentBadge}
          </span>
        </div>
      ) : null}
    </nav>
  );
}

/** Accessible off-canvas mobile/tablet navigation drawer. */
export function WexonAdminMobileNavDrawer({ environmentBadge }: { environmentBadge?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, [close, open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden"
        aria-label="Menüyü aç"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-slate-950/40"
                aria-label="Menü arka planını kapat"
                onClick={close}
              />
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl shadow-slate-900/20"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p id={titleId} className="text-sm font-black text-slate-950">
                      Wexon Admin
                    </p>
                    <p className="text-xs font-semibold text-slate-500">Navigasyon</p>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={close}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    aria-label="Menüyü kapat"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <div className="flex flex-col gap-1">
                    {adminNavigation.map((item) => (
                      <NavLinkItem key={item.href} item={item} pathname={pathname} onNavigate={close} />
                    ))}
                  </div>
                  <div className="my-4 border-t border-slate-200" />
                  <p className="mb-1.5 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {adminNavSectionLabels.teknik}
                  </p>
                  <div className="flex flex-col gap-1">
                    {adminSecondaryNavigation.map((item) => {
                      const isActive = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={adminNavigationUrl(item.href)}
                          onClick={close}
                          className={`min-h-[42px] rounded-xl px-3 py-2.5 text-sm font-bold ${
                            isActive ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                  {environmentBadge ? (
                    <div className="mt-6 px-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {environmentBadge}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** @deprecated Prefer WexonAdminDesktopNav — kept name for imports during transition. */
export default function WexonAdminNav({ environmentBadge }: { environmentBadge?: string }) {
  return <WexonAdminDesktopNav environmentBadge={environmentBadge} />;
}
