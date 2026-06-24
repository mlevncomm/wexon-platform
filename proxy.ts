import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_ORGANIZATION_COOKIE, ACTIVE_ORGANIZATION_HEADER } from "@/lib/wexon-organization-context";

const ADMIN_SESSION_COOKIE = "wexon_admin_session";
const CUSTOMER_SESSION_COOKIE = "wexon_customer_session";
const APP_PREFIX = "/apps/wexpay";
const CORE_PREFIX = "/dashboard";
const ADMIN_PREFIX = "/admin";
const INTERNAL_PREFIXES = [APP_PREFIX, CORE_PREFIX, ADMIN_PREFIX, "/demo", "/wexpay", "/checkout", "/signup", "/start", "/contact"];

type HostSurface = "public" | "core" | "app" | "admin";

function adminProxyDebug(label: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[WEXON_ADMIN_DEBUG]", label, data ?? {});
  }
}

function normalizeHost(host: string | null) {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? "";
}

function resolveHostSurface(host: string): HostSurface {
  if (host.startsWith("admin.")) return "admin";
  if (host.startsWith("app.")) return "app";
  if (host.startsWith("core.") || host.startsWith("portal.") || host.startsWith("customer.")) return "core";
  return "public";
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

export function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const surface = resolveHostSurface(host);
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
    const loginUrl = routedUrl.clone();
    loginUrl.pathname = "/dashboard/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    adminProxyDebug("proxy:redirect_change_password_login", { from: pathname, to: `${loginUrl.pathname}${loginUrl.search}` });
    return NextResponse.redirect(loginUrl);
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
    const loginUrl = routedUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    adminProxyDebug("proxy:redirect_login", { from: pathname, to: `${loginUrl.pathname}${loginUrl.search}` });
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/dashboard") && !customerSessionCookie && !adminSessionCookie) {
    const loginUrl = routedUrl.clone();
    loginUrl.pathname = "/dashboard/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    adminProxyDebug("proxy:redirect_dashboard_login", { from: pathname, to: `${loginUrl.pathname}${loginUrl.search}` });
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/apps/wexpay") && !customerSessionCookie && !adminSessionCookie) {
    const loginUrl = routedUrl.clone();
    loginUrl.pathname = "/dashboard/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    adminProxyDebug("proxy:redirect_wexpay_login", { from: pathname, to: `${loginUrl.pathname}${loginUrl.search}` });
    return NextResponse.redirect(loginUrl);
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
