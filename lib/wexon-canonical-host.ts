import { buildProductionUnifiedLoginUrl } from "@/lib/wexon/urls";

export const PRODUCTION_ROOT_HOST = "wexon.dev";

export { buildProductionUnifiedLoginUrl };

export const ADMIN_PREFIX = "/admin";
export const CORE_PREFIX = "/dashboard";
export const APP_PREFIX = "/apps/wexpay";

export type HostSurface = "public" | "core" | "app" | "admin";
export type ProductionSubdomain = "admin" | "core" | "app";

export function normalizeHost(host: string | null | undefined) {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? "";
}

export function resolveHostSurface(host: string): HostSurface {
  if (host.startsWith("admin.")) return "admin";
  if (host.startsWith("app.")) return "app";
  if (host.startsWith("core.") || host.startsWith("portal.") || host.startsWith("customer.")) return "core";
  return "public";
}

export function isProductionWexonHost(host: string) {
  return host === PRODUCTION_ROOT_HOST || host.endsWith(`.${PRODUCTION_ROOT_HOST}`);
}

export const PUBLIC_CANONICAL_HOST = `www.${PRODUCTION_ROOT_HOST}`;

export function isPublicRootHost(host: string) {
  const normalized = normalizeHost(host);
  return normalized === PRODUCTION_ROOT_HOST || normalized === PUBLIC_CANONICAL_HOST;
}

/** Redirect apex marketing host to www for consistent canonical URLs. */
export function publicWwwCanonicalRedirect(host: string, pathname: string, search: string) {
  const normalized = normalizeHost(host);
  if (normalized !== PRODUCTION_ROOT_HOST) return null;
  return `https://${PUBLIC_CANONICAL_HOST}${pathname}${search}`;
}

export function isWexonProductionDeployment() {
  if (process.env.NODE_ENV !== "production") return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return appUrl.includes(PRODUCTION_ROOT_HOST);
}

export const MAINTENANCE_ENTRY_PATH = "/on-basvuru";

export function isAdminHost(host: string) {
  const normalized = normalizeHost(host);
  return normalized === `admin.${PRODUCTION_ROOT_HOST}` || normalized.startsWith("admin.");
}

export function isMaintenanceExemptRoute(surface: HostSurface, pathname: string) {
  const isAdminRoute =
    surface === "admin" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === ADMIN_PREFIX ||
    pathname.startsWith(`${ADMIN_PREFIX}/`) ||
    pathname === "/api" ||
    pathname.startsWith("/api/");

  if (isAdminRoute) return true;
  if (pathname === MAINTENANCE_ENTRY_PATH) return true;
  return false;
}

export function stripPathPrefix(pathname: string, prefix: string) {
  if (pathname === prefix || pathname === `${prefix}/`) return "/";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || "/";
  return pathname;
}

/**
 * Public product routes that exist at the Next.js root (not under /dashboard or /apps).
 * Must never be treated as a global "already internal" bypass across surfaces —
 * otherwise core `/wexpay/activation` would skip the `/dashboard` rewrite (404).
 */
export const PUBLIC_ROOT_PASSTHROUGH_PREFIXES = ["/q", "/invite", "/wexpay/t"] as const;

