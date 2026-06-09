"use server";

import { redirect } from "next/navigation";
import { clearCustomerSessionCookie, createCustomerSessionCookie } from "@/lib/wexon-customer-auth";
import { writeAuditFailure } from "@/lib/wexon-audit";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/wexon-passwords";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string) {
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/dashboard/login")) return "/dashboard";
  return value;
}

function redirectLoginError(message: string, nextPath: string, details?: { email?: string; userId?: string }): never {
  writeAuditFailure({
    action: "customer.auth.login_failed",
    message,
    level: "WARN",
    userId: details?.userId,
    source: "customer_auth",
    metadata: { email: details?.email, next: safeNextPath(nextPath) },
  });
  const params = new URLSearchParams({ customerError: message, next: safeNextPath(nextPath) });
  redirect(`/dashboard/login?${params.toString()}`);
}

export async function loginCustomerAction(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const nextPath = safeNextPath(readString(formData, "next") || "/dashboard");
  const expectedPassword = process.env.CUSTOMER_DEV_LOGIN_PASSWORD;

  if (!email || !password) {
    redirectLoginError("E-posta ve şifre zorunludur.", nextPath);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
      },
    },
  });

  if (!user) {
    redirectLoginError("E-posta veya şifre hatalı.", nextPath, { email });
  }

  if (!user.isActive) {
    redirectLoginError("E-posta veya şifre hatalı.", nextPath, { email, userId: user.id });
  }

  const passwordValid = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : process.env.NODE_ENV !== "production" && Boolean(expectedPassword) && password === expectedPassword;

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
    const params = new URLSearchParams({ next: nextPath });
    redirect(`/dashboard/change-password?${params.toString()}`);
  }
  redirect(nextPath);
}

export async function logoutCustomerAction() {
  await clearCustomerSessionCookie();
  redirect("/dashboard/login");
}
