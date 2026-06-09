import type { ReactNode } from "react";
import Link from "next/link";
import WexPayAppNav from "@/components/wexpay/WexPayAppNav";

export default function WexPayAppShell({
  children,
  organizationName,
  userEmail,
  role,
}: {
  children: ReactNode;
  organizationName: string;
  userEmail: string;
  role: string;
}) {
  const userInitial = userEmail?.[0]?.toUpperCase() ?? "W";

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f6f8f7] text-slate-950">
      {/* Global header — same premium line as Wexon Core dashboard */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1360px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          {/* Left: product identity */}
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-white">
              P
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">WexPay</p>
              <p className="truncate text-xs font-semibold text-slate-500">Operasyon Paneli</p>
            </div>
          </div>

          {/* Right: user context + back link + avatar — clean, no center cluster */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-[200px] truncate text-xs font-bold text-slate-600 md:inline">
              {userEmail}
            </span>
            <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 sm:inline">
              {role}
            </span>
            <Link
              href="/dashboard"
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-700"
            >
              Core paneli
            </Link>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
              {userInitial}
            </span>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1360px] min-w-0 items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Sidebar — matches dashboard sidebar */}
          <aside className="min-w-0 lg:self-start">
            <div className="w-full min-w-0 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/70 lg:sticky lg:top-24 lg:rounded-[28px] lg:p-3.5">
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 lg:mb-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">WexPay</p>
                  <p className="mt-1 truncate text-sm font-black text-slate-950">{organizationName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{role}</p>
                </div>
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-xs font-black text-white lg:flex">
                  P
                </span>
              </div>
              <WexPayAppNav />
            </div>
          </aside>

          {/* Main content */}
          <div className="mx-auto w-full max-w-[1120px] min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
