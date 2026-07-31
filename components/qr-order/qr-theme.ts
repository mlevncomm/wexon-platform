/**
 * WexPay QR guest theme — light surfaces bound to Wexon kit tokens from
 * `app/globals.css` (:root Kit + @theme inline bridges).
 *
 * Source tokens:
 * - --wx-surface / --wx-surface-card / --wx-surface-subtle
 * - --wx-ink / --wx-ink-muted / --wx-ink-faint
 * - --wx-hairline
 * - --wx-accent / --wx-accent-dim
 * - --wx-shadow-soft / --wx-shadow-lift
 * - --wx-radius-card / --wx-radius-xl
 *
 * Do not invent a separate navy/coral grocery palette here.
 */

export const qrShell =
  "min-h-[100dvh] overflow-x-hidden bg-wx-surface text-wx-ink";

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

/** Landing has no bottom nav — only safe-area padding. */
export const qrPageShellLanding =
  "flex min-h-[100dvh] w-full flex-col overflow-x-hidden overflow-y-auto pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]";

export const qrPageBody = "w-full py-4 sm:py-6";

export const qrStickyHeaderBar =
  "sticky top-0 z-20 w-full shrink-0 bg-wx-surface/95 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 backdrop-blur-md";

export const qrGlass =
  "border border-white/80 bg-wx-surface-card/90 shadow-[var(--wx-shadow-soft)] backdrop-blur-md";

export const qrGlassSoft =
  "border border-wx-hairline/80 bg-wx-surface-card shadow-[var(--wx-shadow-soft)]";

export const qrCard =
  "rounded-[20px] border border-wx-hairline/80 bg-wx-surface-card shadow-[var(--wx-shadow-soft)] sm:rounded-[24px]";

/** Primary CTA — kit accent (emerald) */
export const qrPrimaryCta =
  "flex min-h-11 w-full items-center justify-center rounded-[18px] bg-wx-accent px-5 text-[15px] font-black text-white shadow-[var(--wx-shadow-lift)] transition hover:bg-wx-accent-dim active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none motion-reduce:transition-none motion-reduce:active:scale-100 sm:min-h-12 sm:rounded-[20px]";

export const qrSecondaryCta =
  "flex min-h-11 w-full items-center justify-center rounded-[18px] border border-wx-hairline bg-wx-surface-card px-5 text-[15px] font-black text-wx-ink shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800 active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-12 sm:rounded-[20px]";

export const qrGhostCta =
  "flex min-h-11 w-full items-center justify-center rounded-2xl border border-wx-hairline/80 bg-wx-surface-card/80 px-3 text-xs font-bold text-wx-ink-muted transition hover:bg-wx-surface-card hover:text-wx-ink sm:min-h-12 sm:px-4 sm:text-sm";

export const qrGhostCtaInline =
  "inline-flex min-h-11 w-auto shrink-0 items-center justify-center rounded-2xl border border-wx-hairline/80 bg-wx-surface-card/80 px-3 text-xs font-bold text-wx-ink-muted transition hover:bg-wx-surface-card hover:text-wx-ink sm:min-h-12 sm:px-4 sm:text-sm";

export const qrIconBtn =
  "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border border-wx-hairline/80 bg-wx-surface-card text-sm font-bold text-wx-ink-muted shadow-sm transition hover:bg-wx-surface-subtle active:scale-95 motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wx-accent";

/** Accent add control — kit accent */
export const qrAccentAdd =
  "flex h-11 w-11 items-center justify-center rounded-full bg-wx-accent text-xl font-black text-white shadow-[var(--wx-shadow-lift)] transition hover:bg-wx-accent-dim active:scale-95 motion-reduce:active:scale-100";

export const qrPrice =
  "text-[15px] font-black tabular-nums text-wx-accent sm:text-base";

export const qrFocusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wx-accent";

export const qrInkBar =
  "bg-wx-ink text-white shadow-[0_-12px_40px_rgba(2,6,23,0.28)]";

export const qrChipActive =
  "bg-wx-ink text-white shadow-[0_8px_18px_rgba(2,6,23,0.18)]";

export const qrChipIdle =
  "bg-wx-surface-card text-wx-ink shadow-[0_6px_16px_rgba(2,6,23,0.05)] ring-1 ring-wx-hairline/80 hover:bg-wx-surface-card hover:text-wx-ink hover:shadow-[0_8px_18px_rgba(2,6,23,0.1)] hover:ring-emerald-200/80 active:shadow-[0_6px_14px_rgba(2,6,23,0.07)]";

/** Classes that prove QR surfaces bind to kit tokens (unit-tested). */
export const qrSystemTokenClasses = [
  "bg-wx-surface",
  "bg-wx-surface-card",
  "bg-wx-accent",
  "text-wx-ink",
  "text-wx-accent",
  "border-wx-hairline",
] as const;

/** Decorative placeholders only — soft kit-adjacent pastels, not coral grocery accents. */
export function categoryVisual(name: string): { gradient: string; glyph: string } {
  const n = name.toLowerCase();
  if (/burger|tavuk|et|ana/.test(n)) {
    return { gradient: "from-emerald-50 via-teal-50 to-slate-100", glyph: "◉" };
  }
  if (/pizza|makarna|pasta/.test(n)) {
    return { gradient: "from-teal-50 via-emerald-50 to-slate-100", glyph: "◆" };
  }
  if (/içecek|icecek|limonata|su|soda/.test(n)) {
    return { gradient: "from-sky-50 via-cyan-50 to-slate-100", glyph: "◇" };
  }
  if (/kahve|latte|americano|çay|cay/.test(n)) {
    return { gradient: "from-stone-100 via-slate-50 to-emerald-50", glyph: "●" };
  }
  if (/tatlı|tatli|dessert|cheesecake|pasta/.test(n)) {
    return { gradient: "from-rose-50 via-slate-50 to-emerald-50", glyph: "✦" };
  }
  if (/salata|başlangıç|baslangic|çorba|corba/.test(n)) {
    return { gradient: "from-lime-50 via-emerald-50 to-teal-50", glyph: "✿" };
  }
  return { gradient: "from-slate-100 via-emerald-50/80 to-teal-50", glyph: "◎" };
}

export function productVisual(productName: string, categoryHint?: string) {
  return categoryVisual(`${productName} ${categoryHint ?? ""}`);
}
