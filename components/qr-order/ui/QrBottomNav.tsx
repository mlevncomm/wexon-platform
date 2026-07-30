"use client";

export type QrNavTab = "menu" | "orders" | "bill" | "more";

const TABS: Array<{ id: QrNavTab; label: string; glyph: string; testId: string }> = [
  { id: "menu", label: "Menü", glyph: "☰", testId: "qr-nav-menu" },
  { id: "orders", label: "Siparişlerim", glyph: "◷", testId: "qr-nav-orders" },
  { id: "bill", label: "Hesabım", glyph: "◈", testId: "qr-nav-bill" },
  { id: "more", label: "Daha fazla", glyph: "···", testId: "qr-nav-more" },
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#152238] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_40px_rgba(21,34,56,0.35)]"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-2 sm:px-4">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <li key={tab.id} className="min-w-0 flex-1">
              <button
                type="button"
                data-testid={tab.testId}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(tab.id)}
                className={`relative flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-bold tracking-wide transition sm:text-[11px] ${
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-white/55 hover:bg-white/6 hover:text-white/85"
                }`}
              >
                <span aria-hidden="true" className="relative text-base leading-none sm:text-lg">
                  {tab.glyph}
                  {tab.id === "menu" && cartCount > 0 ? (
                    <span className="absolute -right-3 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F97316] px-1 text-[9px] font-black text-white">
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
