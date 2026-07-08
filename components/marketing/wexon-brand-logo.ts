import type { CSSProperties } from "react";

/** Hero header logo asset ratio (wexon-dev.png). */
const HERO_LOGO_ASPECT = 6747 / 1547;

/** Rendered hero logo width at h-8 / md:h-9 — sub-header and footer match this footprint. */
export const WEXON_BRAND_LOGO_BOX_CLASS =
  "relative block h-8 w-[calc(2rem*var(--wx-brand-logo-aspect))] shrink-0 md:h-9 md:w-[calc(2.25rem*var(--wx-brand-logo-aspect))]";

export const WEXON_BRAND_LOGO_STYLE = {
  "--wx-brand-logo-aspect": String(HERO_LOGO_ASPECT),
} as CSSProperties;

export const WEXON_BRAND_LOGO_SIZES = "157px";

export const WEXON_BRAND_LOGOS = {
  hero: "/brand/wexon-dev.png",
  dark: "/brand/wexon-siyah.png",
} satisfies Record<"hero" | "dark", string>;
