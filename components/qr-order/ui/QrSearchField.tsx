"use client";

import { qrFocusRing } from "@/components/qr-order/qr-theme";

export default function QrSearchField({
  value,
  onChange,
  placeholder = "Ürün ara…",
  testId = "qr-menu-search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">Menüde ara</span>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400"
        >
          ⌕
        </span>
        <input
          data-testid={testId}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`min-h-12 w-full rounded-2xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus-visible:border-wx-accent/35 focus-visible:ring-4 focus-visible:ring-wx-accent/15 ${qrFocusRing}`}
        />
      </div>
    </label>
  );
}
