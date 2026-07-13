import type { CSSProperties } from "react";

/**
 * Marketing logo box uses the established UI footprint (old PNG ratio),
 * so navbar/footer layout stays ~140–157px wide at h-8 / md:h-9.
 * New SVG lockups object-contain inside this box.
 */
const HERO_LOGO_ASPECT = 6747 / 1547;

export const WEXON_BRAND_LOGO_BOX_CLASS =
  "relative block h-8 w-[calc(2rem*var(--wx-brand-logo-aspect))] shrink-0 md:h-9 md:w-[calc(2.25rem*var(--wx-brand-logo-aspect))]";

export const WEXON_BRAND_LOGO_STYLE = {
  "--wx-brand-logo-aspect": String(HERO_LOGO_ASPECT),
} as CSSProperties;

export const WEXON_BRAND_LOGO_SIZES = "157px";

export const WEXON_BRAND_LOGOS = {
  hero: "/brand/wexon-dev.svg",
  dark: "/brand/wexon-siyah.svg",
} satisfies Record<"hero" | "dark", string>;

/** Product lockups (wordmark + mark) — intended for dark backgrounds. */
export const WEXON_PRODUCT_LOCKUPS = {
  wexpay: "/brand/wex-pay.png",
  wexhotel: "/brand/wex-hotel.png",
  wexb2b: "/brand/wex-b2b.png",
} as const;

/** Transparent product marks for light surfaces / compact UI. */
export const WEXON_PRODUCT_MARKS = {
  wexon: "/brand/wexon-mark.svg",
  wexpay: "/brand/wexpay-mark.svg",
  wexhotel: "/brand/wexhotel-mark.svg",
  wexb2b: "/brand/wexb2b-mark.svg",
} as const;
