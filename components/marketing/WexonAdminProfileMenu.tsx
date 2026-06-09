"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AdminHeaderSnapshot } from "@/lib/wexon-admin";
import { logoutAdminAction } from "@/lib/wexon-admin-auth-actions";

type MenuSection = {
  title: string;
  items: { label: string; href: string; badge?: string }[];
};

export default function WexonAdminProfileMenu({
  userInitial,
  userEmail,
  snapshot,
}: {
  userInitial: string;
  userEmail?: string | null;
  snapshot?: AdminHeaderSnapshot;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingWork = snapshot?.stats.pendingWork ?? 0;

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

  const sections: MenuSection[] = [
    {
      title: "Operasyon",
      items: [
        { label: "Genel bakış", href: "/admin" },
        { label: "Organizasyonlar", href: "/admin/organizations", badge: snapshot ? String(snapshot.stats.organizations) : undefined },
        { label: "Destek talepleri", href: "/admin/support", badge: snapshot?.stats.openSupportTickets ? String(snapshot.stats.openSupportTickets) : undefined },
        { label: "Lisanslar", href: "/admin/licenses", badge: snapshot?.stats.attentionLicenses ? String(snapshot.stats.attentionLicenses) : undefined },
        { label: "Faturalar", href: "/admin/billing", badge: snapshot?.stats.pendingInvoices ? String(snapshot.stats.pendingInvoices) : undefined },
        { label: "İşlem geçmişi", href: "/admin/audit-logs" },
      ],
    },
    {
      title: "Katalog",
      items: [
        { label: "Ürün kataloğu", href: "/admin/products" },
        { label: "Paketler", href: "/admin/plans" },
        { label: "Abonelikler", href: "/admin/subscriptions" },
        { label: "Entegrasyonlar", href: "/admin/integrations" },
        { label: "Müşteri özeti", href: "/admin/customers" },
      ],
    },
    {
      title: "Hızlı geçiş",
      items: [
        { label: "WexPay demo (sandbox)", href: "/demo/wexpay/business" },
        { label: "Müşteri paneli", href: "/dashboard" },
        { label: "WexPay operasyon", href: "/apps/wexpay" },
        { label: "Admin ayarları", href: "/admin/settings" },
        { label: "Ana site", href: "/" },
      ],
    },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Admin profil menüsü"
        className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-emerald-300 ring-1 ring-slate-900/10 transition-all hover:bg-slate-800 ${
          open ? "ring-2 ring-emerald-300/50" : ""
        }`}
      >
        {userInitial}
        {pendingWork > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" aria-hidden />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        >
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="truncate text-sm font-black text-slate-950">{userEmail ?? "Admin oturumu"}</p>
            <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">
              İç yönetici
            </span>
            {snapshot ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Müşteri</p>
                  <p className="text-sm font-black text-slate-950">{snapshot.stats.organizations}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Bekleyen</p>
                  <p className="text-sm font-black text-slate-950">{snapshot.stats.pendingWork}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
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
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 p-2">
            <form action={logoutAdminAction}>
              <button
                type="submit"
                role="menuitem"
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
              >
                Çıkış yap
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
