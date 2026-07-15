"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { AdminHeaderSnapshot } from "@/lib/wexon-admin";
import { adminCommandRoutes } from "@/lib/wexon-admin-navigation";
import WexonAdminProfileMenu from "@/components/marketing/WexonAdminProfileMenu";
import { WexonAdminMobileNavDrawer } from "@/components/marketing/WexonAdminNav";
import { adminNavigationUrl, appNavigationUrl, coreNavigationUrl, resolveNavigationHref } from "@/lib/wexon/urls";

type CommandItem = {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords: string;
};

function formatActivityTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function AdminBrandLink({ compact = false, inline = false }: { compact?: boolean; inline?: boolean }) {
  return (
    <Link
      href={adminNavigationUrl("/admin")}
      className={`group flex shrink-0 items-center gap-2 ${inline ? "max-w-[5.5rem]" : "min-w-0 gap-2.5"}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-950 font-black text-emerald-300 shadow-sm shadow-slate-900/20 transition-transform group-hover:scale-[1.02] ${
          inline ? "h-7 w-7 text-[10px]" : compact ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"
        }`}
      >
        A
      </span>
      {inline ? (
        <span className="truncate text-xs font-black tracking-tight text-slate-950">Admin</span>
      ) : (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-black tracking-tight text-slate-950">Wexon Admin</p>
          <p className={`truncate font-medium text-slate-500 ${compact ? "text-[10px]" : "text-[11px]"}`}>
            İç yönetim paneli
          </p>
        </div>
      )}
    </Link>
  );
}

type AlertListItem = {
  label: string;
  value: number;
  href: string;
  tone: "amber" | "rose" | "emerald";
};

function AlertsPanelContent({
  alertItems,
  snapshot,
  onClose,
}: {
  alertItems: AlertListItem[];
  snapshot: AdminHeaderSnapshot;
  onClose: () => void;
}) {
  return (
    <>
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Bekleyen işler</p>
        <p className="mt-0.5 text-xs text-slate-500">Dikkat gerektiren kayıtlar</p>
      </div>
      <div className="space-y-1 p-2">
        {alertItems.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm font-medium text-slate-500">
            Bekleyen kritik kayıt yok
          </p>
        ) : (
          alertItems.map((item) => (
            <Link
              key={item.label}
              href={adminNavigationUrl(item.href)}
              onClick={onClose}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
            >
              <span className="text-sm font-semibold text-slate-700">{item.label}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-black ${
                  item.tone === "amber"
                    ? "bg-amber-50 text-amber-800"
                    : item.tone === "rose"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {item.value}
              </span>
            </Link>
          ))
        )}
      </div>
      <div className="border-t border-slate-100 p-2">
        <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Son aktivite</p>
        {snapshot.recentActivity.length === 0 ? (
          <p className="px-3 py-2 text-xs font-medium text-slate-400">Kayıt yok</p>
        ) : (
          snapshot.recentActivity.slice(0, 4).map((activity) => (
            <div key={activity.id} className="rounded-xl px-3 py-2">
              <p className="truncate text-xs font-semibold text-slate-700">{activity.action}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {activity.organizationName ?? "Sistem"} · {formatActivityTime(activity.createdAt)}
              </p>
            </div>
          ))
        )}
        <Link
          href={adminNavigationUrl("/admin/audit-logs")}
          onClick={onClose}
          className="mt-1 block rounded-xl px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          Tüm işlem geçmişi
        </Link>
      </div>
    </>
  );
}

