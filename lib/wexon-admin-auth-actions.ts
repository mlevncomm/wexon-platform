"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerActionIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import {
  ADMIN_LOGIN_GENERIC_ERROR,
  ADMIN_PRODUCTION_LOGIN_URL,
  adminDebug,
  clearAdminSessionCookie,
  establishAdminSessionFromCloudflareAccess,
  isAdminAccessHostAllowed,
} from "@/lib/wexon-admin-auth";
import { clearAdminPreviewWriteCapabilityCookie } from "@/lib/wexon-admin-preview-write";
import { clearCustomerSessionCookie } from "@/lib/wexon-customer-auth";
import { defaultAdminPostLoginPath, safeAdminNextPath } from "@/lib/wexon-admin-login-next";
import {
  isWexonProductionDeployment,
  normalizeHost,
  resolvePostLoginDestination,
} from "@/lib/wexon-canonical-host";
import { clearActiveOrganizationCookie } from "@/lib/wexon-organization-context";
import { unifiedLoginUrl } from "@/lib/wexon/urls";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { cloudflareAccessAuditSafeMeta } from "@/lib/wexon-cloudflare-access-jwt";
import { CloudflareAccessJwtError } from "@/lib/wexon-cloudflare-access-jwt";
import { PlatformAdminCloudflareAccessError } from "@/lib/wexon-platform-admin-cloudflare-bind";
import { maskPlatformAdminEmail } from "@/lib/wexon-platform-admin";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function adminLoginPath() {
  return isWexonProductionDeployment() ? "/login" : "/admin/login";
}

function redirectLoginError(
  nextPath: string,
  details: { reason: "rate_limited" | "access_denied" | "config_missing" | "wrong_host" },
) {
  const userMessage =
    details.reason === "rate_limited"
      ? "Çok fazla giriş denemesi. Lütfen bir süre sonra tekrar deneyin."
      : ADMIN_LOGIN_GENERIC_ERROR;

  const safeNext = safeAdminNextPath(nextPath);
  adminDebug("login:error_redirect", { reason: details.reason, next: safeNext });
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
    metadata: cloudflareAccessAuditSafeMeta({ reason: details.reason }),
  });
  const params = new URLSearchParams({ adminError: userMessage });
  if (safeNext && safeNext !== defaultAdminPostLoginPath()) {
    params.set("next", safeNext);
  }
  redirect(`${adminLoginPath()}?${params.toString()}`);
}

/**
 * Post-Cloudflare-Access continue action.
 * Verifies JWT + binds/resolves PlatformAdmin + sets session v3.
 * Does NOT read ADMIN_LOGIN_PASSWORD or ADMIN_EMAILS.
 */
export async function continueAdminCloudflareLoginAction(formData: FormData) {
  adminDebug("login:start");
  const productionWexon = isWexonProductionDeployment();
  const headerStore = await headers();
  const host = headerStore.get("host") ?? headerStore.get("x-forwarded-host");

  // Host gate MUST run before identity work.
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

  const nextPath = safeAdminNextPath(readString(formData, "next"), productionWexon);
  const ipAddress = await getServerActionIpAddress();

  const ipLimit = enforceRateLimit("admin.login.ip", ipAddress, RATE_LIMITS.adminLoginIp);
  if (!ipLimit.ok) {
    redirectLoginError(nextPath, { reason: "rate_limited" });
  }

  if (!process.env.ADMIN_SESSION_SECRET?.trim()) {
    redirectLoginError(nextPath, { reason: "config_missing" });
  }

  try {
    const established = await establishAdminSessionFromCloudflareAccess();
    adminDebug("login:redirect", {
      next: nextPath,
      emailMasked: maskPlatformAdminEmail(established.sessionEmail),
    });
    redirect(resolvePostLoginDestination(nextPath, { isAdmin: true, productionWexon }));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    const reason =
      error instanceof CloudflareAccessJwtError && error.code === "missing_config"
        ? "config_missing"
        : "access_denied";

    adminDebug("login:unauthorized", {
      ...cloudflareAccessAuditSafeMeta({
        reason:
          error instanceof CloudflareAccessJwtError
            ? error.code
            : error instanceof PlatformAdminCloudflareAccessError
              ? error.code
              : "access_denied",
      }),
    });
    redirectLoginError(nextPath, { reason });
  }
}

/**
 * @deprecated PR2B — shared password login removed. Kept as a hard deny so stale
 * forms/clients cannot authenticate via ADMIN_LOGIN_PASSWORD / ADMIN_EMAILS.
 */
export async function loginAdminAction(formData: FormData) {
  void formData;
  adminDebug("login:shared_password_rejected");
  writeAuditFailure({
    action: "admin.auth.login_failed",
    message: "shared_password_removed",
    level: "WARN",
    source: "admin_auth",
    metadata: { reason: "shared_password_removed" },
  });
  redirect(
    `${adminLoginPath()}?${new URLSearchParams({ adminError: ADMIN_LOGIN_GENERIC_ERROR }).toString()}`,
  );
}

export async function logoutAdminAction() {
  adminDebug("logout:start");
  await clearAdminPreviewWriteCapabilityCookie();
  await clearAdminSessionCookie();
  await clearCustomerSessionCookie();
  await clearActiveOrganizationCookie();
  adminDebug("logout:redirect", { to: unifiedLoginUrl() });
  redirect(unifiedLoginUrl());
}
