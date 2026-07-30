"use client";

import { qrFocusRing } from "@/components/qr-order/qr-theme";

export default function QrChipRow({
  items,
  activeId,
  onSelect,
  label = "Kategoriler",
}: {
  items: Array<{ id: string; name: string }>;
  activeId: string;
  onSelect: (id: string) => void;
  label?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`qr-chip-${item.id}`}
            onClick={() => onSelect(item.id)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition ${qrFocusRing} ${
              active
                ? "bg-[#152238] text-white shadow-[0_8px_20px_rgba(21,34,56,0.25)]"
                : "bg-white text-slate-700 ring-1 ring-slate-200/80 hover:bg-slate-50"
            }`}
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
}
