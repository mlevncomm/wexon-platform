import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/wexon-organization-context";

const ADMIN_SESSION_COOKIE = "wexon_admin_session";
const CUSTOMER_SESSION_COOKIE = "wexon_customer_session";

function adminProxyDebug(label: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[WEXON_ADMIN_DEBUG]", label, data ?? {});
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const adminSessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const customerSessionCookie = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;

  adminProxyDebug("proxy:request", {
    path: pathname,
    method: request.method,
    isLogin: pathname === "/admin/login",
    hasAdminCookie: Boolean(adminSessionCookie),
    hasCustomerCookie: Boolean(customerSessionCookie),
  });

  if (pathname === "/dashboard/login") {
    adminProxyDebug("proxy:next_dashboard_login");
    return NextResponse.next();
  }

  if (pathname === "/dashboard/change-password" && request.method === "GET" && !customerSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/dashboard/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    adminProxyDebug("proxy:redirect_change_password_login", { from: pathname, to: `${loginUrl.pathname}${loginUrl.search}` });
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/admin/login") {
    adminProxyDebug("proxy:next_login");
    return NextResponse.next();
  }

  if (request.method !== "GET") {
    adminProxyDebug("proxy:next_non_get", { path: pathname, method: request.method });
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && !adminSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    adminProxyDebug("proxy:redirect_login", { from: pathname, to: `${loginUrl.pathname}${loginUrl.search}` });
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/dashboard") && !customerSessionCookie && !adminSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/dashboard/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    adminProxyDebug("proxy:redirect_dashboard_login", { from: pathname, to: `${loginUrl.pathname}${loginUrl.search}` });
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/apps/wexpay") && !customerSessionCookie && !adminSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/dashboard/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    adminProxyDebug("proxy:redirect_wexpay_login", { from: pathname, to: `${loginUrl.pathname}${loginUrl.search}` });
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  const organizationIdFromQuery = request.nextUrl.searchParams.get("organizationId")?.trim();
  const organizationIdFromAdminPath = pathname.match(/^\/admin\/organizations\/([^/]+)$/)?.[1];
  const organizationId = organizationIdFromQuery ?? organizationIdFromAdminPath;
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

  adminProxyDebug("proxy:next", { path: pathname });
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/apps/wexpay/:path*"],
};
