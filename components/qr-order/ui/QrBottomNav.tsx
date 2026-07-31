"use client";

import type { ReactElement } from "react";
import { qrInkBar } from "@/components/qr-order/qr-theme";

export type QrNavTab = "menu" | "orders" | "bill" | "more";

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

function IconOrders({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" />
    </svg>
  );
}

function IconBill({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14.2l-2.2-1.3-2.3 1.3-2-1.3-2 1.3-2.3-1.3-2.2 1.3V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </svg>
  );
}

function IconMore({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

const TABS: Array<{
  id: QrNavTab;
  label: string;
  testId: string;
  Icon: (props: { className?: string }) => ReactElement;
}> = [
  { id: "menu", label: "Menü", testId: "qr-nav-menu", Icon: IconMenu },
  { id: "orders", label: "Siparişlerim", testId: "qr-nav-orders", Icon: IconOrders },
  { id: "bill", label: "Hesabım", testId: "qr-nav-bill", Icon: IconBill },
  { id: "more", label: "Daha fazla", testId: "qr-nav-more", Icon: IconMore },
];

export default function QrBottomNav({
  active,
  onSelect,
  cartCount = 0,
}: {
  active: QrNavTab;
  onSelect: (tab: QrNavTab) => void;
  cartCount?: number;
}) {
  return (
    <nav
      aria-label="Masa sipariş menüsü"
      data-testid="qr-bottom-nav"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 ${qrInkBar} pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5`}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-2 sm:px-4">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const { Icon } = tab;
          return (
            <li key={tab.id} className="min-w-0 flex-1">
              <button
                type="button"
                data-testid={tab.testId}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(tab.id)}
                className={`relative flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-bold tracking-wide transition sm:text-[11px] ${
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-white/55 hover:bg-white/6 hover:text-white/85"
                }`}
              >
                <span className="relative inline-flex h-5 w-5 items-center justify-center" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                  {tab.id === "menu" && cartCount > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-wx-accent px-1 text-[9px] font-black text-white">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
