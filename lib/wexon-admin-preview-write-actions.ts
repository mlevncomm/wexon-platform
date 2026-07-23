"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerActionIpAddress } from "@/lib/wexon-audit";
import {
  ADMIN_PREVIEW_WRITE_TTL_MS,
  auditAdminPreviewWriteDenied,
  auditAdminPreviewWriteSuccess,
  buildAdminPreviewWriteCapability,
  clearAdminPreviewWriteCapabilityCookie,
  evaluateAdminPreviewDisableRequest,
  readAdminPreviewWriteCapabilityCookie,
  sanitizePreviewWriteReason,
  setAdminPreviewWriteCapabilityCookie,
  validatePreviewWriteEnableInput,
  verifyAdminPreviewActor,
} from "@/lib/wexon-admin-preview-write";
import {
  resolveSafeWexPayRedirectPath,
  wexpayAdminPreviewBasePath,
} from "@/lib/wexon-admin-preview-path";
import { buildRateLimitKey, checkRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { prisma } from "@/lib/prisma";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readRedirectTo(formData: FormData, organizationId: string) {
  const value = readString(formData, "redirectTo");
  return resolveSafeWexPayRedirectPath(value || null, organizationId, wexpayAdminPreviewBasePath(organizationId));
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
        reason: sanitizePreviewWriteReason(reason),
        reasonHash: capability.reasonHash,
        writeSessionId: capability.writeSessionId,
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

/**
 * Disable write mode.
 * - Never trusts form organizationId for audit tenant.
 * - Capability org is authoritative; form org mismatch → deny.
 * - Missing capability: clear cookie safely, no fake success audit.
 */
export async function disableAdminPreviewWriteAction(formData: FormData) {
  const formOrganizationId = readString(formData, "organizationId");
  const fallbackPath = formOrganizationId
    ? wexpayAdminPreviewBasePath(formOrganizationId)
    : "/admin/organizations";
  const redirectTo = formOrganizationId
    ? readRedirectTo(formData, formOrganizationId)
    : fallbackPath;

  try {
    const actor = await verifyAdminPreviewActor();
    if (!actor.ok) {
      await clearAdminPreviewWriteCapabilityCookie();
      redirectWithPreviewError(redirectTo, actor.message);
    }

    const capability = await readAdminPreviewWriteCapabilityCookie();
    const decision = evaluateAdminPreviewDisableRequest({
      formOrganizationId,
      capability,
      adminId: actor.session.adminId,
      cloudflareSubject: actor.identity.subject,
    });

    if (!decision.ok) {
      if (decision.clearCookie) {
        await clearAdminPreviewWriteCapabilityCookie();
      }
      if (decision.reason === "missing_capability") {
        // Safe cookie clear only — do NOT invent a success audit for another org.
        if (formOrganizationId) {
          revalidatePath(wexpayAdminPreviewBasePath(formOrganizationId));
        }
        redirect(redirectTo);
      }
      await auditAdminPreviewWriteDenied({
        adminId: actor.session.adminId,
        email: actor.session.email,
        organizationId: decision.auditOrganizationId,
        actionKey: "disable_write",
        denialReason: decision.reason,
        writeModeExpiry: capability?.expiresAt ?? null,
      });
      redirectWithPreviewError(
        formOrganizationId ? wexpayAdminPreviewBasePath(formOrganizationId) : redirectTo,
        "Yazma yetkisi bu organizasyon veya oturum için geçerli değil.",
      );
    }

    const organizationId = decision.organizationId;
    await clearAdminPreviewWriteCapabilityCookie();

    try {
      await auditAdminPreviewWriteSuccess({
        action: "admin.preview.write_disabled",
        adminId: actor.session.adminId,
        email: actor.session.email,
        organizationId,
        actionKey: "disable_write",
        reasonHash: decision.capability.reasonHash,
        writeSessionId: decision.capability.writeSessionId,
        writeModeExpiry: decision.capability.expiresAt,
      });
    } catch {
      // Cookie already cleared — fail open for disable UX, still revalidate.
    }
    revalidatePath(wexpayAdminPreviewBasePath(organizationId));
    redirect(resolveSafeWexPayRedirectPath(redirectTo, organizationId, wexpayAdminPreviewBasePath(organizationId)));
  } catch (error) {
    throwIfRedirectError(error);
    await clearAdminPreviewWriteCapabilityCookie();
  }

  redirect(redirectTo);
}
