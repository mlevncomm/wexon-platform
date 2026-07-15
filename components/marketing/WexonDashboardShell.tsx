import type { ReactNode } from "react";
import { Suspense } from "react";
import WexonDashboardNav, { WexonDashboardMobileNavDrawer } from "@/components/marketing/WexonDashboardNav";
import WexonDashboardProfileMenu from "@/components/marketing/WexonDashboardProfileMenu";
import { getAdminSession } from "@/lib/wexon-admin-auth";
import { canManageOrganizationUsers, getCurrentCustomerUser } from "@/lib/wexon-customer-auth";
import { formatCoreStatus } from "@/lib/wexon-core-dashboard";
import { readActiveOrganizationId, wexpayHref } from "@/lib/wexon-organization-context";
import { publicUrl } from "@/lib/wexon/urls";
import {
  WORKSPACE_CONTENT_MAX_PX,
  WORKSPACE_PAGE_PADDING,
  WORKSPACE_SIDEBAR_WIDTH_PX,
} from "@/lib/wexon-workspace-layout";

export default async function WexonDashboardShell({ children }: { children: ReactNode }) {
  const [customerUser, adminSession, activeOrganizationId] = await Promise.all([
    getCurrentCustomerUser(),
    getAdminSession(),
    readActiveOrganizationId(),
  ]);
  const wexpayAppHref = wexpayHref("/apps/wexpay", activeOrganizationId);
  const primaryMembership = customerUser?.memberships[0];
  const userInitial = customerUser?.email?.[0]?.toUpperCase() ?? "W";
  const organizations =
    customerUser?.memberships.map((membership) => ({
      id: membership.organizationId,
      name: membership.organization.name,
      roleLabel: formatCoreStatus(membership.role),
    })) ?? [];
  const lastLoginLabel = customerUser?.lastLoginAt
    ? new Date(customerUser.lastLoginAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="core-shell min-h-screen w-full overflow-x-clip bg-[#f6f8f7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
        <div className={`mx-auto flex h-16 w-full max-w-none items-center justify-between gap-3 ${WORKSPACE_PAGE_PADDING}`}>
          <div className="flex min-w-0 items-center gap-3">
            <Suspense fallback={<span className="inline-flex h-9 w-9 lg:hidden" aria-hidden />}>
              <WexonDashboardMobileNavDrawer
                userEmail={customerUser?.email}
                mustChangePassword={customerUser?.mustChangePassword ?? false}
                isAdminPreview={Boolean(adminSession) && !customerUser}
              />
            </Suspense>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-emerald-300">
              W
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">Wexon Core</p>
              <p className="truncate text-xs font-semibold text-slate-500">
                {primaryMembership?.organization.name ?? "Müşteri Paneli"}
              </p>
            </div>
          </div>

          {adminSession ? (
            <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 md:inline-flex">
              Admin önizleme
            </span>
          ) : null}

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={publicUrl("/contact")}
              className="wx-interactive hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Destek
            </a>
            <a
              href={wexpayAppHref}
              className="wx-interactive hidden rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white hover:bg-emerald-600 lg:inline-flex"
            >
              WexPay uygulaması
            </a>
            <Suspense
              fallback={
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                  {userInitial}
                </span>
              }
            >
              <WexonDashboardProfileMenu
                userInitial={userInitial}
                userEmail={customerUser?.email}
                organizationName={primaryMembership?.organization.name}
                organizationId={primaryMembership?.organizationId}
                organizations={organizations}
                roleLabel={primaryMembership ? formatCoreStatus(primaryMembership.role) : null}
                lastLoginLabel={lastLoginLabel}
                mustChangePassword={customerUser?.mustChangePassword ?? false}
                showLogout={Boolean(customerUser)}
                canManageUsers={primaryMembership ? canManageOrganizationUsers(primaryMembership.role) : false}
                isAdminPreview={Boolean(adminSession)}
              />
            </Suspense>
          </div>
        </div>
      </header>

      <div
        className="core-body mx-auto grid w-full min-w-0 lg:grid-cols-[var(--workspace-sidebar)_minmax(0,1fr)]"
        style={{ ["--workspace-sidebar" as string]: `${WORKSPACE_SIDEBAR_WIDTH_PX}px` }}
      >
        <aside className="hidden min-w-0 border-r border-slate-200/80 bg-white lg:sticky lg:top-16 lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col lg:self-start lg:overflow-y-auto">
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-5">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Wexon Core</p>
                <p className="mt-1 truncate text-sm font-black text-slate-950">
                  {primaryMembership?.organization.name ?? "Müşteri Paneli"}
                </p>
                {customerUser?.email ? (
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={customerUser.email}>
                    {customerUser.email}
                  </p>
                ) : null}
                {customerUser?.mustChangePassword ? (
                  <p className="mt-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">
                    Şifre değişimi gerekli
                  </p>
                ) : null}
                {!customerUser && adminSession ? (
                  <p className="mt-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">
                    Admin önizleme
                  </p>
                ) : null}
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black text-emerald-300">
                {userInitial}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <WexonDashboardNav />
            </div>
          </div>
        </aside>

        <div className={`core-content min-w-0 w-full ${WORKSPACE_PAGE_PADDING} py-4 sm:py-6 lg:py-7`}>
          <div
            className="wx-panel-enter mx-auto min-w-0 w-full max-w-none"
            style={{ maxWidth: `${WORKSPACE_CONTENT_MAX_PX}px` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
