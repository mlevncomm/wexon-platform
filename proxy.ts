import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_ORGANIZATION_COOKIE, ACTIVE_ORGANIZATION_HEADER } from "@/lib/wexon-organization-context";
import {
  ADMIN_PREFIX,
  APP_PREFIX,
  CORE_PREFIX,
  buildProductionSubdomainUrl,
  buildProductionUnifiedLoginUrl,
  isProductionWexonHost,
  isPublicRootHost,
  normalizeHost,
  publicPanelCanonicalTarget,
  resolveHostSurface,
  resolveUnauthenticatedLoginRedirect,
  stripPathPrefix,
  subdomainPrefixedCanonicalPath,
  type HostSurface,
} from "@/lib/wexon-canonical-host";
import { isPublicMarketingPath, publicUrl } from "@/lib/wexon/urls";

const ADMIN_SESSION_COOKIE = "wexon_admin_session";
const CUSTOMER_SESSION_COOKIE = "wexon_customer_session";
const INTERNAL_PREFIXES = [APP_PREFIX, CORE_PREFIX, ADMIN_PREFIX, "/demo", "/wexpay", "/checkout", "/signup", "/start", "/contact"];
const MAINTENANCE_MODE_ENABLED = true;
const MAINTENANCE_ENTRY_PATH = "/on-basvuru";

function adminProxyDebug(label: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[WEXON_ADMIN_DEBUG]", label, data ?? {});
  }
}

function stripAdminPrefix(pathname: string) {
  return stripPathPrefix(pathname, ADMIN_PREFIX);
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
      return NextResponse.redirect(loginUrl);
    }
    if (publicTarget?.kind === "subdomain") {
      const target = new URL(
        buildProductionSubdomainUrl(publicTarget.subdomain, publicTarget.pathname, search),
      );
      return NextResponse.redirect(target);
    }
  }

  if (isProductionWexonHost(host) && surface !== "public") {
    if (surface === "core" && (pathname === `${CORE_PREFIX}/login` || pathname.startsWith(`${CORE_PREFIX}/login/`))) {
      return NextResponse.redirect(buildProductionUnifiedLoginUrl());
    }

    if (pathname !== "/" && isPublicMarketingPath(pathname)) {
      return NextResponse.redirect(publicUrl(`${pathname}${search}`));
    }

    const stripped = subdomainPrefixedCanonicalPath(surface, pathname);
    if (stripped) {
      const targetUrl = request.nextUrl.clone();
      targetUrl.pathname = stripped;
      targetUrl.search = search;
      return NextResponse.redirect(targetUrl);
    }
  }

  return null;
}

function prefixedPath(pathname: string, prefix: string) {
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return pathname;
  if (pathname === "/") return prefix;
  return `${prefix}${pathname}`;
}

function resolveSurfacePath(pathname: string, surface: HostSurface) {
  if (INTERNAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return pathname;
  }
  if (surface === "admin") return prefixedPath(pathname, ADMIN_PREFIX);
  if (surface === "app") return prefixedPath(pathname, APP_PREFIX);
  if (surface === "core") return prefixedPath(pathname, CORE_PREFIX);
  return pathname;
}

function maintenanceModeRedirect(request: NextRequest, surface: HostSurface) {
  if (!MAINTENANCE_MODE_ENABLED || request.method !== "GET") return null;
  if (surface === "admin") return null;

  const { pathname, search } = request.nextUrl;
  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) return null;
  if (pathname === MAINTENANCE_ENTRY_PATH) return null;

  const targetUrl = request.nextUrl.clone();
  targetUrl.pathname = MAINTENANCE_ENTRY_PATH;
  targetUrl.search = "";
  if (pathname !== "/") {
    targetUrl.searchParams.set("from", `${pathname}${search}`);
  }
  return NextResponse.redirect(targetUrl);
}

export function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const surface = resolveHostSurface(host);
  const maintenanceRedirect = maintenanceModeRedirect(request, surface);
  if (maintenanceRedirect) return maintenanceRedirect;

  const canonicalRedirect = productionCanonicalRedirect(request, host, surface);
  if (canonicalRedirect) return canonicalRedirect;

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
    return NextResponse.redirect(loginTarget);
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
    const nextPath = `${surface === "admin" ? stripAdminPrefix(pathname) : pathname}${search}`;

    if (surface === "admin") {
      const isLoginRoute = originalPathname === "/login" || pathname === "/admin/login";

      if (isLoginRoute) {
        const loginUrl = routedUrl.clone();
        loginUrl.pathname = "/admin/login";
        loginUrl.search = search;
        adminProxyDebug("proxy:rewrite_admin_login", {
          from: pathname,
          originalPathname,
          to: loginUrl.pathname,
        });
        return NextResponse.rewrite(loginUrl);
      }

      const loginRedirect = request.nextUrl.clone();
      loginRedirect.pathname = "/login";
      loginRedirect.search = "";
      if (nextPath && nextPath !== "/" && nextPath !== "/login") {
        loginRedirect.searchParams.set("next", nextPath);
      }
      adminProxyDebug("proxy:redirect_admin_login", {
        from: originalPathname,
        to: loginRedirect.pathname,
        nextPath,
      });
      return NextResponse.redirect(loginRedirect);
    }

    const loginTarget = resolveUnauthenticatedLoginRedirect(host, surface, nextPath, search);
    adminProxyDebug("proxy:redirect_login", { from: pathname, to: loginTarget });
    return NextResponse.redirect(loginTarget);
  }

  if (pathname.startsWith("/dashboard") && !customerSessionCookie && !adminSessionCookie) {
    const loginTarget = resolveUnauthenticatedLoginRedirect(host, surface, `${pathname}${search}`, "");
    adminProxyDebug("proxy:redirect_dashboard_login", { from: pathname, to: loginTarget });
    return NextResponse.redirect(loginTarget);
  }

  if (pathname.startsWith("/apps/wexpay") && !customerSessionCookie && !adminSessionCookie) {
    const loginTarget = resolveUnauthenticatedLoginRedirect(host, surface, `${pathname}${search}`, "");
    adminProxyDebug("proxy:redirect_wexpay_login", { from: pathname, to: loginTarget });
    return NextResponse.redirect(loginTarget);
  }

  const organizationIdFromQuery = routedUrl.searchParams.get("organizationId")?.trim();
  const organizationIdFromAdminPath = pathname.match(/^\/admin\/organizations\/([^/]+)$/)?.[1];
  const organizationId = organizationIdFromQuery ?? organizationIdFromAdminPath;

  const requestHeaders = new Headers(request.headers);
  if (organizationId) {
    requestHeaders.set(ACTIVE_ORGANIZATION_HEADER, organizationId);
  }

  const response = shouldRewrite
    ? NextResponse.rewrite(routedUrl, {
        request: {
          headers: requestHeaders,
        },
      })
    : NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

  if (
    organizationId &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/apps/wexpay") ||
      pathname.startsWith("/admin/organizations/"))
  ) {
    response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      ...(process.env.NODE_ENV === "production" &&
      (process.env.NEXT_PUBLIC_APP_URL ?? "").includes("wexon.dev")
        ? { domain: ".wexon.dev" }
        : {}),
    });
  }

  adminProxyDebug("proxy:next", {
    path: pathname,
    originalPathname,
    surface,
    shouldRewrite,
    organizationId: organizationId ?? null,
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
