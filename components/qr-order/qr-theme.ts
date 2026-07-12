/** Shared visual tokens for QR diner UI — Wexon Glass Light + Soft Restaurant warmth. */

export const qrShell =
  "min-h-[100dvh] bg-[linear-gradient(165deg,#F6F8F5_0%,#ECFDF5_42%,#FAFAF7_100%)] text-slate-950";

export const qrGlass =
  "border border-white/70 bg-white/75 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur-md";

export const qrGlassSoft =
  "border border-emerald-100/60 bg-white/80 shadow-[0_12px_36px_rgba(16,185,129,0.08)] backdrop-blur-sm";

export const qrCard =
  "rounded-[28px] border border-slate-200/70 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]";

export const qrPrimaryCta =
  "flex min-h-14 w-full items-center justify-center rounded-[22px] bg-[#10b981] px-5 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(16,185,129,0.35)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none";

export const qrSecondaryCta =
  "flex min-h-14 w-full items-center justify-center rounded-[22px] border border-slate-200/90 bg-white/90 px-5 text-[15px] font-black text-slate-900 shadow-sm transition active:scale-[0.98]";

export const qrGhostCta =
  "flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white/60 px-4 text-sm font-bold text-slate-700 backdrop-blur-sm transition active:bg-white";

export const qrIconBtn =
  "flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-sm transition active:scale-95";

export function categoryVisual(name: string): { gradient: string; glyph: string } {
  const n = name.toLowerCase();
  if (/burger|tavuk|et|ana/.test(n)) {
    return { gradient: "from-amber-100 via-orange-50 to-rose-100", glyph: "◉" };
  }
  if (/pizza|makarna|pasta/.test(n)) {
    return { gradient: "from-rose-100 via-orange-50 to-amber-100", glyph: "◆" };
  }
  if (/içecek|icecek|limonata|su|soda/.test(n)) {
    return { gradient: "from-sky-100 via-cyan-50 to-emerald-100", glyph: "◇" };
  }
  if (/kahve|latte|americano|çay|cay/.test(n)) {
    return { gradient: "from-stone-200 via-amber-50 to-orange-100", glyph: "●" };
  }
  if (/tatlı|tatli|dessert|cheesecake|pasta/.test(n)) {
    return { gradient: "from-fuchsia-100 via-rose-50 to-amber-100", glyph: "✦" };
  }
  if (/salata|başlangıç|baslangic|çorba|corba/.test(n)) {
    return { gradient: "from-lime-100 via-emerald-50 to-teal-100", glyph: "✿" };
  }
  return { gradient: "from-emerald-100 via-teal-50 to-lime-100", glyph: "◎" };
}

export function productVisual(productName: string, categoryHint?: string) {
  return categoryVisual(`${productName} ${categoryHint ?? ""}`);
}
