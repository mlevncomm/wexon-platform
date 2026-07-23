import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_ORGANIZATION_COOKIE, ACTIVE_ORGANIZATION_HEADER } from "@/lib/wexon-organization-context";
import {
  ADMIN_PREFIX,
  CORE_PREFIX,
  buildProductionSubdomainUrl,
  buildProductionUnifiedLoginUrl,
  isAdminHost,
  isMaintenanceExemptRoute,
  isProductionWexonHost,
  isPublicRootHost,
  MAINTENANCE_ENTRY_PATH,
  normalizeHost,
  publicPanelCanonicalTarget,
  publicWwwCanonicalRedirect,
  resolveHostSurface,
  resolveSurfaceRouteDecision,
  resolveUnauthenticatedLoginRedirect,
  stripPathPrefix,
  type HostSurface,
} from "@/lib/wexon-canonical-host";
import { isPublicMarketingPath, publicUrl } from "@/lib/wexon/urls";
import { ADMIN_SESSION_COOKIE } from "@/lib/wexon-admin-session-cookie";

const CUSTOMER_SESSION_COOKIE = "wexon_customer_session";
const MAINTENANCE_MODE_ENABLED = process.env.MAINTENANCE_MODE === "true";

function adminProxyDebug(label: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[WEXON_ADMIN_DEBUG]", label, data ?? {});
  }
}

function stripAdminPrefix(pathname: string) {
  return stripPathPrefix(pathname, ADMIN_PREFIX);
}

function redirectTo(request: NextRequest, target: string | URL) {
  const url = target instanceof URL ? target : new URL(target, request.nextUrl);
  return NextResponse.redirect(url);
}

