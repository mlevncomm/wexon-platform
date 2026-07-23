"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdminAccess } from "@/lib/wexon-admin-auth";
import { AdminValidationError, readReturnTo } from "@/lib/wexon-admin-validation";
import { prisma } from "@/lib/prisma";
import {
  createPlatformAdminRecord,
  LastActivePlatformAdminError,
  PlatformAdminDuplicateEmailError,
  runPlatformAdminMutation,
  setPlatformAdminActiveRecord,
  updatePlatformAdminDisplayNameRecord,
} from "@/lib/wexon-platform-admin";

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AdminValidationError) return error.message;
  if (error instanceof LastActivePlatformAdminError) return error.message;
  if (error instanceof PlatformAdminDuplicateEmailError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function throwIfRedirectError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}

function redirectWithError(formData: FormData, fallback: string, error: unknown, message: string) {
  const returnTo = readReturnTo(formData, fallback);
  const params = new URLSearchParams({ adminError: getActionErrorMessage(error, message) });
  redirect(`${returnTo.split("?")[0]}?${params.toString()}`);
}

function revalidatePlatformAdminRoutes() {
  revalidatePath("/admin/platform-admins");
  revalidatePath("/admin");
}

export async function createPlatformAdminAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/platform-admins");
  try {
    const actor = await assertAdminAccess();
    const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
    const displayName =
      typeof formData.get("displayName") === "string" ? String(formData.get("displayName")) : "";

    await runPlatformAdminMutation(() =>
      prisma.$transaction(async (tx) => {
        await createPlatformAdminRecord(tx, { email, displayName }, actor);
      }),
    );

    revalidatePlatformAdminRoutes();
    redirect(returnTo.split("?")[0]);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Platform yöneticisi eklenemedi.");
  }
}

export async function updatePlatformAdminDisplayNameAction(adminId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/platform-admins");
  try {
    const actor = await assertAdminAccess();
    const displayName =
      typeof formData.get("displayName") === "string" ? String(formData.get("displayName")) : "";

    await runPlatformAdminMutation(() =>
      prisma.$transaction(async (tx) => {
        await updatePlatformAdminDisplayNameRecord(tx, { id: adminId, displayName }, actor);
      }),
    );

    revalidatePlatformAdminRoutes();
    redirect(returnTo.split("?")[0]);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Görünen ad güncellenemedi.");
  }
}

export async function setPlatformAdminActiveAction(adminId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/platform-admins");
  try {
    const actor = await assertAdminAccess();
    const raw = formData.get("isActive");
    const isActive = raw === "true" || raw === "1" || raw === "on";

    await runPlatformAdminMutation(() =>
      prisma.$transaction(async (tx) => {
        await setPlatformAdminActiveRecord(tx, { id: adminId, isActive }, actor);
      }),
    );

    revalidatePlatformAdminRoutes();
    redirect(returnTo.split("?")[0]);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Platform yöneticisi durumu güncellenemedi.");
  }
}