export default function WexonAdminHeaderToolbar({
  snapshot,
  userInitial,
  userEmail,
  environmentBadge,
}: {
  snapshot: AdminHeaderSnapshot;
  userInitial: string;
  userEmail?: string | null;
  environmentBadge?: string;
}) {
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const isClient = useIsClient();
  const commandRef = useRef<HTMLDivElement>(null);
  const alertsMobileRef = useRef<HTMLDivElement>(null);
  const alertsDesktopRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandItems = useMemo<CommandItem[]>(() => {
    const routes = adminCommandRoutes.map((route) => ({
      id: `route:${route.href}:${route.label}`,
      label: route.label,
      href: route.href.startsWith("/admin")
        ? adminNavigationUrl(route.href)
        : route.href.startsWith("/dashboard")
          ? coreNavigationUrl(route.href)
          : route.href.startsWith("/apps/wexpay")
            ? appNavigationUrl(route.href)
            : resolveNavigationHref(route.href),
      group: route.group,
      keywords: route.keywords,
    }));
    const orgs = snapshot.organizations.map((organization) => ({
      id: `org:${organization.id}`,
      label: organization.name,
      href: adminNavigationUrl(`/admin/organizations/${organization.id}`),
      group: "Müşteriler",
      keywords: `${organization.slug} organizasyon müşteri`,
    }));
    return [...routes, ...orgs];
  }, [snapshot.organizations]);

  const filteredItems = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return commandItems.slice(0, 14);
    return commandItems
      .filter((item) => {
        const haystack = normalize(`${item.label} ${item.group} ${item.keywords}`);
        return haystack.includes(needle);
      })
      .slice(0, 14);
  }, [commandItems, query]);

  const groupedResults = useMemo(() => {
    if (query.trim()) {
      return filteredItems.length > 0 ? [{ title: "Arama sonuçları", items: filteredItems }] : [];
    }
    const order = ["Sayfalar", "Katalog", "Hızlı işlem", "Müşteriler", "Önizleme"];
    const map = new Map<string, CommandItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return order
      .filter((title) => map.has(title))
      .map((title) => ({ title, items: map.get(title)! }));
  }, [filteredItems, query]);

  const highlightedIndex =
    filteredItems.length === 0 ? 0 : Math.min(activeIndex, filteredItems.length - 1);

  const alertItems = useMemo(() => {
    const items = [
      {
        label: "Bekleyen fatura",
        value: snapshot.stats.pendingInvoices,
        href: adminNavigationUrl("/admin/billing"),
        tone: "amber" as const,
      },
      {
        label: "Dikkat gerektiren lisans",
        value: snapshot.stats.attentionLicenses,
        href: adminNavigationUrl("/admin/licenses"),
        tone: "rose" as const,
      },
      {
        label: "Açık destek talebi",
        value: snapshot.stats.openSupportTickets,
        href: adminNavigationUrl("/admin/support"),
        tone: "emerald" as const,
      },
    ];
    return items.filter((item) => item.value > 0);
  }, [snapshot.stats]);

  const openCommand = useCallback(() => {
    setAlertsOpen(false);
    setCommandOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const closeCommand = useCallback(() => {
    setCommandOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      closeCommand();
      setAlertsOpen(false);
      if (href.startsWith("http://") || href.startsWith("https://")) {
        window.location.assign(href);
        return;
      }
      router.push(href);
    },
    [closeCommand, router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (commandOpen) closeCommand();
        else openCommand();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeCommand, commandOpen, openCommand]);

  useEffect(() => {
    if (commandOpen) {
      document.body.style.overflow = "hidden";
      inputRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [commandOpen]);

  useEffect(() => {
    if (!commandOpen && !alertsOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (commandOpen && commandRef.current && !commandRef.current.contains(target)) {
        closeCommand();
      }
      const inAlerts =
        (alertsMobileRef.current?.contains(target) ?? false) ||
        (alertsDesktopRef.current?.contains(target) ?? false);
      if (alertsOpen && !inAlerts) {
        setAlertsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [alertsOpen, closeCommand, commandOpen]);

  function handleCommandKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeCommand();
      return;
    }
    if (filteredItems.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filteredItems.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filteredItems.length) % filteredItems.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filteredItems[highlightedIndex];
      if (item) navigateTo(item.href);
    }
  }

  const searchTriggerClassName =
    "group flex h-10 w-full items-center gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/70 px-3 text-left transition-colors hover:border-slate-300/80 hover:bg-white";
  const mobileSearchClassName =
    "group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-100/70 px-2.5 text-left transition-colors hover:bg-slate-100";

  return (
    <>
      <div className="flex h-16 w-full items-center gap-2 md:hidden">
        <WexonAdminMobileNavDrawer environmentBadge={environmentBadge} />
        <AdminBrandLink inline />
        <button
          type="button"
          onClick={openCommand}
          className={mobileSearchClassName}
          aria-label="Sayfa veya müşteri ara"
        >
          <span className="flex shrink-0 items-center justify-center text-slate-400 transition-colors group-hover:text-slate-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-400 transition-colors group-hover:text-slate-500">
            Ara…
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href={adminNavigationUrl("/admin/organizations")}
            aria-label="Yeni müşteri"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </Link>
          <div ref={alertsMobileRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setCommandOpen(false);
                setAlertsOpen((value) => !value);
              }}
              aria-expanded={alertsOpen}
              aria-label="Bildirimler ve bekleyen işler"
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
              </svg>
              {snapshot.stats.pendingWork > 0 ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden />
              ) : null}
            </button>

            {alertsOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/10">
                <AlertsPanelContent
                  alertItems={alertItems}
                  snapshot={snapshot}
                  onClose={() => setAlertsOpen(false)}
                />
              </div>
            ) : null}
          </div>
          <WexonAdminProfileMenu userInitial={userInitial} userEmail={userEmail} snapshot={snapshot} />
        </div>
      </div>

      <div className="hidden h-16 items-center gap-3 lg:gap-4 md:flex">
        <AdminBrandLink />
        <div className="flex min-w-0 flex-1 items-center justify-center px-2 lg:px-4">
          <button
            type="button"
            onClick={openCommand}
            className={`${searchTriggerClassName} w-full min-w-[360px] max-w-sm xl:min-w-[420px] xl:max-w-[520px]`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-400 transition-colors group-hover:text-slate-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-400 transition-colors group-hover:text-slate-500">
              Sayfa veya müşteri ara…
            </span>
            <kbd className="hidden rounded-md border border-slate-200/70 bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 lg:inline">
              Ctrl K
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-1.5 xl:flex">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              {snapshot.stats.organizations} müşteri
            </span>
            {snapshot.stats.pendingWork > 0 ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
                {snapshot.stats.pendingWork} bekleyen
              </span>
            ) : null}
            {environmentBadge ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                {environmentBadge}
              </span>
            ) : null}
          </div>

          <div ref={alertsDesktopRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setCommandOpen(false);
                setAlertsOpen((value) => !value);
              }}
              aria-expanded={alertsOpen}
              aria-label="Bildirimler ve bekleyen işler"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/60 bg-slate-50/70 text-slate-600 transition-colors hover:border-slate-300/80 hover:bg-white hover:text-slate-800"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
              </svg>
              {snapshot.stats.pendingWork > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-white">
                  {snapshot.stats.pendingWork > 9 ? "9+" : snapshot.stats.pendingWork}
                </span>
              ) : null}
            </button>

            {alertsOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/10">
                <AlertsPanelContent
                  alertItems={alertItems}
                  snapshot={snapshot}
                  onClose={() => setAlertsOpen(false)}
                />
              </div>
            ) : null}
          </div>

          <Link
            href={adminNavigationUrl("/admin/organizations")}
            className="hidden shrink-0 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-slate-900/20 transition-colors hover:bg-emerald-700 sm:inline-flex"
          >
            + Yeni müşteri
          </Link>

          <WexonAdminProfileMenu
            userInitial={userInitial}
            userEmail={userEmail}
            snapshot={snapshot}
          />
        </div>
      </div>

      {commandOpen && isClient
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/20 px-4 pt-[12vh] backdrop-blur-[2px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeCommand();
              }}
            >
              <div
                ref={commandRef}
                className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/10"
                role="dialog"
                aria-modal="true"
                aria-label="Admin arama paleti"
              >
                <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                  <span className="shrink-0 text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleCommandKeyDown}
                    placeholder="Sayfa veya müşteri ara…"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={closeCommand}
                    className="shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                  >
                    Esc
                  </button>
                </div>

                <div className="max-h-[min(50vh,380px)] overflow-y-auto p-2">
                  {groupedResults.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-slate-400">Sonuç bulunamadı</p>
                  ) : (
                    groupedResults.map((section) => (
                      <div key={section.title} className="mb-1 last:mb-0">
                        <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {section.title}
                        </p>
                        <div className="space-y-0.5">
                          {section.items.map((item) => {
                            const index = filteredItems.findIndex((entry) => entry.id === item.id);
                            const active = index === highlightedIndex;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => navigateTo(item.href)}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                  active ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <span className="min-w-0 truncate text-sm font-medium">{item.label}</span>
                                <span className="shrink-0 truncate text-[11px] text-slate-400">{item.group}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                  <span>↑↓ gezin · Enter seç · Esc kapat</span>
                  <span>{filteredItems.length} sonuç</span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
