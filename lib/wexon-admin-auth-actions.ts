"use server";

import { redirect } from "next/navigation";
import { adminDebug, clearAdminSessionCookie, createAdminSessionCookie, isAdminEmailAllowed } from "@/lib/wexon-admin-auth";

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
