"use server";

import { redirect } from "next/navigation";
import { createAdminSessionCookie, isAdminEmailAllowed } from "@/lib/wexon-admin-auth";
import { createCustomerSessionCookie } from "@/lib/wexon-customer-auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/wexon-passwords";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectUnifiedError(): never {
  const params = new URLSearchParams({ authError: "E-posta veya şifre hatalı." });
  redirect(`/login?${params.toString()}`);
}

export async function loginUnifiedAction(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");

  if (!email || !password) {
    redirectUnifiedError();
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
    redirectUnifiedError();
  }

  const devPassword = process.env.CUSTOMER_DEV_LOGIN_PASSWORD;
  const passwordValid = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : process.env.NODE_ENV !== "production" && Boolean(devPassword) && password === devPassword;

  if (!passwordValid || user.memberships.length === 0) {
    redirectUnifiedError();
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
