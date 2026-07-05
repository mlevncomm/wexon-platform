"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { dashboardNavigation } from "@/lib/wexon-core-navigation";
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

  if (type === "activity") {
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

export default function WexonDashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const organizationId = searchParams.get("organizationId");
  const organizationSlug = searchParams.get("organizationSlug");
  const contextQuery = organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : organizationSlug
      ? `?organizationSlug=${encodeURIComponent(organizationSlug)}`
      : "";
  const navigationHref = (href: string) =>
    href.startsWith("/apps/wexpay")
      ? appNavigationUrl(href, contextQuery)
      : coreNavigationUrl(href, contextQuery);
  const activeItem =
    dashboardNavigation.find((item) =>
      item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href),
    ) ?? dashboardNavigation[0];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 ring-1 ring-slate-200 transition-colors hover:bg-emerald-50 lg:hidden"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-[11px] font-black text-emerald-700">
            <NavIcon type={activeItem.icon} />
          </span>
          {activeItem.label}
        </span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ↓
        </span>
      </button>

      <nav className={`${open ? "grid" : "hidden"} mt-3 grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden`}>
        {dashboardNavigation.map((item) => {
          const isActive =
            item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={navigationHref(item.href)}
              onClick={() => setOpen(false)}
              className={`min-w-0 rounded-2xl px-3 py-2.5 text-center text-xs font-bold transition-colors sm:text-sm ${
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-xl bg-white text-[11px] font-black text-emerald-700 shadow-sm">
                <NavIcon type={item.icon} />
              </span>
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>

      <nav className="hidden flex-col gap-2 lg:flex">
        {dashboardNavigation.map((item) => {
          const isActive =
            item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={navigationHref(item.href)}
              className={`group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-all lg:px-4 ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                  isActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"
                }`}
              >
                <NavIcon type={item.icon} />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