export function isPublicRootPassthroughPath(pathname: string) {
  return PUBLIC_ROOT_PASSTHROUGH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function prefixedPath(pathname: string, prefix: string) {
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return pathname;
  if (pathname === "/") return prefix;
  return `${prefix}${pathname}`;
}

export type SurfaceRouteDecision = {
  surface: HostSurface;
  incomingPathname: string;
  /** Pathname the Next.js App Router should see (rewrite target). */
  internalPathname: string;
  /**
   * Same-host clean URL for GET canonical redirects (strip panel prefix).
   * Null when no redirect is needed (or would loop).
   */
  canonicalRedirectPathname: string | null;
};

/**
 * Pure surface routing: given host surface + incoming pathname, decide
 * internal rewrite target and optional canonical clean-URL redirect.
 * Does not inspect method, auth, or query string.
 */
export function resolveSurfaceRouteDecision(
  surface: HostSurface,
  incomingPathname: string,
): SurfaceRouteDecision {
  const pathname = incomingPathname || "/";

  if (surface === "public") {
    return {
      surface,
      incomingPathname: pathname,
      internalPathname: pathname,
      canonicalRedirectPathname: null,
    };
  }

  if (isPublicRootPassthroughPath(pathname)) {
    return {
      surface,
      incomingPathname: pathname,
      internalPathname: pathname,
      canonicalRedirectPathname: null,
    };
  }

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return {
      surface,
      incomingPathname: pathname,
      internalPathname: pathname,
      canonicalRedirectPathname: null,
    };
  }

  if (surface === "admin") {
    const alreadyPrefixed = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
    const internalPathname = alreadyPrefixed ? pathname : prefixedPath(pathname, ADMIN_PREFIX);
    const canonicalRedirectPathname = alreadyPrefixed
      ? stripPathPrefix(pathname, ADMIN_PREFIX)
      : null;
    return {
      surface,
      incomingPathname: pathname,
      internalPathname,
      canonicalRedirectPathname:
        canonicalRedirectPathname && canonicalRedirectPathname !== pathname
          ? canonicalRedirectPathname
          : null,
    };
  }

  if (surface === "app") {
    const alreadyPrefixed = pathname === APP_PREFIX || pathname.startsWith(`${APP_PREFIX}/`);
    const internalPathname = alreadyPrefixed ? pathname : prefixedPath(pathname, APP_PREFIX);
    const canonicalRedirectPathname = alreadyPrefixed
      ? stripPathPrefix(pathname, APP_PREFIX)
      : null;
    return {
      surface,
      incomingPathname: pathname,
      internalPathname,
      canonicalRedirectPathname:
        canonicalRedirectPathname && canonicalRedirectPathname !== pathname
          ? canonicalRedirectPathname
          : null,
    };
  }

  // core
  if (pathname === `${CORE_PREFIX}/login` || pathname.startsWith(`${CORE_PREFIX}/login/`)) {
    return {
      surface,
      incomingPathname: pathname,
      internalPathname: pathname,
      canonicalRedirectPathname: null,
    };
  }

  const alreadyPrefixed = pathname === CORE_PREFIX || pathname.startsWith(`${CORE_PREFIX}/`);
  const internalPathname = alreadyPrefixed ? pathname : prefixedPath(pathname, CORE_PREFIX);
  let canonicalRedirectPathname: string | null = null;
  if (alreadyPrefixed) {
    const stripped = stripPathPrefix(pathname, CORE_PREFIX);
    if (stripped === "/login" || stripped.startsWith("/login/")) {
      canonicalRedirectPathname = null;
    } else if (stripped !== pathname) {
      canonicalRedirectPathname = stripped;
    }
  }

  return {
    surface,
    incomingPathname: pathname,
    internalPathname,
    canonicalRedirectPathname,
  };
}

function normalizeCanonicalSubdomainPath(_subdomain: ProductionSubdomain, pathname: string) {
  return pathname;
}

export function publicPanelCanonicalTarget(
  host: string,
  pathname: string,
): { kind: "subdomain"; subdomain: ProductionSubdomain; pathname: string } | { kind: "unified-login" } | null {
  if (!isPublicRootHost(host)) return null;
  if (pathname === "/login" || pathname.startsWith("/login/")) return null;

  if (pathname === `${CORE_PREFIX}/login` || pathname.startsWith(`${CORE_PREFIX}/login/`)) {
    return { kind: "unified-login" };
  }

  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    const stripped = normalizeCanonicalSubdomainPath("admin", stripPathPrefix(pathname, ADMIN_PREFIX));
    return { kind: "subdomain", subdomain: "admin", pathname: stripped };
  }

  if (pathname === CORE_PREFIX || pathname.startsWith(`${CORE_PREFIX}/`)) {
    const stripped = stripPathPrefix(pathname, CORE_PREFIX);
    return { kind: "subdomain", subdomain: "core", pathname: stripped };
  }

  if (pathname === APP_PREFIX || pathname.startsWith(`${APP_PREFIX}/`)) {
    const stripped = stripPathPrefix(pathname, APP_PREFIX);
    return { kind: "subdomain", subdomain: "app", pathname: stripped };
  }

  return null;
}

export function subdomainPrefixedCanonicalPath(surface: HostSurface, pathname: string) {
  return resolveSurfaceRouteDecision(surface, pathname).canonicalRedirectPathname;
}

