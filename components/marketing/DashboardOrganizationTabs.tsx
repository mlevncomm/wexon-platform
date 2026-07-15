"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { id: "overview", label: "Özet" },
  { id: "edit", label: "Düzenle" },
  { id: "businesses", label: "İşletmeler" },
] as const;

export type OrganizationTabId = (typeof TABS)[number]["id"];

export function DashboardOrganizationTabBar({ baseHref }: { baseHref: string }) {
  const searchParams = useSearchParams();
  const active = (searchParams.get("tab") as OrganizationTabId | null) ?? "overview";

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {TABS.map((tab) => {
        const href = (() => {
          const url = new URL(baseHref, "http://local");
          if (tab.id === "overview") url.searchParams.delete("tab");
          else url.searchParams.set("tab", tab.id);
          return `${url.pathname}${url.search}`;
        })();
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`rounded-full px-4 py-2 text-xs font-black transition ${
              isActive ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function DashboardOrganizationTabPanel({
  tab,
  current,
  children,
}: {
  tab: OrganizationTabId;
  current: OrganizationTabId;
  children: ReactNode;
}) {
  if (tab !== current) return null;
  return <div className="mt-6">{children}</div>;
}
