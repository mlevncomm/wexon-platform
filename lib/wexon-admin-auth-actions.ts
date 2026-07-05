"use server";

import { redirect } from "next/navigation";
import { getServerActionIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { adminDebug, clearAdminSessionCookie, createAdminSessionCookie, isAdminEmailAllowed } from "@/lib/wexon-admin-auth";
import { isWexonProductionDeployment, resolvePostLoginDestination, safeNextPath as canonicalSafeNextPath } from "@/lib/wexon-canonical-host";
import { unifiedLoginUrl } from "@/lib/wexon/urls";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeAdminNextPath(value: string) {
  const path = canonicalSafeNextPath(value, "/applications");
  if (path === "/login" || path.startsWith("/login/")) {
    return isWexonProductionDeployment() ? "/applications" : "/admin";
  }
  if (path.startsWith("/admin/login")) {
    return isWexonProductionDeployment() ? "/applications" : "/admin";
  }
  if (path === "/" || path === "/admin") {
    return isWexonProductionDeployment() ? "/applications" : "/admin";
  }
  return path;
}

function adminLoginPath() {
  return isWexonProductionDeployment() ? "/login" : "/admin/login";
}

function redirectLoginError(message: string, nextPath: string, details?: { email?: string; reason?: string }) {
  adminDebug("login:error_redirect", { message, next: safeAdminNextPath(nextPath) });
  writeAuditFailure({
    action: details?.reason === "rate_limited" ? "admin.auth.rate_limited" : "admin.auth.login_failed",
    message,
    level: "WARN",
    source: "admin_auth",
    metadata: { email: details?.email, next: safeAdminNextPath(nextPath) },
  });
  const params = new URLSearchParams({ adminError: message });
  if (nextPath) {
    params.set("next", safeAdminNextPath(nextPath));
  }
  redirect(`${adminLoginPath()}?${params.toString()}`);
}

export async function loginAdminAction(formData: FormData) {
  adminDebug("login:start");
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const nextPath = safeAdminNextPath(readString(formData, "next") || "/applications");
  const productionWexon = isWexonProductionDeployment();
  const ipAddress = await getServerActionIpAddress();

  const ipLimit = enforceRateLimit("admin.login.ip", ipAddress, RATE_LIMITS.adminLoginIp);
  if (!ipLimit.ok) {
    redirectLoginError("Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin.", nextPath, {
      email,
      reason: "rate_limited",
    });
  }

  if (email) {
    const emailLimit = enforceRateLimit("admin.login.email", email, RATE_LIMITS.adminLoginEmail);
    if (!emailLimit.ok) {
      redirectLoginError("Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin.", nextPath, {
        email,
        reason: "rate_limited",
      });
    }
  }

  /**
   * PRODUCTION NOTE: Replace shared-password auth with per-admin credentials + MFA.
   * See `lib/wexon-admin-auth.ts`.
   */
  const expectedPassword = process.env.ADMIN_LOGIN_PASSWORD;
  const allowed = isAdminEmailAllowed(email);
  const passwordValid = Boolean(expectedPassword && password === expectedPassword);

  adminDebug("login:payload", { hasEmail: Boolean(email), email, next: nextPath });
  adminDebug("login:email_allowed", { allowed, email });
  adminDebug("login:password_valid", { valid: passwordValid });

  if (!email || !password) {
    redirectLoginError("E-posta ve şifre zorunludur.", nextPath);
  }

  if (!expectedPassword) {
    redirectLoginError("ADMIN_LOGIN_PASSWORD tanımlı değil.", nextPath);
  }

  if (!allowed) {
    adminDebug("login:unauthorized", { email });
    redirectLoginError("Bu e-posta admin yetki listesinde değil.", nextPath, { email });
  }

  if (!passwordValid) {
    redirectLoginError("E-posta veya şifre hatalı.", nextPath, { email });
  }

  await createAdminSessionCookie(email);
  adminDebug("login:redirect", { next: nextPath });
  redirect(resolvePostLoginDestination(nextPath, { isAdmin: true, productionWexon }));
}

export async function logoutAdminAction() {
  adminDebug("logout:start");
  await clearAdminSessionCookie();
  adminDebug("logout:redirect", { to: unifiedLoginUrl() });
  redirect(unifiedLoginUrl());
}
