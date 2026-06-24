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

export function isPublicRootHost(host: string) {
  const normalized = normalizeHost(host);
  return normalized === PRODUCTION_ROOT_HOST || normalized === `www.${PRODUCTION_ROOT_HOST}`;
}

export function isWexonProductionDeployment() {
  if (process.env.NODE_ENV !== "production") return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return appUrl.includes(PRODUCTION_ROOT_HOST);
}

export function shouldUseWexonCookieDomain() {
  return isWexonProductionDeployment();
}

export function stripPathPrefix(pathname: string, prefix: string) {
  if (pathname === prefix || pathname === `${prefix}/`) return "/";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || "/";
  return pathname;
}

function normalizeCanonicalSubdomainPath(subdomain: ProductionSubdomain, pathname: string) {
  if (subdomain === "admin" && pathname === "/login") return "/";
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
  if (surface === "public") return null;

  const prefix =
    surface === "admin" ? ADMIN_PREFIX : surface === "core" ? CORE_PREFIX : surface === "app" ? APP_PREFIX : null;
  if (!prefix) return null;

  const isPrefixed = pathname === prefix || pathname.startsWith(`${prefix}/`);
  if (!isPrefixed) return null;

  let stripped = stripPathPrefix(pathname, prefix);
  if (surface === "admin") {
    stripped = normalizeCanonicalSubdomainPath("admin", stripped);
  }
  if (surface === "core" && (stripped === "/login" || stripped.startsWith("/login/"))) {
    return null;
  }

  return stripped === pathname ? null : stripped;
}

export function buildProductionSubdomainUrl(subdomain: ProductionSubdomain, pathname: string, search = "") {
  const base = `https://${subdomain}.${PRODUCTION_ROOT_HOST}`;
  if (pathname === "/" || pathname === "") return `${base}/${search}`;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}${search}`;
}

export function safeNextPath(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed;
}

export function resolvePostLoginDestination(
  nextPath: string | undefined,
  options: { isAdmin: boolean; productionWexon?: boolean },
) {
  const productionWexon = options.productionWexon ?? isWexonProductionDeployment();
  const safeNext = safeNextPath(nextPath, "");

  if (!productionWexon) {
    if (safeNext) return safeNext;
    return options.isAdmin ? ADMIN_PREFIX : CORE_PREFIX;
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
    const path = normalizeCanonicalSubdomainPath("admin", stripPathPrefix(safeNext, ADMIN_PREFIX));
    return buildProductionSubdomainUrl("admin", path);
  }

  if (options.isAdmin) {
    return buildProductionSubdomainUrl("admin", "/");
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

  if (isProductionWexonHost(host)) {
    if (surface === "admin") {
      const params = new URLSearchParams();
      if (next) params.set("next", next);
      const query = params.toString();
      return `https://admin.${PRODUCTION_ROOT_HOST}/${query ? `?${query}` : ""}`;
    }
    return buildProductionUnifiedLoginUrl(next);
  }

  if (surface === "admin") {
    return `/admin/login?next=${encodeURIComponent(next)}`;
  }

  return `/dashboard/login?next=${encodeURIComponent(next)}`;
}

export function sessionCookieOptions(expires: Date) {
  const options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    expires: Date;
    domain?: string;
  } = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };

  if (shouldUseWexonCookieDomain()) {
    options.domain = `.${PRODUCTION_ROOT_HOST}`;
  }

  return options;
}

export function sessionCookieClearOptions() {
  const options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    expires: Date;
    domain?: string;
  } = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  };

  if (shouldUseWexonCookieDomain()) {
    options.domain = `.${PRODUCTION_ROOT_HOST}`;
  }

  return options;
}
