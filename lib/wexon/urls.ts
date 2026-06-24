export const PRODUCTION_ROOT_HOST = "wexon.dev";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isWexonProductionDeployment() {
  if (process.env.NODE_ENV !== "production") return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return appUrl.includes(PRODUCTION_ROOT_HOST);
}

function buildProductionSubdomainUrl(subdomain: "admin" | "core" | "app", pathname: string) {
  const base = `https://${subdomain}.${PRODUCTION_ROOT_HOST}`;
  if (pathname === "/" || pathname === "") return `${base}/`;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

export function appendUrlSearch(href: string, search: string) {
  if (!search) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${search.replace(/^\?/, "")}`;
}

export function stripKnownPrefix(path: string, prefix: string) {
  if (path === prefix || path === `${prefix}/`) return "/";
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || "/";
  return path;
}

export function resolveWexonPublicOrigin() {
  const configured = process.env.NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN?.trim();
  if (configured) return trimTrailingSlash(configured);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (isWexonProductionDeployment() || appUrl.includes(PRODUCTION_ROOT_HOST)) {
    return `https://${PRODUCTION_ROOT_HOST}`;
  }

  return "";
}

export const WEXON_PUBLIC_ORIGIN = resolveWexonPublicOrigin();

export function publicUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (WEXON_PUBLIC_ORIGIN) {
    return `${WEXON_PUBLIC_ORIGIN}${normalizedPath}`;
  }
  return normalizedPath;
}

export function unifiedLoginUrl(nextPath?: string) {
  const base = publicUrl("/login");
  if (!nextPath?.trim()) return base;
  const params = new URLSearchParams({ next: nextPath });
  return `${base}?${params.toString()}`;
}

export function buildProductionUnifiedLoginUrl(nextPath?: string) {
  return unifiedLoginUrl(nextPath);
}

export function customerLoginUrl(options?: { next?: string; customerError?: string }) {
  if (isWexonProductionDeployment()) {
    const url = new URL(unifiedLoginUrl(options?.next));
    if (options?.customerError) {
      url.searchParams.set("authError", options.customerError);
    }
    return url.toString();
  }

  const params = new URLSearchParams();
  if (options?.customerError) params.set("customerError", options.customerError);
  if (options?.next) params.set("next", options.next);
  const query = params.toString();
  return query ? `/dashboard/login?${query}` : "/dashboard/login";
}

export function adminPanelUrl(path = "/") {
  if (isWexonProductionDeployment()) {
    return buildProductionSubdomainUrl("admin", path);
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath === "/" || normalizedPath === "") return "/admin";
  return `/admin${normalizedPath}`;
}

export function adminNavigationUrl(path = "/", search = "") {
  return appendUrlSearch(adminPanelUrl(stripKnownPrefix(path, "/admin")), search);
}

export function corePanelUrl(path = "/") {
  if (isWexonProductionDeployment()) {
    return buildProductionSubdomainUrl("core", path);
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath === "/" || normalizedPath === "") return "/dashboard";
  return `/dashboard${normalizedPath}`;
}

export function coreNavigationUrl(path = "/", search = "") {
  return appendUrlSearch(corePanelUrl(stripKnownPrefix(path, "/dashboard")), search);
}

export function appPanelUrl(path = "/") {
  if (isWexonProductionDeployment()) {
    return buildProductionSubdomainUrl("app", path);
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath === "/" || normalizedPath === "") return "/apps/wexpay";
  return `/apps/wexpay${normalizedPath}`;
}

export function appNavigationUrl(path = "/", search = "") {
  return appendUrlSearch(appPanelUrl(stripKnownPrefix(path, "/apps/wexpay")), search);
}

export const PUBLIC_MARKETING_PATHS = [
  "/",
  "/about",
  "/blog",
  "/book-demo",
  "/careers",
  "/changelog",
  "/contact",
  "/demo-request",
  "/docs",
  "/api-reference",
  "/status",
  "/links",
  "/login",
  "/signup",
  "/checkout",
  "/apply",
  "/start",
  "/products",
  "/legal",
  "/demo/wexpay",
] as const;

export function isPublicMarketingPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return PUBLIC_MARKETING_PATHS.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function resolveNavigationHref(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/#")) return publicUrl(path);
  if (isPublicMarketingPath(path)) return publicUrl(path);
  return path;
}
