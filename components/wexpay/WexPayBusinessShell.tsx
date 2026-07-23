"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adminNavigationUrl, appNavigationUrl, coreNavigationUrl } from "@/lib/wexon/urls";
import {
  WORKSPACE_CONTENT_MAX_PX,
  WORKSPACE_PAGE_PADDING,
  WORKSPACE_SIDEBAR_WIDTH_PX,
} from "@/lib/wexon-workspace-layout";

type BranchOption = { id: string; name: string; restaurantName: string };

type TabItem = {
  label: string;
  path: string;
  branchScoped?: boolean;
};

/** Suffixes relative to basePath — plan order for sidebar. */
const tabDefs: Array<{ label: string; suffix: string; branchScoped?: boolean }> = [
  { label: "Genel Bakış", suffix: "", branchScoped: true },
  { label: "Siparişler", suffix: "/orders", branchScoped: true },
  { label: "Masalar", suffix: "/tables", branchScoped: true },
  { label: "Menü", suffix: "/menu", branchScoped: true },
  { label: "Mutfak", suffix: "/kitchen", branchScoped: true },
  { label: "Ödemeler", suffix: "/payments", branchScoped: true },
  { label: "Raporlar", suffix: "/reports", branchScoped: true },
  { label: "Restoranlar", suffix: "/restaurants" },
  { label: "Şubeler", suffix: "/branches" },
  { label: "Paket / Lisans", suffix: "/settings" },
];

type ShellFeatures = {
  multiLocation: boolean;
  csvExport: boolean;
  advancedReports: boolean;
  /** OWNER/ADMIN only — hide Paket/Lisans nav when false. */
  settings?: boolean;
};

function normalizeBasePath(basePath: string) {
  const trimmed = basePath.replace(/\/+$/, "");
  return trimmed || "/apps/wexpay";
}

function buildTabs(basePath: string): TabItem[] {
  const base = normalizeBasePath(basePath);
  return tabDefs.map((tab) => ({
    label: tab.label,
    path: `${base}${tab.suffix}`,
    branchScoped: tab.branchScoped,
  }));
}

function buildHref(
  path: string,
  branchId: string | null,
  branchScoped: boolean | undefined,
  organizationId: string | null,
  basePath: string,
) {
  const params = new URLSearchParams();
  // Admin preview encodes org in the path — avoid leaking org query on that surface.
  if (organizationId && !normalizeBasePath(basePath).startsWith("/admin/organizations/")) {
    params.set("organizationId", organizationId);
  }
  if (branchScoped && branchId) params.set("branchId", branchId);
  const query = params.toString();
  if (normalizeBasePath(basePath).startsWith("/admin/organizations/")) {
    return query ? `${path}?${query}` : path;
  }
  return appNavigationUrl(path, query);
}

function isActiveTab(pathname: string, tabPath: string, basePath: string) {
  const base = normalizeBasePath(basePath);
  if (tabPath === base) return pathname === base || pathname === `${base}/`;
  return pathname === tabPath || pathname.startsWith(`${tabPath}/`);
}