export function buildProductionSubdomainUrl(subdomain: ProductionSubdomain, pathname: string, search = "") {
  const base = `https://${subdomain}.${PRODUCTION_ROOT_HOST}`;
  if (pathname === "/" || pathname === "") return `${base}/${search}`;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}${search}`;
}

export function safeNextPath(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || /[\u0000-\u001f]/.test(trimmed)) return fallback;

  const pathPart = trimmed.split(/[?#]/, 2)[0] ?? trimmed;
  let decodedPath = pathPart;
  try {
    for (let i = 0; i < 3; i += 1) {
      const next = decodeURIComponent(decodedPath);
      if (next === decodedPath) break;
      decodedPath = next;
    }
  } catch {
    return fallback;
  }

  if (!decodedPath.startsWith("/") || decodedPath.startsWith("//")) return fallback;
  if (decodedPath.includes("\\") || decodedPath.includes("://")) return fallback;

  return trimmed;
}

export function resolvePostLoginDestination(
  nextPath: string | undefined,
  options: { isAdmin: boolean; productionWexon?: boolean },
) {
  const productionWexon = options.productionWexon ?? isWexonProductionDeployment();
  const safeNext = safeNextPath(nextPath, "");

  // Admin destinations stay on the admin surface — never cross to app/core hosts.
  if (options.isAdmin) {
    if (!productionWexon) {
      if (
        !safeNext ||
        safeNext.startsWith(APP_PREFIX) ||
        safeNext.startsWith(CORE_PREFIX) ||
        safeNext === "/dashboard" ||
        safeNext.startsWith("/dashboard/")
      ) {
        return ADMIN_PREFIX;
      }
      return safeNext;
    }

    const isCrossSurface =
      safeNext.startsWith(APP_PREFIX) ||
      safeNext.startsWith(CORE_PREFIX) ||
      safeNext === "/dashboard" ||
      safeNext.startsWith("/dashboard/");
    const adminPath =
      !safeNext || safeNext === "/" || safeNext === ADMIN_PREFIX || isCrossSurface
        ? "/"
        : safeNext.startsWith(ADMIN_PREFIX)
          ? stripPathPrefix(safeNext, ADMIN_PREFIX) || "/"
          : safeNext;
    return buildProductionSubdomainUrl("admin", adminPath);
  }

  if (!productionWexon) {
    if (safeNext) return safeNext;
    return CORE_PREFIX;
  }

  if (safeNext.startsWith(APP_PREFIX)) {
    const path = stripPathPrefix(safeNext, APP_PREFIX);
    return buildProductionSubdomainUrl("app", path);
  }

  if (safeNext.startsWith(CORE_PREFIX)) {
    const path = stripPathPrefix(safeNext, CORE_PREFIX);
    return buildProductionSubdomainUrl("core", path);
  }

  if (safeNext.startsWith(ADMIN_PREFIX)) {
    const path = stripPathPrefix(safeNext, ADMIN_PREFIX);
    return buildProductionSubdomainUrl("admin", path || "/");
  }

  return buildProductionSubdomainUrl("core", "/");
}

export function resolveUnauthenticatedLoginRedirect(
  host: string,
  surface: HostSurface,
  nextInternalPath: string,
  search: string,
) {
  const next = `${nextInternalPath}${search}`;
  const isAdminPath = nextInternalPath === ADMIN_PREFIX || nextInternalPath.startsWith(`${ADMIN_PREFIX}/`);

  if (isProductionWexonHost(host)) {
    if (surface === "admin" || isAdminPath) {
      const params = new URLSearchParams();
      if (next) params.set("next", next);
      const query = params.toString();
      return `https://admin.${PRODUCTION_ROOT_HOST}/login${query ? `?${query}` : ""}`;
    }
    return buildProductionUnifiedLoginUrl(next);
  }

  if (surface === "admin" || isAdminPath) {
    return `/admin/login?next=${encodeURIComponent(next)}`;
  }

  return `/dashboard/login?next=${encodeURIComponent(next)}`;
}

export function sessionCookieDomain() {
  return isWexonProductionDeployment() ? `.${PRODUCTION_ROOT_HOST}` : undefined;
}

export function sessionCookieOptions(expires: Date) {
  const domain = sessionCookieDomain();
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
    ...(domain ? { domain } : {}),
  };
}

export function sessionCookieClearOptions() {
  const domain = sessionCookieDomain();
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    ...(domain ? { domain } : {}),
  };
}
