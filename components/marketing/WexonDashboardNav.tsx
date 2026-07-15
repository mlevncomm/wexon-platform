"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dashboardNavigation, dashboardNavSectionLabels } from "@/lib/wexon-core-navigation";
import { appNavigationUrl, coreNavigationUrl } from "@/lib/wexon/urls";

function NavIcon({ type }: { type: string }) {
  const className = "h-4 w-4";
  if (type === "products") {
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
  if (type === "billing") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "organization") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 21V7l8-4 8 4v14" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "users") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21a6 6 0 0112 0M17 11a3 3 0 100-6M17 21a6 6 0 014-5.5" strokeLinecap="round" />
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
  if (type === "activity" || type === "support") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "wexpay") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M8 10h8M8 14h5" strokeLinecap="round" />
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

function useNavHref() {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organizationId");
  const organizationSlug = searchParams.get("organizationSlug");
  const contextQuery = organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : organizationSlug
      ? `?organizationSlug=${encodeURIComponent(organizationSlug)}`
      : "";
  return (href: string) =>
    href.startsWith("/apps/wexpay") ? appNavigationUrl(href, contextQuery) : coreNavigationUrl(href, contextQuery);
}

function NavLinkItem({
  item,
  pathname,
  href,
  onNavigate,
}: {
  item: (typeof dashboardNavigation)[number];
  pathname: string;
  href: string;
  onNavigate?: () => void;
}) {
  const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group relative flex min-h-[44px] min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
        isActive
          ? "border border-emerald-100 bg-emerald-50 text-emerald-800"
          : "border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      {isActive ? (
        <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-emerald-500" aria-hidden />
      ) : null}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          isActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"
        }`}
      >
        <NavIcon type={item.icon} />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function DesktopNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const navigationHref = useNavHref();
  const sections = ["genel", "hesap", "yonetim", "destek"] as const;

  return (
    <nav className="flex flex-col gap-1" aria-label="Core menü">
      {sections.map((section) => {
        const items = dashboardNavigation.filter((item) => item.section === section);
        if (items.length === 0) return null;
        return (
          <div key={section} className="mb-3">
            <p className="mb-1.5 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              {dashboardNavSectionLabels[section]}
            </p>
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLinkItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  href={navigationHref(item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function WexonDashboardMobileNavDrawer({
  userEmail,
  mustChangePassword,
  isAdminPreview,
}: {
  userEmail?: string | null;
  mustChangePassword?: boolean;
  isAdminPreview?: boolean;
}) {
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
                className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p id={titleId} className="text-sm font-black text-slate-950">
                      Wexon Core
                    </p>
                    <p className="text-xs font-semibold text-slate-500">Navigasyon</p>
                    {userEmail ? <p className="mt-1 truncate text-xs font-semibold text-slate-400">{userEmail}</p> : null}
                    {mustChangePassword ? (
                      <p className="mt-1 text-[10px] font-black text-amber-800">Şifre değişimi gerekli</p>
                    ) : null}
                    {isAdminPreview ? (
                      <p className="mt-1 text-[10px] font-black text-amber-800">Admin önizleme</p>
                    ) : null}
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
                  <DesktopNavList onNavigate={close} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Desktop sidebar navigation (hidden on mobile — drawer used instead). */
export default function WexonDashboardNav() {
  return (
    <div className="hidden lg:block">
      <DesktopNavList />
    </div>
  );
}