function withOrganizationContext(
  request: NextRequest,
  routedUrl: URL,
  routedPathname: string,
  responseFactory: (init?: { request?: { headers: Headers } }) => NextResponse,
) {
  const organizationIdFromQuery = routedUrl.searchParams.get("organizationId")?.trim();
  const organizationIdFromAdminPath = routedPathname.match(/^\/admin\/organizations\/([^/]+)$/)?.[1];
  const organizationId = organizationIdFromQuery ?? organizationIdFromAdminPath;

  const requestHeaders = new Headers(request.headers);
  if (organizationId) {
    requestHeaders.set(ACTIVE_ORGANIZATION_HEADER, organizationId);
  }

  const response = responseFactory({ request: { headers: requestHeaders } });

  if (organizationId && routedPathname.startsWith("/admin/organizations/")) {
    response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

function handleAdminHost(request: NextRequest) {
  const url = request.nextUrl.clone();
  const originalPathname = url.pathname;
  const { search } = url;
  const adminSessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  adminProxyDebug("admin-host:request", {
    originalPathname,
    method: request.method,
    hasAdminCookie: Boolean(adminSessionCookie),
  });

  if (request.method === "GET" && originalPathname === "/") {
    if (!adminSessionCookie) {
      url.pathname = "/login";
      url.search = "";
      adminProxyDebug("admin-host:redirect_root_login", { to: url.pathname });
      return redirectTo(request, url);
    }

    url.pathname = "/admin";
    adminProxyDebug("admin-host:rewrite_root_dashboard", { to: url.pathname });
    return withOrganizationContext(request, url, "/admin", (init) => NextResponse.rewrite(url, init));
  }

  if (originalPathname === "/login" || originalPathname.startsWith("/login/")) {
    if (adminSessionCookie && request.method === "GET") {
      url.pathname = "/";
      url.search = "";
      adminProxyDebug("admin-host:redirect_login_authed", { to: url.pathname });
      return redirectTo(request, url);
    }

    url.pathname = originalPathname.replace(/^\/login/, "/admin/login");
    url.search = search;
    adminProxyDebug("admin-host:rewrite_login", { to: url.pathname });
    return NextResponse.rewrite(url);
  }

  if (originalPathname === "/admin/login" || originalPathname.startsWith("/admin/login/")) {
    adminProxyDebug("admin-host:next_login");
    return NextResponse.next();
  }

  const routedUrl = request.nextUrl.clone();
  if (!originalPathname.startsWith("/admin")) {
    routedUrl.pathname = originalPathname === "/" ? "/admin" : `/admin${originalPathname}`;
  }
  const routedPathname = routedUrl.pathname;
  const shouldRewrite = routedPathname !== originalPathname;

  if (request.method !== "GET") {
    adminProxyDebug("admin-host:next_non_get", { routedPathname, shouldRewrite });
    return shouldRewrite
      ? withOrganizationContext(request, routedUrl, routedPathname, (init) =>
          NextResponse.rewrite(routedUrl, init),
        )
      : NextResponse.next();
  }

  if (!adminSessionCookie && routedPathname.startsWith("/admin")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const nextPath = originalPathname.startsWith("/admin")
      ? stripAdminPrefix(originalPathname)
      : originalPathname;
    if (nextPath && nextPath !== "/" && nextPath !== "/login") {
      loginUrl.searchParams.set("next", `${nextPath}${search}`);
    }
    adminProxyDebug("admin-host:redirect_login", { from: originalPathname, to: loginUrl.pathname, nextPath });
    return redirectTo(request, loginUrl);
  }

  adminProxyDebug("admin-host:next", { routedPathname, shouldRewrite });
  return shouldRewrite
    ? withOrganizationContext(request, routedUrl, routedPathname, (init) => NextResponse.rewrite(routedUrl, init))
    : withOrganizationContext(request, routedUrl, routedPathname, (init) => NextResponse.next(init));
}

function productionCanonicalRedirect(request: NextRequest, host: string, surface: HostSurface) {
  if (request.method !== "GET") return null;

  const { pathname, search } = request.nextUrl;

  if (isPublicRootHost(host)) {
    const publicTarget = publicPanelCanonicalTarget(host, pathname);
    if (publicTarget?.kind === "unified-login") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = search;
      return redirectTo(request, loginUrl);
    }
    if (publicTarget?.kind === "subdomain") {
      const target = new URL(
        buildProductionSubdomainUrl(publicTarget.subdomain, publicTarget.pathname, search),
      );
      return redirectTo(request, target);
    }
  }

  if (isProductionWexonHost(host) && surface !== "public") {
    if (surface === "core" && (pathname === `${CORE_PREFIX}/login` || pathname.startsWith(`${CORE_PREFIX}/login/`))) {
      return redirectTo(request, buildProductionUnifiedLoginUrl());
    }

    if (pathname !== "/" && isPublicMarketingPath(pathname)) {
      return redirectTo(request, publicUrl(`${pathname}${search}`));
    }

    const decision = resolveSurfaceRouteDecision(surface, pathname);
    if (decision.canonicalRedirectPathname) {
      const targetUrl = request.nextUrl.clone();
      targetUrl.pathname = decision.canonicalRedirectPathname;
      targetUrl.search = search;
      return redirectTo(request, targetUrl);
    }
  }

  return null;
}

function resolveSurfacePath(pathname: string, surface: HostSurface) {
  return resolveSurfaceRouteDecision(surface, pathname).internalPathname;
}

function maintenanceModeRedirect(request: NextRequest, surface: HostSurface) {
  if (!MAINTENANCE_MODE_ENABLED || request.method !== "GET") return null;

  const { pathname, search } = request.nextUrl;
  if (isMaintenanceExemptRoute(surface, pathname)) return null;

  const targetUrl = request.nextUrl.clone();
  targetUrl.pathname = MAINTENANCE_ENTRY_PATH;
  targetUrl.search = "";
  if (pathname !== "/") {
    targetUrl.searchParams.set("from", `${pathname}${search}`);
  }
  return redirectTo(request, targetUrl);
}

export function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));

  if (isAdminHost(host)) {
    return handleAdminHost(request);
  }

  const surface = resolveHostSurface(host);

  if (request.method === "GET" && surface === "public") {
    const wwwTarget = publicWwwCanonicalRedirect(host, request.nextUrl.pathname, request.nextUrl.search);
    if (wwwTarget) {
      return redirectTo(request, wwwTarget);
    }
  }

  const canonicalRedirect = productionCanonicalRedirect(request, host, surface);
  if (canonicalRedirect) return canonicalRedirect;

  const maintenanceRedirect = maintenanceModeRedirect(request, surface);
  if (maintenanceRedirect) return maintenanceRedirect;

  const routedUrl = request.nextUrl.clone();
  const originalPathname = routedUrl.pathname;
  routedUrl.pathname = resolveSurfacePath(originalPathname, surface);
  const shouldRewrite = routedUrl.pathname !== originalPathname;
  const { pathname, search } = routedUrl;
  const adminSessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const customerSessionCookie = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;

  adminProxyDebug("proxy:request", {
    path: pathname,
    host,
    surface,
    originalPathname,
    shouldRewrite,
    method: request.method,
    isLogin: pathname === "/admin/login",
    hasAdminCookie: Boolean(adminSessionCookie),
    hasCustomerCookie: Boolean(customerSessionCookie),
  });

  if (pathname === "/dashboard/login") {
    adminProxyDebug("proxy:next_dashboard_login");
    return shouldRewrite ? NextResponse.rewrite(routedUrl) : NextResponse.next();
  }

  if (pathname === "/dashboard/change-password" && request.method === "GET" && !customerSessionCookie) {
    const loginTarget = resolveUnauthenticatedLoginRedirect(host, surface, pathname, search);
    adminProxyDebug("proxy:redirect_change_password_login", { from: pathname, to: loginTarget });
    return redirectTo(request, loginTarget);
  }

  if (pathname === "/admin/login") {
    adminProxyDebug("proxy:next_login");
    return shouldRewrite ? NextResponse.rewrite(routedUrl) : NextResponse.next();
  }

  if (request.method !== "GET") {
    adminProxyDebug("proxy:next_non_get", { path: pathname, method: request.method });
    return shouldRewrite ? NextResponse.rewrite(routedUrl) : NextResponse.next();
  }

  if (pathname.startsWith("/admin") && !adminSessionCookie) {
    const nextPath = `${pathname}${search}`;
    const loginTarget = resolveUnauthenticatedLoginRedirect(host, surface, nextPath, "");
    adminProxyDebug("proxy:redirect_login", { from: pathname, to: loginTarget });
    return redirectTo(request, loginTarget);
  }

  if (pathname.startsWith("/dashboard") && !customerSessionCookie && !adminSessionCookie) {
    const loginTarget = resolveUnauthenticatedLoginRedirect(host, surface, `${pathname}${search}`, "");
    adminProxyDebug("proxy:redirect_dashboard_login", { from: pathname, to: loginTarget });
    return redirectTo(request, loginTarget);
  }

  if (pathname.startsWith("/apps/wexpay") && !customerSessionCookie && !adminSessionCookie) {
    const loginTarget = resolveUnauthenticatedLoginRedirect(host, surface, `${pathname}${search}`, "");
    adminProxyDebug("proxy:redirect_wexpay_login", { from: pathname, to: loginTarget });
    return redirectTo(request, loginTarget);
  }

  return withOrganizationContext(request, routedUrl, pathname, (init) =>
    shouldRewrite ? NextResponse.rewrite(routedUrl, init) : NextResponse.next(init),
  );
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
