/** Shared admin layout tokens — UI only, no env secrets. */

export const ADMIN_SIDEBAR_WIDTH_PX = 260;
export const ADMIN_CONTENT_MAX_PX = 1800;

/** Horizontal padding for admin content / topbar alignment. */
export const ADMIN_PAGE_PADDING =
  "px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12";

/** Gaps for KPI / card grids. */
export const ADMIN_GRID_GAP = "gap-4 xl:gap-5 2xl:gap-6";

export function resolveAdminEnvironmentBadge(): "Production" | "Preview" | "Local" {
  const vercel = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercel === "production") return "Production";
  if (vercel === "preview") return "Preview";
  if (process.env.NODE_ENV === "production" && vercel === "") return "Production";
  return "Local";
}
