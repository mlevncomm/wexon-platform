import type { CSSProperties } from "react";
import type { StaticImageData } from "next/image";
import heroHeaderLogo from "@/wexon.dev/Ana-Logo/wexon-dev.png";
import subHeaderLogo from "@/wexon.dev/Ana-Logo/wexon-siyah.png";

/** Hero header logo asset ratio (wexon-dev.png). */
const HERO_LOGO_ASPECT = heroHeaderLogo.width / heroHeaderLogo.height;

/** Rendered hero logo width at h-8 / md:h-9 — sub-header and footer match this footprint. */
export const WEXON_BRAND_LOGO_BOX_CLASS =
  "relative block h-8 w-[calc(2rem*var(--wx-brand-logo-aspect))] shrink-0 md:h-9 md:w-[calc(2.25rem*var(--wx-brand-logo-aspect))]";

export const WEXON_BRAND_LOGO_STYLE = {
  "--wx-brand-logo-aspect": String(HERO_LOGO_ASPECT),
} as CSSProperties;

export const WEXON_BRAND_LOGO_SIZES = "157px";

export const WEXON_BRAND_LOGOS = {
  hero: heroHeaderLogo,
  dark: subHeaderLogo,
} satisfies Record<"hero" | "dark", StaticImageData>;
