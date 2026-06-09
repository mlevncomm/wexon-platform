"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { logoutCustomerAction } from "@/lib/wexon-customer-auth-actions";

type OrganizationOption = {
  id: string;
  name: string;
  roleLabel: string;
};

type MenuItem = {
  label: string;
  href: string;
  highlight?: boolean;
  accent?: boolean;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

function buildOrganizationHref(pathname: string, searchParams: URLSearchParams, organizationId: string) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("organizationId", organizationId);
  params.delete("organizationSlug");
  if (pathname.startsWith("/dashboard")) {
    return `${pathname}?${params.toString()}`;
  }
  return `/dashboard?organizationId=${encodeURIComponent(organizationId)}`;
}

export default function WexonDashboardProfileMenu({
  userInitial,
  userEmail,
  organizationName,
  organizationId,
  organizations = [],
  roleLabel,
  lastLoginLabel,
  mustChangePassword = false,
  showLogout = false,
  canManageUsers = false,
  isAdminPreview = false,
}: {
  userInitial: string;
  userEmail?: string | null;
  organizationName?: string | null;
  organizationId?: string | null;
  organizations?: OrganizationOption[];
  roleLabel?: string | null;
  lastLoginLabel?: string | null;
  mustChangePassword?: boolean;
  showLogout?: boolean;
  canManageUsers?: boolean;
  isAdminPreview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeOrganizationId = searchParams.get("organizationId") ?? organizationId ?? organizations[0]?.id ?? null;
  const organizationSlug = searchParams.get("organizationSlug");
  const displayOrganizationName =
    organizations.find((organization) => organization.id === activeOrganizationId)?.name ?? organizationName;

  const withOrganizationContext = useMemo(() => {
    return (path: string) => {
      if (activeOrganizationId) {
        return `${path}?organizationId=${encodeURIComponent(activeOrganizationId)}`;
      }
      if (organizationSlug) {
        return `${path}?organizationSlug=${encodeURIComponent(organizationSlug)}`;
      }
      return path;
    };
  }, [activeOrganizationId, organizationSlug]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const sections: MenuSection[] = [];

  if (showLogout) {
    sections.push({
      title: "Hesap",
      items: [
        { label: "Genel bakış", href: withOrganizationContext("/dashboard") },
        { label: "Aktiviteler", href: withOrganizationContext("/dashboard/activity") },
        {
          label: "Şifre değiştir",
          href: "/dashboard/change-password",
          highlight: mustChangePassword,
        },
      ],
    });

    sections.push({
      title: "Organizasyon",
      items: [
        { label: "Organizasyon ayarları", href: withOrganizationContext("/dashboard/organization") },
        ...(canManageUsers
          ? [{ label: "Kullanıcı yönetimi", href: withOrganizationContext("/dashboard/users") }]
          : []),
        { label: "Faturalar", href: withOrganizationContext("/dashboard/billing") },
        { label: "Lisans & abonelik", href: withOrganizationContext("/dashboard/subscription") },
      ],
    });

    sections.push({
      title: "Ürünler",
      items: [
        { label: "Ürünlerim", href: withOrganizationContext("/dashboard/products") },
        { label: "WexPay uygulaması", href: withOrganizationContext("/apps/wexpay"), accent: true },
        { label: "Entegrasyonlar", href: withOrganizationContext("/dashboard/integrations") },
      ],
    });
  } else {
    sections.push({
      title: "Oturum",
      items: [{ label: "Giriş yap", href: "/dashboard/login", highlight: true }],
    });
  }

  sections.push({
    title: "Yardım",
    items: [
      { label: "Destek talepleri", href: withOrganizationContext("/dashboard/support") },
      { label: "İletişim", href: "/contact" },
    ],
  });

  if (isAdminPreview) {
    sections.push({
      title: "Yönetim",
      items: [
        { label: "Admin paneli", href: "/admin" },
        ...(activeOrganizationId
          ? [{ label: "Müşteri admin detayı", href: `/admin/organizations/${activeOrganizationId}` }]
          : []),
        ...(activeOrganizationId
          ? [{ label: "WexPay operasyonları", href: withOrganizationContext("/apps/wexpay"), accent: true }]
          : []),
      ],
    });
  }

  sections.push({
    title: "Platform",
    items: [{ label: "Wexon ana site", href: "/" }],
  });

  const showOrganizationSwitcher = showLogout && organizations.length > 1;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Profil menüsü"
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 transition-all hover:bg-emerald-100 ${
          open ? "ring-2 ring-emerald-300" : ""
        }`}
      >
        {userInitial}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[min(80vh,640px)] w-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        >
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="truncate text-sm font-black text-slate-950">{userEmail ?? "Misafir kullanıcı"}</p>
            {displayOrganizationName ? (
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{displayOrganizationName}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {roleLabel ? (
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  {roleLabel}
                </span>
              ) : null}
              {isAdminPreview ? (
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                  Admin önizleme
                </span>
              ) : null}
            </div>
            {lastLoginLabel ? (
              <p className="mt-2 text-[11px] font-medium text-slate-400">Son giriş: {lastLoginLabel}</p>
            ) : null}
            {mustChangePassword ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                Şifre değişimi gerekli
              </p>
            ) : null}
          </div>

          {showOrganizationSwitcher ? (
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Organizasyon değiştir</p>
              <div className="space-y-1">
                {organizations.map((organization) => {
                  const active = organization.id === activeOrganizationId;
                  return (
                    <Link
                      key={organization.id}
                      href={buildOrganizationHref(pathname, new URLSearchParams(searchParams.toString()), organization.id)}
                      onClick={() => setOpen(false)}
                      className={`block rounded-xl px-3 py-2 transition-colors ${
                        active ? "bg-emerald-50 ring-1 ring-emerald-200/80" : "hover:bg-slate-50"
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{organization.name}</p>
                      <p className="text-[11px] font-medium text-slate-500">{organization.roleLabel}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="p-2">
            {sections.map((section) => (
              <div key={section.title} className="mb-1 last:mb-0">
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {section.title}
                </p>
                {section.items.map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      item.highlight
                        ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                        : item.accent
                          ? "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {showLogout ? (
            <div className="sticky bottom-0 border-t border-slate-100 bg-white p-2">
              <form action={logoutCustomerAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                >
                  Çıkış yap
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
