/**
 * WexPay QR guest theme — light cool-gray canvas, navy surfaces, coral accents.
 * Not restaurant-branded; no emerald panel tokens on guest flows.
 */

export const qrCanvasBg = "#F5F7FB";
export const qrNavy = "#152238";
export const qrNavySoft = "#1E2F4A";
export const qrCoral = "#F97316";
export const qrCoralDeep = "#EA580C";

export const qrShell =
  "min-h-[100dvh] overflow-x-hidden bg-[#F5F7FB] text-slate-950";

/** Centered content column — mobile-first, widens on larger screens. */
export const qrFrame =
  "mx-auto w-full max-w-[26rem] px-4 sm:max-w-xl sm:px-6 md:max-w-5xl lg:max-w-6xl lg:px-8";

export const qrFrameNarrow =
  "mx-auto w-full max-w-[26rem] px-4 sm:max-w-lg sm:px-6 md:max-w-3xl lg:max-w-4xl lg:px-8";

/** Page shell with bottom-nav clearance. */
export const qrPageShell =
  "flex min-h-[100dvh] w-full flex-col overflow-x-hidden overflow-y-auto pt-[max(0.5rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]";

export const qrPageShellFlush =
  "flex min-h-[100dvh] w-full flex-col overflow-x-hidden overflow-y-auto pt-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))]";

export const qrPageBody = "w-full py-4 sm:py-6";

export const qrStickyHeaderBar =
  "sticky top-0 z-20 w-full shrink-0 bg-[#F5F7FB]/95 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 backdrop-blur-md";

export const qrGlass =
  "border border-white/80 bg-white/90 shadow-[0_14px_40px_rgba(21,34,56,0.06)] backdrop-blur-md";

export const qrGlassSoft =
  "border border-slate-200/70 bg-white shadow-[0_10px_28px_rgba(21,34,56,0.05)]";

export const qrCard =
  "rounded-[20px] border border-slate-200/60 bg-white shadow-[0_12px_32px_rgba(21,34,56,0.06)] sm:rounded-[24px]";

/** Primary CTA — navy */
export const qrPrimaryCta =
  "flex min-h-11 w-full items-center justify-center rounded-[18px] bg-[#152238] px-5 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(21,34,56,0.28)] transition hover:bg-[#1E2F4A] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none motion-reduce:transition-none motion-reduce:active:scale-100 sm:min-h-12 sm:rounded-[20px]";

export const qrSecondaryCta =
  "flex min-h-11 w-full items-center justify-center rounded-[18px] border border-slate-200/90 bg-white px-5 text-[15px] font-black text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-12 sm:rounded-[20px]";

export const qrGhostCta =
  "flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-xs font-bold text-slate-700 transition hover:bg-white sm:min-h-12 sm:px-4 sm:text-sm";

export const qrGhostCtaInline =
  "inline-flex min-h-11 w-auto shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-xs font-bold text-slate-700 transition hover:bg-white sm:min-h-12 sm:px-4 sm:text-sm";

export const qrIconBtn =
  "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#152238]";

/** Coral add / price accent */
export const qrAccentAdd =
  "flex h-11 w-11 items-center justify-center rounded-full bg-[#F97316] text-xl font-black text-white shadow-[0_10px_22px_rgba(249,115,22,0.35)] transition hover:bg-[#EA580C] active:scale-95 motion-reduce:active:scale-100";

export const qrPrice =
  "text-[15px] font-black tabular-nums text-[#F97316] sm:text-base";

export const qrFocusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#152238]";

/** Decorative placeholders only — not restaurant-branded assets. */
export function categoryVisual(name: string): { gradient: string; glyph: string } {
  const n = name.toLowerCase();
  if (/burger|tavuk|et|ana/.test(n)) {
    return { gradient: "from-amber-100 via-orange-50 to-rose-100", glyph: "◉" };
  }
  if (/pizza|makarna|pasta/.test(n)) {
    return { gradient: "from-rose-100 via-orange-50 to-amber-100", glyph: "◆" };
  }
  if (/içecek|icecek|limonata|su|soda/.test(n)) {
    return { gradient: "from-sky-100 via-cyan-50 to-slate-100", glyph: "◇" };
  }
  if (/kahve|latte|americano|çay|cay/.test(n)) {
    return { gradient: "from-stone-200 via-amber-50 to-orange-100", glyph: "●" };
  }
  if (/tatlı|tatli|dessert|cheesecake|pasta/.test(n)) {
    return { gradient: "from-fuchsia-100 via-rose-50 to-amber-100", glyph: "✦" };
  }
  if (/salata|başlangıç|baslangic|çorba|corba/.test(n)) {
    return { gradient: "from-lime-100 via-teal-50 to-sky-100", glyph: "✿" };
  }
  return { gradient: "from-slate-100 via-sky-50 to-indigo-50", glyph: "◎" };
}

export function productVisual(productName: string, categoryHint?: string) {
  return categoryVisual(`${productName} ${categoryHint ?? ""}`);
}
