"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerActionIpAddress } from "@/lib/wexon-audit";
import {
  ADMIN_PREVIEW_WRITE_TTL_MS,
  assertAdminPreviewWriteAllowed,
  auditAdminPreviewWriteDenied,
  auditAdminPreviewWriteSuccess,
  buildAdminPreviewWriteCapability,
  clearAdminPreviewWriteCapabilityCookie,
  setAdminPreviewWriteCapabilityCookie,
  validatePreviewWriteEnableInput,
  verifyAdminPreviewActor,
} from "@/lib/wexon-admin-preview-write";
import { wexpayAdminPreviewBasePath, isAllowedWexPayRedirectPath } from "@/lib/wexon-admin-preview-path";
import { buildRateLimitKey, checkRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { prisma } from "@/lib/prisma";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readRedirectTo(formData: FormData, organizationId: string) {
  const value = readString(formData, "redirectTo");
  if (value && isAllowedWexPayRedirectPath(value)) return value;
  return wexpayAdminPreviewBasePath(organizationId);
}

function throwIfRedirectError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}

function redirectWithPreviewError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}previewError=${encodeURIComponent(message)}`);
}

export async function enableAdminPreviewWriteAction(formData: FormData) {
  const organizationId = readString(formData, "organizationId");
  const slug = readString(formData, "organizationSlug");
  const reason = readString(formData, "reason");
  const redirectTo = organizationId
    ? readRedirectTo(formData, organizationId)
    : "/admin/organizations";

  try {
    if (!organizationId) {
      redirectWithPreviewError(redirectTo, "Organizasyon gerekli.");
    }

    const ipAddress = await getServerActionIpAddress();
    const rl = checkRateLimit(
      buildRateLimitKey("adminPreviewWriteEnable", ipAddress),
      RATE_LIMITS.adminPreviewWriteEnable,
    );
    if (!rl.ok) {
      await auditAdminPreviewWriteDenied({
        organizationId,
        actionKey: "enable_write",
        denialReason: "rate_limited",
        reason,
      });
      redirectWithPreviewError(redirectTo, "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin.");
    }

    const actor = await verifyAdminPreviewActor();
    if (!actor.ok) {
      await auditAdminPreviewWriteDenied({
        organizationId,
        actionKey: "enable_write",
        denialReason: actor.reason,
        reason,
      });
      redirectWithPreviewError(redirectTo, actor.message);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, slug: true, name: true, isDemo: true, isActive: true },
    });

    if (!organization || !organization.isActive) {
      await auditAdminPreviewWriteDenied({
        adminId: actor.session.adminId,
        email: actor.session.email,
        organizationId,
        actionKey: "enable_write",
        denialReason: organization ? "organization_inactive" : "organization_missing",
        reason,
      });
      redirectWithPreviewError(redirectTo, "Organizasyon aktif değil veya bulunamadı.");
    }

    if (organization.isDemo) {
      await auditAdminPreviewWriteDenied({
        adminId: actor.session.adminId,
        email: actor.session.email,
        organizationId,
        actionKey: "enable_write",
        denialReason: "organization_demo",
        reason,
      });
      redirectWithPreviewError(redirectTo, "Demo tenant için yazma modu açılamaz.");
    }

    const validation = validatePreviewWriteEnableInput({
      slug,
      reason,
      expectedSlug: organization.slug,
    });
    if (!validation.ok) {
      await auditAdminPreviewWriteDenied({
        adminId: actor.session.adminId,
        email: actor.session.email,
        organizationId,
        actionKey: "enable_write",
        denialReason: validation.reason,
        reason,
      });
      redirectWithPreviewError(redirectTo, validation.message);
    }

    const capability = buildAdminPreviewWriteCapability({
      adminId: actor.session.adminId,
      cloudflareSubject: actor.identity.subject,
      organizationId: organization.id,
      reason,
      ttlMs: ADMIN_PREVIEW_WRITE_TTL_MS,
    });

    try {
      await auditAdminPreviewWriteSuccess({
        action: "admin.preview.write_enabled",
        adminId: actor.session.adminId,
        email: actor.session.email,
        organizationId: organization.id,
        actionKey: "enable_write",
        reason,
        writeModeExpiry: capability.expiresAt,
      });
    } catch {
      await auditAdminPreviewWriteDenied({
        adminId: actor.session.adminId,
        email: actor.session.email,
        organizationId: organization.id,
        actionKey: "enable_write",
        denialReason: "audit_failed",
        reason,
      });
      redirectWithPreviewError(redirectTo, "Denetim kaydı yazılamadı; yazma modu açılmadı.");
    }

    await setAdminPreviewWriteCapabilityCookie(capability);
    revalidatePath(wexpayAdminPreviewBasePath(organization.id));
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithPreviewError(redirectTo, "Yazma modu açılamadı.");
  }

  redirect(redirectTo);
}

export async function disableAdminPreviewWriteAction(formData: FormData) {
  const organizationId = readString(formData, "organizationId");
  const redirectTo = organizationId
    ? readRedirectTo(formData, organizationId)
    : "/admin/organizations";

  try {
    const actor = await verifyAdminPreviewActor();
    if (!actor.ok) {
      await clearAdminPreviewWriteCapabilityCookie();
      redirectWithPreviewError(redirectTo, actor.message);
    }

    await clearAdminPreviewWriteCapabilityCookie();

    if (organizationId) {
      try {
        await auditAdminPreviewWriteSuccess({
          action: "admin.preview.write_disabled",
          adminId: actor.session.adminId,
          email: actor.session.email,
          organizationId,
          actionKey: "disable_write",
        });
      } catch {
        // Cookie already cleared — fail open for disable UX, still revalidate.
      }
      revalidatePath(wexpayAdminPreviewBasePath(organizationId));
    }
  } catch (error) {
    throwIfRedirectError(error);
    await clearAdminPreviewWriteCapabilityCookie();
  }

  redirect(redirectTo);
}

/**
 * Used by mutation entrypoints after a successful admin preview write to emit
 * `admin.preview.write`. Failures here should be handled by the caller (rollback).
 */
export async function recordAdminPreviewMutationAudit(input: {
  organizationId: string;
  actionKey: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  const allowed = await assertAdminPreviewWriteAllowed({
    organizationId: input.organizationId,
    actionKey: input.actionKey,
    auditDenial: false,
  });
  if (!allowed.ok) {
    throw new Error(allowed.message);
  }

  await auditAdminPreviewWriteSuccess({
    action: "admin.preview.write",
    adminId: allowed.session.adminId,
    email: allowed.session.email,
    organizationId: input.organizationId,
    actionKey: input.actionKey,
    writeModeExpiry: allowed.capability.expiresAt,
    before: input.before,
    after: input.after,
  });
}
