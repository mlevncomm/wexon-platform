"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

type BranchOption = { id: string; name: string; restaurantName: string };

type TabItem = {
  label: string;
  path: string;
  branchScoped?: boolean;
};

const tabs: TabItem[] = [
  { label: "Genel Bakış", path: "/apps/wexpay", branchScoped: true },
  { label: "Masalar", path: "/apps/wexpay/tables", branchScoped: true },
  { label: "Mutfak", path: "/apps/wexpay/kitchen", branchScoped: true },
  { label: "Siparişler", path: "/apps/wexpay/orders", branchScoped: true },
  { label: "Menü", path: "/apps/wexpay/menu", branchScoped: true },
  { label: "Ödemeler", path: "/apps/wexpay/payments", branchScoped: true },
  { label: "Raporlar", path: "/apps/wexpay/reports", branchScoped: true },
  { label: "Paket / Lisans", path: "/apps/wexpay/settings" },
  { label: "Restoranlar", path: "/apps/wexpay/restaurants" },
  { label: "Şubeler", path: "/apps/wexpay/branches" },
];

function buildHref(path: string, branchId: string | null, branchScoped: boolean | undefined, organizationId: string | null) {
  const params = new URLSearchParams();
  if (organizationId) params.set("organizationId", organizationId);
  if (branchScoped && branchId) params.set("branchId", branchId);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function isActiveTab(pathname: string, tabPath: string) {
  if (tabPath === "/apps/wexpay") return pathname === "/apps/wexpay";
  return pathname === tabPath || pathname.startsWith(`${tabPath}/`);
}

function isBranchScopedPath(pathname: string) {
  return (
    pathname === "/apps/wexpay" ||
    pathname.startsWith("/apps/wexpay/tables") ||
    pathname.startsWith("/apps/wexpay/kitchen") ||
    pathname.startsWith("/apps/wexpay/orders") ||
    pathname.startsWith("/apps/wexpay/menu") ||
    pathname.startsWith("/apps/wexpay/payments") ||
    pathname.startsWith("/apps/wexpay/reports")
  );
}

function ShellPackageCard({
  planName,
  licenseStatus,
  dashboardHref,
  className = "",
  onNavigate,
}: {
  planName: string;
  licenseStatus: string;
  dashboardHref: string;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-3.5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-bold tracking-wide text-white">
          WP
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">Aktif paket</p>
          <p className="truncate text-sm font-semibold text-slate-900">{planName}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          {licenseStatus}
        </span>
      </div>
      <Link
        href={dashboardHref}
        onClick={onNavigate}
        className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        <span>Wexon Core paneli</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm text-white" aria-hidden>
          →
        </span>
      </Link>
    </div>
  );
}

export default function WexPayBusinessShell({
  organizationName,
  organizationId,
  isAdminPreview = false,
  branches,
  packageInfo,
  children,
}: {
  organizationName: string;
  organizationId: string;
  isAdminPreview?: boolean;
  branches: BranchOption[];
  packageInfo: { planName: string; licenseStatus: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const branchId = searchParams.get("branchId");
  const activeOrganizationId = searchParams.get("organizationId") ?? organizationId;
  const dashboardHref = activeOrganizationId
    ? `/dashboard?organizationId=${encodeURIComponent(activeOrganizationId)}`
    : "/dashboard";
  const activeBranch =
    branches.find((branch) => branch.id === branchId) ?? branches[0] ?? null;
  const headerTitle = activeBranch
    ? `${activeBranch.restaurantName} operasyon merkezi`
    : `${organizationName} operasyon merkezi`;
  const headerDescription = activeBranch
    ? `${activeBranch.name} şubesinin sipariş, masa, ödeme ve fiş taleplerini tek panelde takip edin.`
    : "QR menü, sipariş, masa, ödeme, fiş talebi ve lisans yönetimini tek panelde takip edin.";
  const activeTab = tabs.find((tab) => isActiveTab(pathname, tab.path)) ?? tabs[0];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f4f7f5] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-5 lg:px-6 xl:px-8">
          <div className="flex h-14 items-center justify-between gap-3 sm:hidden">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-emerald-600">WexPay</p>
              <p className="truncate text-sm font-semibold text-slate-900">
                {activeBranch?.restaurantName ?? organizationName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
              aria-expanded={mobileMenuOpen}
              aria-label="Menüyü aç"
            >
              <span className="text-lg leading-none">{mobileMenuOpen ? "×" : "≡"}</span>
            </button>
          </div>

          <div className="hidden border-b border-slate-100 py-4 sm:block">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-emerald-600">WexPay İşletme Paneli</p>
                  {isAdminPreview ? (
                    <>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                        Admin önizleme
                      </span>
                      <Link
                        href={`/admin/organizations/${organizationId}`}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-600 hover:text-emerald-700"
                      >
                        Admin detay →
                      </Link>
                    </>
                  ) : null}
                </div>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 lg:text-2xl">{headerTitle}</h1>
                <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{headerDescription}</p>
              </div>
              <ShellPackageCard
                planName={packageInfo.planName}
                licenseStatus={packageInfo.licenseStatus}
                dashboardHref={dashboardHref}
                className="w-full shrink-0 sm:max-w-sm lg:w-auto lg:min-w-[240px]"
              />
            </div>
          </div>

          <div className="hidden items-center gap-1 overflow-x-auto py-2 sm:flex">
            {tabs.map((tab) => {
              const active = isActiveTab(pathname, tab.path);
              return (
                <Link
                  key={tab.path}
                  href={buildHref(tab.path, activeBranch?.id ?? branchId, tab.branchScoped, activeOrganizationId)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {branches.length > 1 ? (
            <div className="hidden gap-2 overflow-x-auto border-t border-slate-100 py-2 sm:flex">
              {branches.map((branch) => {
                const active = branch.id === (activeBranch?.id ?? branchId);
                const branchHref = isBranchScopedPath(pathname)
                  ? buildHref(pathname, branch.id, true, activeOrganizationId)
                  : buildHref("/apps/wexpay", branch.id, true, activeOrganizationId);
                return (
                  <Link
                    key={branch.id}
                    href={branchHref}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {branch.restaurantName} · {branch.name}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {mobileMenuOpen ? (
            <div className="border-t border-slate-100 pb-3 pt-2 sm:hidden">
              <p className="mb-2 px-1 text-xs text-slate-500">
                {activeBranch?.name ?? "İşletme"} · {activeTab.label}
              </p>
              <nav className="space-y-0.5">
                {tabs.map((tab) => {
                  const active = isActiveTab(pathname, tab.path);
                  return (
                    <Link
                      key={tab.path}
                      href={buildHref(tab.path, activeBranch?.id ?? branchId, tab.branchScoped, activeOrganizationId)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
              {branches.length > 1 ? (
                <div className="mt-3 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">
                  {branches.map((branch) => {
                    const active = branch.id === (activeBranch?.id ?? branchId);
                    const branchHref = isBranchScopedPath(pathname)
                      ? buildHref(pathname, branch.id, true, activeOrganizationId)
                      : buildHref("/apps/wexpay", branch.id, true, activeOrganizationId);
                    return (
                      <Link
                        key={branch.id}
                        href={branchHref}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                          active ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {branch.name}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
              <ShellPackageCard
                planName={packageInfo.planName}
                licenseStatus={packageInfo.licenseStatus}
                dashboardHref={dashboardHref}
                className="mt-3"
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1920px] px-4 py-6 sm:px-5 lg:px-6 xl:px-8">{children}</main>
    </div>
  );
}
