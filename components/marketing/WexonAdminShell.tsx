import type { ReactNode } from "react";
import WexonAdminHeaderToolbar from "@/components/marketing/WexonAdminHeaderToolbar";
import WexonAdminNav from "@/components/marketing/WexonAdminNav";
import { getAdminHeaderSnapshot } from "@/lib/wexon-admin";
import { getAdminSession } from "@/lib/wexon-admin-auth";

export default async function WexonAdminShell({ children }: { children: ReactNode }) {
  const [session, snapshot] = await Promise.all([getAdminSession(), getAdminHeaderSnapshot()]);
  const userInitial = session?.email?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f6f8f7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[1680px]">
          <WexonAdminHeaderToolbar snapshot={snapshot} userInitial={userInitial} userEmail={session?.email} />
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1680px] min-w-0 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="min-w-0 lg:self-start">
            <div className="w-full min-w-0 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/70 lg:sticky lg:top-24 lg:rounded-[28px] lg:p-3.5">
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 lg:mb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    Wexon Admin
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">İç Yönetim Paneli</p>
                  {session?.email && (
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={session.email}>
                      {session.email}
                    </p>
                  )}
                </div>
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black text-emerald-300 lg:flex">
                  A
                </span>
              </div>
              <WexonAdminNav />
            </div>
          </aside>
          <div className="wx-panel-enter min-w-0 w-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
