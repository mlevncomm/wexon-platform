"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { label: string; shortLabel: string; href: string; icon: string };

const items: NavItem[] = [
  { label: "Operasyon Merkezi", shortLabel: "Operasyon", href: "/apps/wexpay", icon: "overview" },
  { label: "Restoranlar", shortLabel: "Restoran", href: "/apps/wexpay/restaurants", icon: "restaurant" },
  { label: "Şubeler", shortLabel: "Şube", href: "/apps/wexpay/branches", icon: "branch" },
  { label: "Masalar", shortLabel: "Masa", href: "/apps/wexpay/tables", icon: "table" },
  { label: "Menü", shortLabel: "Menü", href: "/apps/wexpay/menu", icon: "menu" },
  { label: "Siparişler", shortLabel: "Sipariş", href: "/apps/wexpay/orders", icon: "order" },
  { label: "Ödemeler", shortLabel: "Ödeme", href: "/apps/wexpay/payments", icon: "payment" },
  { label: "Ayarlar", shortLabel: "Ayarlar", href: "/apps/wexpay/settings", icon: "settings" },
];

function NavIcon({ type }: { type: string }) {
  const className = "h-4 w-4";

  if (type === "restaurant") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 21V7l8-4 8 4v14" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "branch") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="M6 8.5v3a2 2 0 002 2h8a2 2 0 002-2v-3M12 13.5v2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "table") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 9h18M9 18v2M15 18v2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "menu") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 4h14v16l-7-3-7 3V4z" strokeLinejoin="round" />
        <path d="M9 8h6M9 11h6" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "order") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12v18l-2.5-1.5L13 21l-3-1.5L7 21l-1-1V3z" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h4" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "payment") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "settings") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" strokeLinecap="round" />
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

function isActiveHref(pathname: string, href: string) {
  return href === "/apps/wexpay" ? pathname === href : pathname.startsWith(href);
}

export default function WexPayAppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeItem = items.find((item) => isActiveHref(pathname, item.href)) ?? items[0];

  return (
    <div>
      {/* Mobile: collapsible dropdown trigger */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 ring-1 ring-slate-200 transition-colors hover:bg-emerald-50 lg:hidden"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <NavIcon type={activeItem.icon} />
          </span>
          {activeItem.label}
        </span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ↓
        </span>
      </button>

      {/* Mobile: grid menu */}
      <nav className={`${open ? "grid" : "hidden"} mt-3 grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden`}>
        {items.map((item) => {
          const active = isActiveHref(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`min-w-0 rounded-2xl px-3 py-2.5 text-center text-xs font-bold transition-colors sm:text-sm ${
                active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <NavIcon type={item.icon} />
              </span>
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>

      {/* Desktop: vertical nav */}
      <nav className="hidden flex-col gap-2 lg:flex">
        {items.map((item) => {
          const active = isActiveHref(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-all lg:px-4 ${
                active ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                  active ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"
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
