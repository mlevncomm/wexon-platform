"use server";

import { redirect } from "next/navigation";
import { getServerActionIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { clearCustomerSessionCookie, createCustomerSessionCookie } from "@/lib/wexon-customer-auth";
import { buildProductionSubdomainUrl, resolvePostLoginDestination, safeNextPath as canonicalSafeNextPath, isWexonProductionDeployment } from "@/lib/wexon-canonical-host";
import { clearActiveOrganizationCookie } from "@/lib/wexon-organization-context";
import { customerLoginUrl, unifiedLoginUrl } from "@/lib/wexon/urls";
import { isCustomerDevLoginAllowed } from "@/lib/wexon-production-guards";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { isDatabaseUnavailableError, resolveAuthDatabaseErrorMessage } from "@/lib/wexon-pre-application-errors";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/wexon-passwords";
import { clearAdminSessionCookie } from "@/lib/wexon-admin-auth";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeCustomerNextPath(value: string) {
  const path = canonicalSafeNextPath(value, "/dashboard");
  if (path.startsWith("/dashboard/login")) return "/dashboard";
  return path;
}

function redirectLoginError(message: string, nextPath: string, details?: { email?: string; userId?: string; reason?: string }): never {
  writeAuditFailure({
    action: details?.reason === "rate_limited" ? "customer.auth.rate_limited" : "customer.auth.login_failed",
    message,
    level: "WARN",
    userId: details?.userId,
    source: "customer_auth",
    metadata: { email: details?.email, next: safeCustomerNextPath(nextPath) },
  });
  redirect(customerLoginUrl({ next: safeCustomerNextPath(nextPath), customerError: message }));
}

export async function loginCustomerAction(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const nextPath = safeCustomerNextPath(readString(formData, "next") || "/dashboard");
  const productionWexon = isWexonProductionDeployment();
  const ipAddress = await getServerActionIpAddress();

  const ipLimit = enforceRateLimit("customer.login.ip", ipAddress, RATE_LIMITS.customerLoginIp);
  if (!ipLimit.ok) {
    redirectLoginError("Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin.", nextPath, {
      email,
      reason: "rate_limited",
    });
  }

  if (email) {
    const emailLimit = enforceRateLimit("customer.login.email", email, RATE_LIMITS.customerLoginEmail);
    if (!emailLimit.ok) {
      redirectLoginError("Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin.", nextPath, {
        email,
        reason: "rate_limited",
      });
    }
  }

  if (!email || !password) {
    redirectLoginError("E-posta ve şifre zorunludur.", nextPath);
  }

  let user;

  try {
    user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
        },
      },
    });
  } catch (error) {
    console.error("[customer-auth] user lookup failed", error);
    redirectLoginError(
      isDatabaseUnavailableError(error)
        ? resolveAuthDatabaseErrorMessage()
        : "Giriş şu anda tamamlanamıyor. Lütfen tekrar deneyin.",
      nextPath,
      { email },
    );
  }

  if (!user) {
    redirectLoginError("E-posta veya şifre hatalı.", nextPath, { email });
  }

  if (!user.isActive) {
    redirectLoginError("E-posta veya şifre hatalı.", nextPath, { email, userId: user.id });
  }

  const expectedPassword = process.env.CUSTOMER_DEV_LOGIN_PASSWORD?.trim() ?? "";
  const passwordValid = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : isCustomerDevLoginAllowed() && Boolean(expectedPassword) && password === expectedPassword;

  if (!passwordValid) {
    redirectLoginError("E-posta veya şifre hatalı.", nextPath, { email, userId: user.id });
  }

  if (user.memberships.length === 0) {
    redirectLoginError("Bu kullanıcı için aktif üyelik bulunamadı.", nextPath, { email, userId: user.id });
  }

  await createCustomerSessionCookie(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  if (user.mustChangePassword) {
    const changePasswordPath = productionWexon
      ? `${buildProductionSubdomainUrl("core", "/change-password")}?next=${encodeURIComponent(nextPath)}`
      : `/dashboard/change-password?next=${encodeURIComponent(nextPath)}`;
    redirect(changePasswordPath);
  }
  redirect(resolvePostLoginDestination(nextPath, { isAdmin: false, productionWexon }));
}

export async function logoutCustomerAction() {
  await clearCustomerSessionCookie();
  await clearAdminSessionCookie();
  await clearActiveOrganizationCookie();
  redirect(unifiedLoginUrl());
}
