import type { ReactNode } from "react";
import WexonAdminHeaderToolbar from "@/components/marketing/WexonAdminHeaderToolbar";
import WexonAdminNav from "@/components/marketing/WexonAdminNav";
import { getAdminHeaderSnapshot } from "@/lib/wexon-admin";
import { getAdminSession } from "@/lib/wexon-admin-auth";
import {
  ADMIN_CONTENT_MAX_PX,
  ADMIN_PAGE_PADDING,
  ADMIN_SIDEBAR_WIDTH_PX,
  resolveAdminEnvironmentBadge,
} from "@/lib/wexon-admin-layout";

export default async function WexonAdminShell({ children }: { children: ReactNode }) {
  const [session, snapshot] = await Promise.all([getAdminSession(), getAdminHeaderSnapshot()]);
  const userInitial = session?.email?.[0]?.toUpperCase() ?? "A";
  const environmentBadge = resolveAdminEnvironmentBadge();

  return (
    <div className="admin-shell min-h-screen w-full overflow-x-clip bg-[#f6f8f7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
        <div className={`mx-auto w-full max-w-none ${ADMIN_PAGE_PADDING}`}>
          <WexonAdminHeaderToolbar
            snapshot={snapshot}
            userInitial={userInitial}
            userEmail={session?.email}
            environmentBadge={environmentBadge}
          />
        </div>
      </header>

      <div
        className="admin-body mx-auto grid w-full min-w-0 lg:grid-cols-[var(--admin-sidebar)_minmax(0,1fr)]"
        style={{ ["--admin-sidebar" as string]: `${ADMIN_SIDEBAR_WIDTH_PX}px` }}
      >
        <aside className="hidden min-w-0 border-r border-slate-200/80 bg-white lg:sticky lg:top-16 lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col lg:self-start lg:overflow-y-auto">
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-5">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Wexon Admin</p>
                <p className="mt-1 text-sm font-black text-slate-950">İç Yönetim Paneli</p>
                {session?.email ? (
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={session.email}>
                    {session.email}
                  </p>
                ) : null}
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black text-emerald-300">
                {userInitial}
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <WexonAdminNav environmentBadge={environmentBadge} />
            </div>
          </div>
        </aside>

        <div className={`admin-content min-w-0 w-full ${ADMIN_PAGE_PADDING} py-4 sm:py-6 lg:py-7`}>
          <div
            className="wx-panel-enter mx-auto min-w-0 w-full max-w-none"
            style={{ maxWidth: `${ADMIN_CONTENT_MAX_PX}px` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
