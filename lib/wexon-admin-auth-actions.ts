"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerActionIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import {
  ADMIN_LOGIN_GENERIC_ERROR,
  ADMIN_PRODUCTION_LOGIN_URL,
  adminDebug,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  isAdminAccessHostAllowed,
  isAdminEmailAllowed,
  securePasswordEqual,
} from "@/lib/wexon-admin-auth";
import { clearCustomerSessionCookie } from "@/lib/wexon-customer-auth";
import {
  isWexonProductionDeployment,
  normalizeHost,
  resolvePostLoginDestination,
  safeNextPath as canonicalSafeNextPath,
} from "@/lib/wexon-canonical-host";
import { clearActiveOrganizationCookie } from "@/lib/wexon-organization-context";
import { unifiedLoginUrl } from "@/lib/wexon/urls";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeAdminNextPath(value: string) {
  const path = canonicalSafeNextPath(value, "/applications");
  const productionWexon = isWexonProductionDeployment();

  if (path === "/login" || path.startsWith("/login/")) {
    return productionWexon ? "/applications" : "/admin";
  }
  if (path.startsWith("/admin/login")) {
    return productionWexon ? "/applications" : "/admin";
  }
  if (path === "/" || path === "/admin") {
    return productionWexon ? "/applications" : "/admin";
  }

  // Local/preview serve admin under /admin/*; production admin host strips the prefix.
  if (!productionWexon) {
    if (path === "/applications" || path.startsWith("/applications/")) {
      return `/admin${path}`;
    }
    if (!path.startsWith("/admin")) {
      return `/admin${path.startsWith("/") ? path : `/${path}`}`;
    }
  }

  return path;
}

function adminLoginPath() {
  return isWexonProductionDeployment() ? "/login" : "/admin/login";
}

function redirectLoginError(
  nextPath: string,
  details: { email?: string; reason: "rate_limited" | "invalid_credentials" | "config_missing" },
) {
  const userMessage =
    details.reason === "rate_limited"
      ? "Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin."
      : ADMIN_LOGIN_GENERIC_ERROR;

  adminDebug("login:error_redirect", { reason: details.reason, next: safeAdminNextPath(nextPath) });
  writeAuditFailure({
    action:
      details.reason === "rate_limited"
        ? "admin.auth.rate_limited"
        : details.reason === "config_missing"
          ? "admin.auth.config_missing"
          : "admin.auth.login_failed",
    message: details.reason,
    level: "WARN",
    source: "admin_auth",
    metadata: { email: details?.email, next: safeAdminNextPath(nextPath), reason: details.reason },
  });
  const params = new URLSearchParams({ adminError: userMessage });
  if (nextPath) {
    params.set("next", safeAdminNextPath(nextPath));
  }
  redirect(`${adminLoginPath()}?${params.toString()}`);
}

export async function loginAdminAction(formData: FormData) {
  adminDebug("login:start");
  const productionWexon = isWexonProductionDeployment();
  const headerStore = await headers();
  const host = headerStore.get("host") ?? headerStore.get("x-forwarded-host");

  // Host gate MUST run before reading credentials into rate limits or password checks.
  if (!isAdminAccessHostAllowed(host, productionWexon)) {
    adminDebug("login:wrong_host", { host: normalizeHost(host) });
    writeAuditFailure({
      action: "admin.auth.wrong_host",
      message: "wrong_host",
      level: "WARN",
      source: "admin_auth",
      metadata: { host: normalizeHost(host), reason: "wrong_host" },
    });
    redirect(ADMIN_PRODUCTION_LOGIN_URL);
  }

  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const nextPath = safeAdminNextPath(readString(formData, "next") || "/applications");
  const ipAddress = await getServerActionIpAddress();

  const ipLimit = enforceRateLimit("admin.login.ip", ipAddress, RATE_LIMITS.adminLoginIp);
  if (!ipLimit.ok) {
    redirectLoginError(nextPath, { email, reason: "rate_limited" });
  }

  if (email) {
    const emailLimit = enforceRateLimit("admin.login.email", email, RATE_LIMITS.adminLoginEmail);
    if (!emailLimit.ok) {
      redirectLoginError(nextPath, { email, reason: "rate_limited" });
    }
  }

  /**
   * PRODUCTION NOTE: Replace shared-password auth with per-admin credentials + MFA (PR2).
   * See `lib/wexon-admin-auth.ts`.
   */
  const expectedPassword = process.env.ADMIN_LOGIN_PASSWORD ?? "";
  const sessionSecret = process.env.ADMIN_SESSION_SECRET ?? "";
  const allowed = Boolean(email) && isAdminEmailAllowed(email);
  const passwordValid = Boolean(expectedPassword) && securePasswordEqual(password, expectedPassword);

  adminDebug("login:payload", { hasEmail: Boolean(email), next: nextPath });
  adminDebug("login:email_allowed", { allowed });
  adminDebug("login:password_valid", { valid: passwordValid });

  if (!email || !password) {
    redirectLoginError(nextPath, { email, reason: "invalid_credentials" });
  }

  if (!expectedPassword || !sessionSecret) {
    redirectLoginError(nextPath, { email, reason: "config_missing" });
  }

  if (!allowed || !passwordValid) {
    adminDebug("login:unauthorized", { allowed, passwordValid });
    redirectLoginError(nextPath, { email, reason: "invalid_credentials" });
  }

  await createAdminSessionCookie(email);
  adminDebug("login:redirect", { next: nextPath });
  redirect(resolvePostLoginDestination(nextPath, { isAdmin: true, productionWexon }));
}

export async function logoutAdminAction() {
  adminDebug("logout:start");
  await clearAdminSessionCookie();
  await clearCustomerSessionCookie();
  await clearActiveOrganizationCookie();
  adminDebug("logout:redirect", { to: unifiedLoginUrl() });
  redirect(unifiedLoginUrl());
}
