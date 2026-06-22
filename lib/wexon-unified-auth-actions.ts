"use server";

import { redirect } from "next/navigation";
import { getServerActionIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { createAdminSessionCookie, isAdminEmailAllowed } from "@/lib/wexon-admin-auth";
import { createCustomerSessionCookie } from "@/lib/wexon-customer-auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/wexon-passwords";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectUnifiedError(
  message = "E-posta veya şifre hatalı.",
  details?: { email?: string; reason?: string },
): never {
  writeAuditFailure({
    action: details?.reason === "rate_limited" ? "auth.unified.rate_limited" : "auth.unified.login_failed",
    message,
    level: "WARN",
    source: "unified_auth",
    metadata: { email: details?.email },
  });
  const params = new URLSearchParams({ authError: message });
  redirect(`/login?${params.toString()}`);
}

export async function loginUnifiedAction(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const ipAddress = await getServerActionIpAddress();

  const ipLimit = enforceRateLimit("unified.login.ip", ipAddress, RATE_LIMITS.customerLoginIp);
  if (!ipLimit.ok) {
    redirectUnifiedError("Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin.", {
      email,
      reason: "rate_limited",
    });
  }

  if (email) {
    const emailLimit = enforceRateLimit("unified.login.email", email, RATE_LIMITS.customerLoginEmail);
    if (!emailLimit.ok) {
      redirectUnifiedError("Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin.", {
        email,
        reason: "rate_limited",
      });
    }
  }

  if (!email || !password) {
    redirectUnifiedError(undefined, { email });
  }

  const adminPassword = process.env.ADMIN_LOGIN_PASSWORD;
  if (isAdminEmailAllowed(email) && adminPassword && password === adminPassword) {
    await createAdminSessionCookie(email);
    redirect("/admin");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
      },
    },
  });

  if (!user || !user.isActive) {
    redirectUnifiedError(undefined, { email });
  }

  const devPassword = process.env.CUSTOMER_DEV_LOGIN_PASSWORD;
  const passwordValid = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : process.env.NODE_ENV !== "production" && Boolean(devPassword) && password === devPassword;

  if (!passwordValid || user.memberships.length === 0) {
    redirectUnifiedError(undefined, { email });
  }

  await createCustomerSessionCookie(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  if (user.mustChangePassword) {
    redirect("/dashboard/change-password?next=%2Fdashboard");
  }

  redirect("/dashboard");
}
