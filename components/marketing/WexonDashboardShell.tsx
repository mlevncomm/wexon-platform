import type { ReactNode } from "react";
import { Suspense } from "react";
import WexonDashboardNav from "@/components/marketing/WexonDashboardNav";
import WexonDashboardProfileMenu from "@/components/marketing/WexonDashboardProfileMenu";
import { getAdminSession } from "@/lib/wexon-admin-auth";
import { canManageOrganizationUsers, getCurrentCustomerUser } from "@/lib/wexon-customer-auth";
import { formatCoreStatus } from "@/lib/wexon-core-dashboard";
import { readActiveOrganizationId, wexpayHref } from "@/lib/wexon-organization-context";
import { publicUrl } from "@/lib/wexon/urls";

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
    <div className="min-h-screen overflow-x-clip bg-[#f6f8f7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-emerald-300">
              W
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">Wexon Core</p>
              <p className="truncate text-xs font-semibold text-slate-500">Müşteri Paneli</p>
            </div>
          </div>

          {adminSession ? (
            <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Admin önizleme</span>
            </div>
          ) : null}

          <div className="flex shrink-0 items-center gap-2">
            <a href={publicUrl("/contact")} className="wx-interactive hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex">
              Destek
            </a>
            <a href={wexpayAppHref} className="wx-interactive hidden rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white hover:bg-emerald-600 lg:inline-flex">
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

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1360px] min-w-0 items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="min-w-0 lg:self-start">
            <div className="w-full min-w-0 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/70 lg:sticky lg:top-24 lg:rounded-[28px] lg:p-3.5">
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 lg:mb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    Wexon Core
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">Müşteri Paneli</p>
                  {customerUser?.email && (
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={customerUser.email}>
                      {customerUser.email}
                    </p>
                  )}
                  {customerUser?.mustChangePassword && (
                    <p className="mt-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">Şifre değişimi gerekli</p>
                  )}
                  {!customerUser && adminSession && (
                    <p className="mt-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">Admin önizleme</p>
                  )}
                </div>
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-xs font-black text-white lg:flex">
                  W
                </span>
              </div>
              <WexonDashboardNav />
            </div>
          </aside>
          <div className="wx-panel-enter mx-auto w-full max-w-[1120px] min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
