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

const PREVIEW_PATH_RE = /^\/admin\/organizations\/([^/]+)\/wexpay-preview(?:\/|$)/;

export function isWexPayAdminPreviewPath(path: string) {
  const pathname = path.split("?")[0] ?? path;
  return PREVIEW_PATH_RE.test(pathname);
}

export function extractWexPayAdminPreviewOrganizationId(path: string): string | null {
  const pathname = path.split("?")[0] ?? path;
  const match = pathname.match(PREVIEW_PATH_RE);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** True when path is an admin preview URL for the given organizationId. */
export function isSameOrgWexPayAdminPreviewPath(path: string, organizationId: string) {
  const fromPath = extractWexPayAdminPreviewOrganizationId(path);
  return Boolean(fromPath && fromPath === organizationId);
}

/**
 * Safe redirect targets for WexPay server actions.
 * Customer `/apps/wexpay...` paths remain allowed without org confinement.
 * Admin preview paths are accepted here; callers that know organizationId must
 * further confine via `resolveSafeWexPayRedirectPath`.
 */
export function isAllowedWexPayRedirectPath(path: string) {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  const pathname = path.split("?")[0] ?? path;
  return pathname.startsWith(WEXPAY_APP_BASE_PATH) || isWexPayAdminPreviewPath(pathname);
}

/**
 * Resolve a post-mutation redirect.
 * - `/apps/wexpay...` unchanged (customer surface).
 * - Admin preview paths must stay under the same organizationId; cross-org
 *   preview paths fall back to that org's preview base.
 */
export function resolveSafeWexPayRedirectPath(
  path: string | null | undefined,
  organizationId: string,
  fallback: string,
) {
  if (!path || !isAllowedWexPayRedirectPath(path)) return fallback;
  const pathname = path.split("?")[0] ?? path;
  if (pathname.startsWith(WEXPAY_APP_BASE_PATH)) return path;
  if (isWexPayAdminPreviewPath(pathname)) {
    return isSameOrgWexPayAdminPreviewPath(pathname, organizationId)
      ? path
      : wexpayAdminPreviewBasePath(organizationId);
  }
  return fallback;
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
