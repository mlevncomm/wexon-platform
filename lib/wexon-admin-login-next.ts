import {
  ADMIN_PREFIX,
  APP_PREFIX,
  CORE_PREFIX,
  isWexonProductionDeployment,
  safeNextPath as canonicalSafeNextPath,
} from "@/lib/wexon-canonical-host";

/** Default post-login path when `next` is absent or invalid. */
export function defaultAdminPostLoginPath(productionWexon = isWexonProductionDeployment()) {
  return productionWexon ? "/" : ADMIN_PREFIX;
}

/**
 * Sanitize admin login `next` values.
 * - Missing/empty/invalid → admin root (`/` in production, `/admin` locally)
 * - Same-host protected paths (e.g. `/applications`) are preserved
 * - Login paths and cross-surface paths are rejected to avoid loops / host jumps
 */
export function safeAdminNextPath(value: string, productionWexon = isWexonProductionDeployment()) {
  const fallback = defaultAdminPostLoginPath(productionWexon);
  const path = canonicalSafeNextPath(value, fallback);
  const pathname = path.split(/[?#]/, 2)[0] ?? path;

  if (pathname === "/login" || pathname.startsWith("/login/")) return fallback;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return fallback;
  if (pathname === "/" || pathname === ADMIN_PREFIX) return fallback;

  // Never allow admin login to bounce to other Wexon surfaces/hosts.
  if (
    pathname.startsWith(APP_PREFIX) ||
    pathname.startsWith(CORE_PREFIX) ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  ) {
    return fallback;
  }

  // Local/preview serve admin under /admin/*; production admin host strips the prefix.
  if (!productionWexon) {
    if (pathname === "/applications" || pathname.startsWith("/applications/")) {
      return `/admin${pathname}${path.slice(pathname.length)}`;
    }
    if (!pathname.startsWith(ADMIN_PREFIX)) {
      return `/admin${pathname.startsWith("/") ? pathname : `/${pathname}`}${path.slice(pathname.length)}`;
    }
  }

  return path;
}
