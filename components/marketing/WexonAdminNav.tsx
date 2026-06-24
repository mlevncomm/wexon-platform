"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { adminNavigation, adminSecondaryNavigation } from "@/lib/wexon-admin-navigation";
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

export default function WexonAdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeItem =
    adminNavigation.find((item) => (item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href))) ??
    adminNavigation[0];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 ring-1 ring-slate-200 transition-colors hover:bg-emerald-50 lg:hidden"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <AdminIcon type={activeItem.icon} />
          </span>
          {activeItem.label}
        </span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ↓
        </span>
      </button>

      <nav className={`${open ? "grid" : "hidden"} mt-3 grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden`}>
        {adminNavigation.map((item) => {
          const isActive = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={adminNavigationUrl(item.href)}
              onClick={() => setOpen(false)}
              className={`min-w-0 rounded-2xl px-3 py-2.5 text-center text-xs font-bold transition-colors sm:text-sm ${
                isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <AdminIcon type={item.icon} />
              </span>
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>

      <nav className="hidden flex-col gap-2 lg:flex">
        {adminNavigation.map((item) => {
          const isActive = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={adminNavigationUrl(item.href)}
              className={`group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-all lg:px-4 ${
                isActive ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${isActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"}`}>
                <AdminIcon type={item.icon} />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <div className="my-3 border-t border-slate-100" />
        <p className="px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Teknik</p>
        {adminSecondaryNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={adminNavigationUrl(item.href)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                isActive ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