function isBranchScopedPath(pathname: string, basePath: string) {
  const base = normalizeBasePath(basePath);
  return (
    pathname === base ||
    pathname === `${base}/` ||
    pathname.startsWith(`${base}/tables`) ||
    pathname.startsWith(`${base}/kitchen`) ||
    pathname.startsWith(`${base}/orders`) ||
    pathname.startsWith(`${base}/menu`) ||
    pathname.startsWith(`${base}/payments`) ||
    pathname.startsWith(`${base}/reports`)
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

function NavLinks({
  pathname,
  activeBranchId,
  branchId,
  organizationId,
  features,
  basePath,
  onNavigate,
}: {
  pathname: string;
  activeBranchId: string | null;
  branchId: string | null;
  organizationId: string | null;
  features: ShellFeatures;
  basePath: string;
  onNavigate?: () => void;
}) {
  const tabs = buildTabs(basePath);
  const settingsPath = `${normalizeBasePath(basePath)}/settings`;
  const reportsPath = `${normalizeBasePath(basePath)}/reports`;
  const branchesPath = `${normalizeBasePath(basePath)}/branches`;
  const visibleTabs =
    features.settings === false ? tabs.filter((tab) => tab.path !== settingsPath) : tabs;

  return (
    <nav className="flex flex-col gap-0.5" aria-label="WexPay navigasyon">
      {visibleTabs.map((tab) => {
        const active = isActiveTab(pathname, tab.path, basePath);
        const lockedHint =
          tab.path === reportsPath && !features.advancedReports && !features.csvExport
            ? " · Temel"
            : tab.path === branchesPath && !features.multiLocation
              ? " · Tek şube"
              : "";
        return (
          <Link
            key={tab.path}
            href={buildHref(tab.path, activeBranchId ?? branchId, tab.branchScoped, organizationId, basePath)}
            onClick={onNavigate}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {tab.label}
            {lockedHint ? (
              <span className={`ml-1 text-[10px] font-bold ${active ? "text-white/70" : "text-slate-400"}`}>
                {lockedHint}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavDrawer({
  open,
  onClose,
  pathname,
  activeBranch,
  branchId,
  organizationId,
  branches,
  packageInfo,
  dashboardHref,
  features,
  basePath,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  activeBranch: BranchOption | null;
  branchId: string | null;
  organizationId: string | null;
  branches: BranchOption[];
  packageInfo: { planName: string; licenseStatus: string };
  dashboardHref: string;
  features: ShellFeatures;
  basePath: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] lg:hidden" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label="Menüyü kapat" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(20rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p id={titleId} className="text-sm font-black text-slate-950">
              WexPay menü
            </p>
            <p className="truncate text-xs font-semibold text-slate-500">{activeBranch?.name ?? "İşletme"}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
            aria-label="Menüyü kapat"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks
            pathname={pathname}
            activeBranchId={activeBranch?.id ?? null}
            branchId={branchId}
            organizationId={organizationId}
            features={features}
            basePath={basePath}
            onNavigate={onClose}
          />
          {branches.length > 1 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Şubeler</p>
              <div className="flex flex-col gap-1">
                {branches.map((branch) => {
                  const active = branch.id === (activeBranch?.id ?? branchId);
                  const branchHref = isBranchScopedPath(pathname, basePath)
                    ? buildHref(pathname, branch.id, true, organizationId, basePath)
                    : buildHref(normalizeBasePath(basePath), branch.id, true, organizationId, basePath);
                  return (
                    <Link
                      key={branch.id}
                      href={branchHref}
                      onClick={onClose}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                        active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {branch.restaurantName} · {branch.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-slate-100 p-3">
          <ShellPackageCard
            planName={packageInfo.planName}
            licenseStatus={packageInfo.licenseStatus}
            dashboardHref={dashboardHref}
            onNavigate={onClose}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function WexPayBusinessShell({
  organizationName,
  organizationId,
  isAdminPreview = false,
  basePath = "/apps/wexpay",
  branches,
  packageInfo,
  features = { multiLocation: true, csvExport: true, advancedReports: true },
  children,
}: {
  organizationName: string;
  organizationId: string;
  isAdminPreview?: boolean;
  /** Panel route prefix — `/apps/wexpay` or admin preview base. */
  basePath?: string;
  branches: BranchOption[];
  packageInfo: { planName: string; licenseStatus: string };
  features?: ShellFeatures;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileMenuOpen(false), []);
  const branchId = searchParams.get("branchId");
  const activeOrganizationId = searchParams.get("organizationId") ?? organizationId;
  const dashboardHref = activeOrganizationId
    ? coreNavigationUrl("/dashboard", `organizationId=${encodeURIComponent(activeOrganizationId)}`)
    : coreNavigationUrl("/dashboard");
  const activeBranch = branches.find((branch) => branch.id === branchId) ?? branches[0] ?? null;
  const headerTitle = activeBranch
    ? `${activeBranch.restaurantName} operasyon`
    : `${organizationName} operasyon`;
  const headerDescription = activeBranch
    ? `${activeBranch.name} · sipariş, masa, ödeme`
    : "QR menü, sipariş, masa ve lisans";

  return (
    <div className="wexpay-shell min-h-screen w-full overflow-x-clip bg-[#f4f7f5] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
        <div className={`mx-auto flex h-16 w-full items-center justify-between gap-3 ${WORKSPACE_PAGE_PADDING}`}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Menüyü aç"
            >
              <span className="text-lg leading-none">≡</span>
            </button>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-[10px] font-black text-emerald-300">
              WP
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">WexPay</p>
              <p className="truncate text-xs font-semibold text-slate-500">{headerTitle}</p>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-center px-4 xl:flex">
            <p className="truncate text-xs font-semibold text-slate-500">{headerDescription}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isAdminPreview ? (
              <>
                <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 sm:inline-flex">
                  Admin önizleme
                </span>
                <Link
                  href={adminNavigationUrl(`/admin/organizations/${organizationId}`)}
                  className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:text-emerald-700 sm:inline-flex"
                >
                  Admin →
                </Link>
              </>
            ) : null}
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800 md:inline-flex">
              {packageInfo.planName}
            </span>
            <Link
              href={dashboardHref}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Core
            </Link>
          </div>
        </div>

        {branches.length > 1 ? (
          <div className={`flex gap-2 overflow-x-auto border-t border-slate-100 py-2 ${WORKSPACE_PAGE_PADDING}`}>
            {branches.map((branch) => {
              const active = branch.id === (activeBranch?.id ?? branchId);
              const branchHref = isBranchScopedPath(pathname, basePath)
                ? buildHref(pathname, branch.id, true, activeOrganizationId, basePath)
                : buildHref(normalizeBasePath(basePath), branch.id, true, activeOrganizationId, basePath);
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
      </header>

      <div
        className="wexpay-body mx-auto grid w-full min-w-0 lg:grid-cols-[var(--workspace-sidebar)_minmax(0,1fr)]"
        style={{ ["--workspace-sidebar" as string]: `${WORKSPACE_SIDEBAR_WIDTH_PX}px` }}
      >
        <aside className="hidden min-w-0 border-r border-slate-200/80 bg-white lg:sticky lg:top-16 lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col lg:self-start lg:overflow-y-auto">
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-5">
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">WexPay</p>
              <p className="mt-1 truncate text-sm font-black text-slate-950">
                {activeBranch?.restaurantName ?? organizationName}
              </p>
              {activeBranch ? (
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{activeBranch.name}</p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavLinks
                pathname={pathname}
                activeBranchId={activeBranch?.id ?? null}
                branchId={branchId}
                organizationId={activeOrganizationId}
                features={features}
                basePath={basePath}
              />
            </div>
            <ShellPackageCard
              planName={packageInfo.planName}
              licenseStatus={packageInfo.licenseStatus}
              dashboardHref={dashboardHref}
            />
          </div>
        </aside>

        <main className={`wexpay-content min-w-0 w-full ${WORKSPACE_PAGE_PADDING} py-4 sm:py-6 lg:py-7`}>
          <div
            className="wx-panel-enter mx-auto min-w-0 w-full"
            style={{ maxWidth: `${WORKSPACE_CONTENT_MAX_PX}px` }}
          >
            {children}
          </div>
        </main>
      </div>

      <MobileNavDrawer
        open={mobileMenuOpen}
        onClose={closeMobile}
        pathname={pathname}
        activeBranch={activeBranch}
        branchId={branchId}
        organizationId={activeOrganizationId}
        branches={branches}
        packageInfo={packageInfo}
        dashboardHref={dashboardHref}
        features={features}
        basePath={basePath}
      />
    </div>
  );
}
