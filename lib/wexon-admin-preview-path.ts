/**
 * Admin-host WexPay preview URL helpers (PR3).
 * Canonical surface: /admin/organizations/:organizationId/wexpay-preview
 */

import { adminNavigationUrl } from "@/lib/wexon/urls";

export const WEXPAY_APP_BASE_PATH = "/apps/wexpay";

export function wexpayAdminPreviewBasePath(organizationId: string) {
  const id = organizationId.trim();
  return `/admin/organizations/${encodeURIComponent(id)}/wexpay-preview`;
}

/** Absolute/nav href for admin preview (respects admin host in production). */
export function wexpayAdminPreviewHref(
  organizationId: string,
  subpath = "",
  search?: string | Record<string, string | undefined | null>,
) {
  const base = wexpayAdminPreviewBasePath(organizationId);
  const normalizedSub =
    !subpath || subpath === "/"
      ? ""
      : subpath.startsWith("/")
        ? subpath
        : `/${subpath}`;
  const path = `${base}${normalizedSub}`;

  let query = "";
  if (typeof search === "string") {
    query = search.replace(/^\?/, "");
  } else if (search) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value) params.set(key, value);
    }
    query = params.toString();
  }

  return adminNavigationUrl(path, query);
}

const PREVIEW_PATH_RE = /^\/admin\/organizations\/[^/]+\/wexpay-preview(?:\/|$)/;

export function isWexPayAdminPreviewPath(path: string) {
  const pathname = path.split("?")[0] ?? path;
  return PREVIEW_PATH_RE.test(pathname);
}

/** Safe redirect targets for WexPay server actions. */
export function isAllowedWexPayRedirectPath(path: string) {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  const pathname = path.split("?")[0] ?? path;
  return pathname.startsWith(WEXPAY_APP_BASE_PATH) || isWexPayAdminPreviewPath(pathname);
}

export function mapAppPathToPreviewPath(appPath: string, organizationId: string) {
  const pathname = (appPath.split("?")[0] ?? appPath).trim();
  const search = appPath.includes("?") ? appPath.slice(appPath.indexOf("?") + 1) : "";
  if (!pathname.startsWith(WEXPAY_APP_BASE_PATH)) {
    return wexpayAdminPreviewHref(organizationId, "", search);
  }
  const rest =
    pathname === WEXPAY_APP_BASE_PATH || pathname === `${WEXPAY_APP_BASE_PATH}/`
      ? ""
      : pathname.slice(WEXPAY_APP_BASE_PATH.length);
  return wexpayAdminPreviewHref(organizationId, rest, search);
}
