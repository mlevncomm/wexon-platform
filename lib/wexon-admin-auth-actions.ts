"use server";

import { redirect } from "next/navigation";
import { getServerActionIpAddress } from "@/lib/wexon-audit";
import { adminDebug, clearAdminSessionCookie, createAdminSessionCookie, isAdminEmailAllowed } from "@/lib/wexon-admin-auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string) {
  if (!value.startsWith("/")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  return value;
}

function redirectLoginError(message: string, nextPath: string) {
  adminDebug("login:error_redirect", { message, next: safeNextPath(nextPath) });
  const params = new URLSearchParams({ adminError: message });
  if (nextPath) {
    params.set("next", safeNextPath(nextPath));
  }
  redirect(`/admin/login?${params.toString()}`);
}

export async function loginAdminAction(formData: FormData) {
  adminDebug("login:start");
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const nextPath = safeNextPath(readString(formData, "next") || "/admin");
  const ipAddress = await getServerActionIpAddress();

  const ipLimit = enforceRateLimit("admin.login.ip", ipAddress, RATE_LIMITS.adminLoginIp);
  if (!ipLimit.ok) {
    redirectLoginError("Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin.", nextPath);
  }

  if (email) {
    const emailLimit = enforceRateLimit("admin.login.email", email, RATE_LIMITS.adminLoginEmail);
    if (!emailLimit.ok) {
      redirectLoginError("Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin.", nextPath);
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
    redirect("/unauthorized");
  }

  if (!passwordValid) {
    redirectLoginError("E-posta veya şifre hatalı.", nextPath);
  }

  await createAdminSessionCookie(email);
  adminDebug("login:redirect", { next: nextPath });
  redirect(nextPath);
}

export async function logoutAdminAction() {
  adminDebug("logout:start");
  await clearAdminSessionCookie();
  adminDebug("logout:redirect", { to: "/admin/login" });
  redirect("/admin/login");
}
