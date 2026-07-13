export const WEXON_INSTAGRAM = {
  id: "instagram",
  label: "Instagram",
  handle: "@wexon.dev",
  href: "https://www.instagram.com/wexon.dev/",
  ariaLabel: "Wexon.dev Instagram",
} as const;

/** Official public social profiles only — do not invent accounts. */
export const WEXON_SOCIAL_LINKS = [WEXON_INSTAGRAM] as const;

export type WexonSocialLink = (typeof WEXON_SOCIAL_LINKS)[number];
