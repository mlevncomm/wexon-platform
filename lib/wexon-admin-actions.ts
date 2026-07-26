"use server";

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDebug, assertAdminAccess, type AdminSession } from "@/lib/wexon-admin-auth";
import {
  assertEntitlementPhysicalDeleteForbidden,
} from "@/lib/wexon-entitlement-lifecycle";
import { writeAuditLog } from "@/lib/wexon-audit";
import { hashApiKey } from "@/lib/wexon-api-key-hash";
import { resolveDemoLeadStatus } from "@/lib/wexon-demo-request-leads";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/wexon-passwords";
import { assertStaffEntitlementLimit, evaluateProductAccess } from "@/lib/wexon-core-access";
import { syncSubscriptionAccessState } from "@/lib/wexon-subscription-lifecycle";
import {
  adminAssistedWexPayGoLive,
  blockWexPayActivationAsAdmin,
  unblockWexPayActivationAsAdmin,
} from "@/lib/wexpay-activation-admin";
import {
  assertMembershipChangePreservesActiveOwners,
  assertUserDeactivationPreservesActiveOwners,
  LastActiveOwnerError,
  lockUserForUpdate,
  resolveNextActiveFromLockedUser,
} from "@/lib/wexon-active-owner";
import {
  AdminValidationError,
  parseActivationFeeWaivePayload,
  parseApiKeyCreatePayload,
  parseAppInstallationSettingsPayload,
  parseAppInstallationStatus,
  parseBillingPaymentCreatePayload,
  parseEntitlementPayload,
  parseInvoiceCreatePayload,
  parseInvoiceStatusPayload,
  parseLicenseDetailsPayload,
  parseLicensePayload,
  parseLicensePlanPayload,
  parseLicenseStatusPayload,
  parseMembershipPayload,
  parseMembershipRolePayload,
  parseMembershipStatusPayload,
  parseOrganizationPayload,
  parsePlanActivePayload,
  parsePlanCreatePayload,
  parsePlanUpdatePayload,
  parseProductCreatePayload,
  parseProductStatusPayload,
  parseProductUpdatePayload,
  parseRestaurantPayload,
  parseSubscriptionCreatePayload,
  parseSubscriptionStatusPayload,
  parseSupportTicketUpdatePayload,
  parseDemoRequestLeadStatusPayload,
  parseDemoRequestFollowUpPayload,
  parseUserPasswordResetPayload,
  parseWebhookActivePayload,
  parseWebhookCreatePayload,
  readReturnTo,
} from "@/lib/wexon-admin-validation";
import {
  changeLicensePlanWithSubscriptionSync,
  waiveActivationFeeAsAdmin,
} from "@/lib/wexon-admin-commercial-consistency";
import { PlatformAdminCloudflareAccessError } from "@/lib/wexon-platform-admin-cloudflare-bind";
import {
  enforceAdminMutationGate,
  getSafeAdminActionErrorMessage,
  logAdminMutationInternalError,
  readHighRiskConfirmation,
  readMutationId,
  runAdminMutation,
} from "@/lib/wexon-admin-mutation-guard";
import { AdminMutationGuardError } from "@/lib/wexon-admin-mutation-errors";
import { isHostedDeploymentCleanupForbidden, isAllowedAdminBillingPaymentProvider } from "@/lib/wexon-admin-mutation-policy";
import {
  assertInvoiceCreateStatus,
  assertMoneyInvariant,
  assertPositiveAmount,
  evaluateLicenseStatusAgainstSubscription,
  evaluateSubscriptionStatusTransition,
} from "@/lib/wexon-admin-finance-policy";
import {
  executeCreateBillingPayment,
  executeCreateLicense,
  executeCreateSubscription,
  executeUpdateBillingPaymentStatus,
  executeUpdateInvoiceStatus,
} from "@/lib/wexon-admin-finance-operations";
import { maskMerchantOid } from "@/lib/wexon-admin-commercial-consistency";
import { maskEmailForAudit, sanitizeAdminAuditMetadata } from "@/lib/wexon-admin-audit-sanitize";

type AuditClient = {
  auditLog: {
    create: (args: Parameters<typeof prisma.auditLog.create>[0]) => ReturnType<typeof prisma.auditLog.create>;
  };
};

type AdminAuditInput = {
  action: string;
  actor: AdminSession;
  organizationId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

type DeleteClient = Pick<
  typeof prisma,
  | "restaurant"
  | "branch"
  | "restaurantTable"
  | "menuCategory"
  | "menuProduct"
  | "customerOrder"
  | "orderItem"
  | "payment"
  | "receiptRequest"
  | "businessNotification"
  | "apiKey"
  | "webhookEndpoint"
  | "appInstallation"
  | "subscription"
  | "license"
  | "membership"
  | "organization"
>;

function getAdminActionActor(actor: AdminSession) {
  return {
    type: "admin_session",
    emailMasked: maskEmailForAudit(actor.email),
  };
}

/** Thin adapter over shared writeAuditLog — masks PII before write. */
async function writeAdminAuditLog(input: AdminAuditInput, client: AuditClient = prisma) {
  return writeAuditLog(
    {
      action: input.action,
      organizationId: input.organizationId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      source: "admin_mutation",
      metadata: sanitizeAdminAuditMetadata({
        actor: getAdminActionActor(input.actor),
        actorAdminId: input.actor.adminId,
        actorEmailMasked: maskEmailForAudit(input.actor.email),
        ...(input.metadata ?? {}),
      }),
    },
    client as unknown as Parameters<typeof writeAuditLog>[1],
  );
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function getActionErrorMessage(error: unknown, fallback: string) {
  return getSafeAdminActionErrorMessage(error, fallback);
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

function redirectWithError(formData: FormData, fallback: string, error: unknown, message = "İşlem tamamlanamadı.") {
  if (
    !(error instanceof AdminValidationError) &&
    !(error instanceof AdminMutationGuardError) &&
    !(error instanceof PlatformAdminCloudflareAccessError)
  ) {
    logAdminMutationInternalError({
      requestId: "action",
      action: "unknown",
      adminId: "unknown",
      error,
    });
  }
  const returnTo = readReturnTo(formData, fallback);
  const params = new URLSearchParams({ adminError: getActionErrorMessage(error, message) });
  redirect(`${returnTo}?${params.toString()}`);
}

function redirectPathWithError(path: string, error: unknown, message = "İşlem tamamlanamadı.") {
  if (
    !(error instanceof AdminValidationError) &&
    !(error instanceof AdminMutationGuardError) &&
    !(error instanceof PlatformAdminCloudflareAccessError)
  ) {
    logAdminMutationInternalError({
      requestId: "action",
      action: "unknown",
      adminId: "unknown",
      error,
    });
  }
  const params = new URLSearchParams({ adminError: getActionErrorMessage(error, message) });
  redirect(`${path}?${params.toString()}`);
}

function revalidateOrganizationRoutes(organizationId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/customers");
  if (organizationId) {
    revalidatePath(`/admin/organizations/${organizationId}`);
  }
}

function revalidateLicenseRoutes(organizationId: string) {
  revalidateOrganizationRoutes(organizationId);
  revalidatePath("/admin/licenses");
  revalidatePath("/admin/products");
  revalidatePath("/admin/plans");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/subscription");
}

function revalidateBillingRoutes() {
  revalidatePath("/admin/billing");
  revalidatePath("/admin");
}

function revalidateCatalogRoutes() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/plans");
  revalidatePath("/admin/licenses");
  revalidatePath("/admin/subscriptions");
}

function revalidateIntegrationRoutes() {
  revalidatePath("/admin/integrations");
  revalidatePath("/admin");
}

function revalidateUserRoutes(organizationId?: string) {
  revalidatePath("/admin/users");
  revalidateOrganizationRoutes(organizationId);
  revalidatePath("/dashboard/users");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function setAdminApiKeyFlashCookie(value: { name: string; prefix: string; rawKey: string }) {
  const cookieStore = await cookies();
  cookieStore.set("wexon_admin_api_key_flash", Buffer.from(JSON.stringify(value), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/integrations",
    maxAge: 5 * 60,
  });
}

async function deleteOrganizationGraph(tx: DeleteClient, organizationId: string) {
  const restaurants = await tx.restaurant.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const restaurantIds = restaurants.map((restaurant) => restaurant.id);
  const branches = restaurantIds.length
    ? await tx.branch.findMany({ where: { restaurantId: { in: restaurantIds } }, select: { id: true } })
    : [];
  const branchIds = branches.map((branch) => branch.id);

  if (branchIds.length) {
    await tx.businessNotification.deleteMany({ where: { branchId: { in: branchIds } } });
    await tx.receiptRequest.deleteMany({ where: { table: { branchId: { in: branchIds } } } });
    await tx.payment.deleteMany({ where: { branchId: { in: branchIds } } });
    await tx.orderItem.deleteMany({ where: { order: { branchId: { in: branchIds } } } });
    await tx.customerOrder.deleteMany({ where: { branchId: { in: branchIds } } });
    await tx.menuProduct.deleteMany({ where: { branchId: { in: branchIds } } });
    await tx.menuCategory.deleteMany({ where: { branchId: { in: branchIds } } });
    await tx.restaurantTable.deleteMany({ where: { branchId: { in: branchIds } } });
    await tx.branch.deleteMany({ where: { id: { in: branchIds } } });
  }

  if (restaurantIds.length) {
    await tx.restaurant.deleteMany({ where: { id: { in: restaurantIds } } });
  }

  await tx.apiKey.deleteMany({ where: { organizationId } });
  await tx.webhookEndpoint.deleteMany({ where: { organizationId } });
  await tx.appInstallation.deleteMany({ where: { organizationId } });
  await tx.subscription.deleteMany({ where: { organizationId } });
  await tx.license.deleteMany({ where: { organizationId } });
  await tx.membership.deleteMany({ where: { organizationId } });
  await tx.organization.delete({ where: { id: organizationId } });
}

async function getWexPayProduct() {
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ key: "wexpay" }, { key: "WexPay" }, { name: { equals: "WexPay", mode: "insensitive" } }],
    },
  });

  if (!product) {
    throw new AdminValidationError("WexPay ürünü bulunamadı.");
  }

  return product;
}

async function getWexPayLicense(organizationId: string, productId: string) {
  return prisma.license.findFirst({
    where: { organizationId, productId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

async function assertWexPayPlan(planId: string, productId: string) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, productId, isActive: true },
  });

  if (!plan) {
    throw new AdminValidationError("Seçilen paket WexPay ürününe ait değil veya aktif değil.");
  }

  return plan;
}

async function assertOrganization(organizationId: string) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    throw new AdminValidationError("Organizasyon bulunamadı.");
  }
  return organization;
}

async function assertOrganizationLicense(organizationId: string, licenseId: string) {
  const license = await prisma.license.findFirst({
    where: { id: licenseId, organizationId },
    include: { product: true, plan: true },
  });

  if (!license) {
    throw new AdminValidationError("Lisans bulunamadı veya bu organizasyona ait değil.");
  }

  return license;
}

export async function createAdminOrganizationAction(formData: FormData) {
  try {
    adminDebug("org:create:start");
    const actor = await assertAdminAccess();
    const payload = parseOrganizationPayload(formData);
    adminDebug("org:create:validated", { name: payload.name, slug: payload.slug, country: payload.country, isActive: payload.isActive });

    const result = await runAdminMutation({
      action: "organization.create",
      actor,
      entityType: "Organization",
      requestHashPayload: {
        name: payload.name,
        slug: payload.slug,
        country: payload.country,
        isActive: payload.isActive,
        isDemo: payload.isDemo,
      },
      execute: async ({ tx }) => {
        adminDebug("org:create:db_create_start");
        const created = await tx.organization.create({ data: payload });
        adminDebug("org:create:created", { organizationId: created.id });
        return {
          organizationId: created.id,
          entityId: created.id,
          after: { name: created.name, slug: created.slug, isActive: created.isActive },
          replayResult: { organizationId: created.id },
        };
      },
    });

    revalidateOrganizationRoutes(result.organizationId!);
    const returnTo = readReturnTo(formData, `/admin/organizations/${result.entityId}`);
    adminDebug("org:create:redirect", { to: returnTo });
    redirect(returnTo);
  } catch (error) {
    adminDebug("org:create:error", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    throwIfRedirectError(error);
    if (isUniqueConflict(error)) {
      redirectWithError(formData, "/admin/organizations", new Error("Bu slug zaten kullanılıyor."));
    }
    redirectWithError(formData, "/admin/organizations", error, "Organizasyon oluşturulamadı.");
  }
}

export async function updateAdminOrganizationAction(organizationId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const payload = parseOrganizationPayload(formData);

    await runAdminMutation({
      action: "organization.update",
      actor,
      organizationId,
      entityType: "Organization",
      entityId: organizationId,
      requestHashPayload: payload,
      execute: async ({ tx }) => {
        const before = await tx.organization.findUnique({ where: { id: organizationId } });
        if (!before) {
          throw new AdminValidationError("Organizasyon bulunamadı.");
        }

        const updated = await tx.organization.update({
          where: { id: organizationId },
          data: payload,
        });

        return {
          organizationId,
          entityId: organizationId,
          before: {
            name: before.name,
            slug: before.slug,
            legalName: before.legalName,
            taxNo: before.taxNo,
            email: maskEmailForAudit(before.email),
            phone: before.phone,
            country: before.country,
            isDemo: before.isDemo,
            isActive: before.isActive,
          },
          after: {
            name: updated.name,
            slug: updated.slug,
            legalName: updated.legalName,
            taxNo: updated.taxNo,
            email: maskEmailForAudit(updated.email),
            phone: updated.phone,
            country: updated.country,
            isDemo: updated.isDemo,
            isActive: updated.isActive,
          },
        };
      },
    });

    revalidateOrganizationRoutes(organizationId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/organization");
    redirect(readReturnTo(formData, `/admin/organizations/${organizationId}`));
  } catch (error) {
    throwIfRedirectError(error);
    if (isUniqueConflict(error)) {
      redirectWithError(formData, `/admin/organizations/${organizationId}`, new Error("Bu slug zaten kullanılıyor."));
    }
    redirectWithError(formData, `/admin/organizations/${organizationId}`, error, "Organizasyon güncellenemedi.");
  }
}

export async function deactivateAdminOrganizationAction(organizationId: string, formData?: FormData) {
  const returnTo = formData ? readReturnTo(formData, `/admin/organizations/${organizationId}`) : `/admin/organizations/${organizationId}`;
  try {
    const actor = await assertAdminAccess();
    const organization = await assertOrganization(organizationId);

    if (!organization.isActive) {
      adminDebug("org:deactivate:no_op", { organizationId });
      revalidateOrganizationRoutes(organizationId);
      redirect(returnTo);
    }

    const confirm = readHighRiskConfirmation(formData ?? new FormData());

    await runAdminMutation({
      action: "organization.deactivate",
      actor,
      organizationId,
      entityType: "Organization",
      entityId: organizationId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: { organizationId },
      execute: async ({ tx }) => {
        const updated = await tx.organization.update({
          where: { id: organizationId },
          data: { isActive: false },
        });

        const wexPayProduct = await tx.product.findFirst({
          where: {
            OR: [{ key: "wexpay" }, { name: { equals: "WexPay", mode: "insensitive" } }],
          },
        });

        if (wexPayProduct) {
          await tx.appInstallation.updateMany({
            where: { organizationId, productId: wexPayProduct.id, status: "ACTIVE" },
            data: { status: "DISABLED" },
          });
        }

        return {
          organizationId,
          entityId: organizationId,
          before: { isActive: organization.isActive },
          after: { isActive: updated.isActive },
          metadata: { productAccessDisabled: Boolean(wexPayProduct), hardDelete: false },
        };
      },
    });

    revalidateOrganizationRoutes(organizationId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/organization");
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectPathWithError(returnTo, error, "Müşteri pasife alınamadı.");
  }
}

export async function reactivateAdminOrganizationAction(organizationId: string, formData?: FormData) {
  const returnTo = formData ? readReturnTo(formData, `/admin/organizations/${organizationId}`) : `/admin/organizations/${organizationId}`;
  try {
    const actor = await assertAdminAccess();
    const organization = await assertOrganization(organizationId);

    if (organization.isActive) {
      adminDebug("org:reactivate:no_op", { organizationId });
      revalidateOrganizationRoutes(organizationId);
      redirect(returnTo);
    }

    const confirm = readHighRiskConfirmation(formData ?? new FormData());

    await runAdminMutation({
      action: "organization.reactivate",
      actor,
      organizationId,
      entityType: "Organization",
      entityId: organizationId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: { organizationId },
      execute: async ({ tx }) => {
        const updated = await tx.organization.update({
          where: { id: organizationId },
          data: { isActive: true },
        });

        const wexPayProduct = await tx.product.findFirst({
          where: {
            OR: [{ key: "wexpay" }, { name: { equals: "WexPay", mode: "insensitive" } }],
          },
        });

        if (wexPayProduct) {
          await tx.appInstallation.updateMany({
            where: { organizationId, productId: wexPayProduct.id, status: "DISABLED" },
            data: { status: "ACTIVE" },
          });
        }

        return {
          organizationId,
          entityId: organizationId,
          before: { isActive: organization.isActive },
          after: { isActive: updated.isActive },
          metadata: { productAccessReactivated: Boolean(wexPayProduct) },
        };
      },
    });

    revalidateOrganizationRoutes(organizationId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/organization");
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectPathWithError(returnTo, error, "Müşteri tekrar aktif edilemedi.");
  }
}

export async function permanentlyDeleteAdminOrganizationAction(organizationId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const confirmSlug = String(formData.get("confirmSlug") ?? "").trim();
    const confirm = readHighRiskConfirmation(formData);
    const mutationId = readMutationId(formData);

    await runAdminMutation({
      action: "organization.permanent_delete",
      actor,
      organizationId,
      entityType: "Organization",
      entityId: organizationId,
      mutationId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: { organizationId, confirmSlug },
      execute: async ({ tx }) => {
        const organization = await tx.organization.findUnique({
          where: { id: organizationId },
          include: {
            _count: {
              select: {
                invoices: true,
                billingPayments: true,
              },
            },
          },
        });

        if (!organization) {
          throw new AdminValidationError("Müşteri bulunamadı.");
        }

        if (confirmSlug !== organization.slug) {
          throw new AdminValidationError("Onay slug değeri eşleşmiyor.");
        }

        if (organization._count.invoices > 0 || organization._count.billingPayments > 0) {
          throw new AdminValidationError(
            "Bu müşteriye ait fatura veya ödeme kaydı olduğu için kalıcı silme yapılamaz. Müşteriyi pasife alabilirsiniz.",
          );
        }

        await deleteOrganizationGraph(tx, organizationId);

        return {
          organizationId,
          entityId: organizationId,
          before: { slug: organization.slug, name: organization.name },
          after: { deleted: true },
          metadata: {
            organizationName: organization.name,
            organizationSlug: organization.slug,
            hardDelete: true,
          },
          replayResult: { organizationId, deleted: true },
        };
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/organizations");
    revalidatePath("/admin/customers");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/organization");
    redirect("/admin/organizations");
  } catch (error) {
    throwIfRedirectError(error);
    redirectPathWithError(`/admin/organizations/${organizationId}`, error, "Müşteri kalıcı olarak silinemedi.");
  }
}

export async function deleteAllTestOrganizationsAction(formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const confirmText = String(formData.get("confirmText") ?? "").trim();
    const confirm = readHighRiskConfirmation(formData);

    await enforceAdminMutationGate({
      action: "test_organization.bulk_delete",
      actor,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
    });

    if (isHostedDeploymentCleanupForbidden(process.env)) {
      throw new AdminMutationGuardError(
        "cleanup_forbidden",
        "Bu işlem production/preview ortamında devre dışıdır.",
      );
    }

    if (confirmText !== "TÜM TEST MÜŞTERİLERİNİ SİL") {
      throw new AdminValidationError("Onay metni eşleşmiyor.");
    }

    const demoOrganizations = await prisma.organization.findMany({
      where: { isDemo: true },
      include: { _count: { select: { invoices: true, billingPayments: true } } },
      orderBy: { createdAt: "asc" },
    });
    const organizations =
      demoOrganizations.length > 0
        ? demoOrganizations
        : await prisma.organization.findMany({
            include: { _count: { select: { invoices: true, billingPayments: true } } },
            orderBy: { createdAt: "asc" },
          });

    let deleted = 0;
    let skipped = 0;

    for (const organization of organizations) {
      if (organization._count.invoices > 0 || organization._count.billingPayments > 0) {
        skipped += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await writeAdminAuditLog(
          {
            action: "admin.organization.bulk_test_deleted",
            actor,
            organizationId: organization.id,
            entityType: "Organization",
            entityId: organization.id,
            metadata: {
              organizationName: organization.name,
              organizationSlug: organization.slug,
              source: "developer_cleanup",
            },
          },
          tx,
        );
        await deleteOrganizationGraph(tx, organization.id);
      });
      deleted += 1;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/organizations");
    redirect(`/admin/organizations?adminInfo=${encodeURIComponent(`${deleted} müşteri silindi, ${skipped} müşteri atlandı.`)}`);
  } catch (error) {
    throwIfRedirectError(error);
    redirectPathWithError("/admin/settings", error, "Toplu test müşteri temizliği tamamlanamadı.");
  }
}

export async function enableWexPayAccessAction(organizationId: string) {
  try {
    const actor = await assertAdminAccess();
    await assertOrganization(organizationId);
    const product = await getWexPayProduct();
    const license = await getWexPayLicense(organizationId, product.id);

    await runAdminMutation({
      action: "wexpay_access.enable",
      actor,
      organizationId,
      entityType: "AppInstallation",
      requestHashPayload: { organizationId, productId: product.id },
      execute: async ({ tx }) => {
        const installation = await tx.appInstallation.upsert({
          where: { organizationId_productId: { organizationId, productId: product.id } },
          update: { status: "ACTIVE", licenseId: license?.id ?? null },
          create: {
            organizationId,
            productId: product.id,
            licenseId: license?.id ?? null,
            status: "ACTIVE",
          },
        });

        return {
          organizationId,
          entityId: installation.id,
          after: { productKey: product.key, status: installation.status, licenseId: license?.id ?? null },
        };
      },
    });

    revalidateLicenseRoutes(organizationId);
    redirect(`/admin/organizations/${organizationId}`);
  } catch (error) {
    throwIfRedirectError(error);
    redirectPathWithError(`/admin/organizations/${organizationId}`, error, "WexPay erişimi açılamadı.");
  }
}

export async function updateWexPayAccessStatusAction(organizationId: string, status: string) {
  try {
    const actor = await assertAdminAccess();
    const nextStatus = parseAppInstallationStatus(status);
    await assertOrganization(organizationId);
    const product = await getWexPayProduct();
    const license = await getWexPayLicense(organizationId, product.id);

    await runAdminMutation({
      action: "wexpay_access.status_change",
      actor,
      organizationId,
      entityType: "AppInstallation",
      requestHashPayload: { organizationId, productId: product.id, status: nextStatus },
      execute: async ({ tx }) => {
        const before = await tx.appInstallation.findUnique({
          where: { organizationId_productId: { organizationId, productId: product.id } },
        });

        const installation = await tx.appInstallation.upsert({
          where: { organizationId_productId: { organizationId, productId: product.id } },
          update: { status: nextStatus, licenseId: license?.id ?? before?.licenseId ?? null },
          create: {
            organizationId,
            productId: product.id,
            licenseId: license?.id ?? null,
            status: nextStatus,
          },
        });

        return {
          organizationId,
          entityId: installation.id,
          before: { status: before?.status ?? null },
          after: { status: installation.status },
          transition: `${before?.status ?? "none"}->${installation.status}`,
          metadata: { productKey: product.key },
        };
      },
    });

    revalidateLicenseRoutes(organizationId);
    redirect(`/admin/organizations/${organizationId}`);
  } catch (error) {
    throwIfRedirectError(error);
    redirectPathWithError(`/admin/organizations/${organizationId}`, error, "WexPay erişim durumu değiştirilemedi.");
  }
}

export async function createAdminLicenseAction(organizationId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const payload = parseLicensePayload(formData);
    const confirm = readHighRiskConfirmation(formData);
    const mutationId = readMutationId(formData);
    await assertOrganization(organizationId);
    const product = await getWexPayProduct();
    await assertWexPayPlan(payload.planId, product.id);

    await runAdminMutation({
      action: "license.create",
      actor,
      organizationId,
      entityType: "License",
      mutationId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: {
        organizationId,
        planId: payload.planId,
        licenseType: payload.licenseType,
        startsAt: payload.startsAt?.toISOString() ?? null,
        endsAt: payload.endsAt?.toISOString() ?? null,
        status: payload.status,
      },
      execute: async ({ tx }) =>
        executeCreateLicense(tx, {
          organizationId,
          productId: product.id,
          productKey: payload.productKey,
          planId: payload.planId,
          licenseType: payload.licenseType,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          status: payload.status,
        }),
    });

    revalidateLicenseRoutes(organizationId);
    redirect(readReturnTo(formData, `/admin/organizations/${organizationId}`));
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, `/admin/organizations/${organizationId}`, error, "Lisans oluşturulamadı.");
  }
}

export async function createAdminLicenseFromListAction(formData: FormData) {
  const organizationId = readStringFromForm(formData, "organizationId");
  if (!organizationId) {
    redirectWithError(formData, "/admin/licenses", new AdminValidationError("Müşteri seçimi zorunludur."));
  }
  await createAdminLicenseAction(organizationId, formData);
}

function readStringFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readActivationExpectedVersion(formData: FormData) {
  const raw = readStringFromForm(formData, "expectedVersion");
  const value = Number(raw);
  if (!raw || !Number.isSafeInteger(value) || value < 1) {
    throw new AdminValidationError("Aktivasyon sürümü geçersiz. Sayfayı yenileyin.");
  }
  return value;
}

export async function blockAdminWexPayActivationAction(
  organizationId: string,
  formData: FormData,
) {
  const returnTo = readReturnTo(formData, `/admin/organizations/${organizationId}`);
  try {
    const actor = await assertAdminAccess();
    await enforceAdminMutationGate({
      action: "wexpay_activation.block",
      actor,
      organizationId,
      entityType: "ActivationJourney",
      reason: readStringFromForm(formData, "note"),
    });
    await blockWexPayActivationAsAdmin({
      organizationId,
      expectedVersion: readActivationExpectedVersion(formData),
      actor: { email: actor.email },
      reason: readStringFromForm(formData, "reason"),
      note: readStringFromForm(formData, "note"),
    });
    revalidateOrganizationRoutes(organizationId);
    revalidatePath("/dashboard/wexpay/activation");
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Aktivasyon engellenemedi.");
  }
}

export async function unblockAdminWexPayActivationAction(
  organizationId: string,
  formData: FormData,
) {
  const returnTo = readReturnTo(formData, `/admin/organizations/${organizationId}`);
  try {
    const actor = await assertAdminAccess();
    await enforceAdminMutationGate({
      action: "wexpay_activation.unblock",
      actor,
      organizationId,
      entityType: "ActivationJourney",
      reason: readStringFromForm(formData, "reason"),
    });
    await unblockWexPayActivationAsAdmin({
      organizationId,
      expectedVersion: readActivationExpectedVersion(formData),
      actor: { email: actor.email },
      reason: readStringFromForm(formData, "reason"),
    });
    revalidateOrganizationRoutes(organizationId);
    revalidatePath("/dashboard/wexpay/activation");
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Aktivasyon engeli kaldırılamadı.");
  }
}

export async function adminAssistedWexPayGoLiveAction(
  organizationId: string,
  formData: FormData,
) {
  const returnTo = readReturnTo(formData, `/admin/organizations/${organizationId}`);
  try {
    const actor = await assertAdminAccess();
    await enforceAdminMutationGate({
      action: "wexpay_activation.assisted_go_live",
      actor,
      organizationId,
      entityType: "ActivationJourney",
      reason: readStringFromForm(formData, "note"),
    });
    await adminAssistedWexPayGoLive({
      organizationId,
      expectedVersion: readActivationExpectedVersion(formData),
      actor: { email: actor.email },
      reason: readStringFromForm(formData, "reason"),
      note: readStringFromForm(formData, "note"),
      confirmed: readStringFromForm(formData, "confirmed") === "1",
      confirmationText: readStringFromForm(formData, "confirmationText"),
    });
    revalidateOrganizationRoutes(organizationId);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/wexpay/activation");
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Admin destekli yayına alma tamamlanamadı.");
  }
}

export async function changeAdminLicensePlanAction(organizationId: string, licenseId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const payload = parseLicensePlanPayload(formData);
    const license = await assertOrganizationLicense(organizationId, licenseId);
    const product = await getWexPayProduct();
    if (license.productId !== product.id) {
      throw new AdminValidationError("Bu fazda yalnızca WexPay lisans paketi değiştirilebilir.");
    }
    await assertWexPayPlan(payload.planId, product.id);

    await enforceAdminMutationGate({
      action: "license.plan_change",
      actor,
      organizationId,
      entityType: "License",
      entityId: licenseId,
      confirmed: payload.confirmed,
      reason: payload.reason,
    });

    await changeLicensePlanWithSubscriptionSync({
      organizationId,
      licenseId,
      targetPlanId: payload.planId,
      reason: payload.reason,
      confirmed: payload.confirmed,
      actor,
    });

    revalidateLicenseRoutes(organizationId);
    redirect(readReturnTo(formData, `/admin/organizations/${organizationId}`));
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, `/admin/organizations/${organizationId}`, error, "Paket değiştirilemedi.");
  }
}

export async function waiveAdminActivationFeeAction(organizationId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const payload = parseActivationFeeWaivePayload(formData);
    await assertOrganization(organizationId);

    await enforceAdminMutationGate({
      action: "activation_fee.waive",
      actor,
      organizationId,
      entityType: "ActivationFeeLedger",
      confirmed: payload.confirmed,
      reason: payload.reason,
    });

    await waiveActivationFeeAsAdmin({
      organizationId,
      productId: payload.productId,
      reason: payload.reason,
      confirmed: payload.confirmed,
      actor,
    });

    revalidateLicenseRoutes(organizationId);
    revalidatePath("/admin/billing");
    redirect(readReturnTo(formData, `/admin/organizations/${organizationId}`));
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, `/admin/organizations/${organizationId}`, error, "Aktivasyon ücreti muafiyeti tamamlanamadı.");
  }
}

export async function changeAdminLicenseStatusAction(organizationId: string, licenseId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const payload = parseLicenseStatusPayload(formData);
    const confirm = readHighRiskConfirmation(formData);
    const license = await assertOrganizationLicense(organizationId, licenseId);

    await runAdminMutation({
      action: "license.status_change",
      actor,
      organizationId,
      entityType: "License",
      entityId: licenseId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: { organizationId, licenseId, status: payload.status },
      execute: async ({ tx }) => {
        const subscription = await tx.subscription.findFirst({ where: { licenseId } });
        const transition = evaluateLicenseStatusAgainstSubscription({
          licenseStatus: payload.status,
          subscriptionStatus: subscription?.status ?? null,
        });
        if (!transition.ok) {
          throw new AdminMutationGuardError("invalid_state_transition", transition.message);
        }
        if (license.status === payload.status) {
          return {
            organizationId,
            entityId: licenseId,
            before: { status: license.status },
            after: { status: license.status },
            transition: "noop",
          };
        }

        const updated = await tx.license.updateMany({
          where: { id: licenseId, status: license.status },
          data: { status: payload.status },
        });
        if (updated.count === 0) {
          throw new AdminMutationGuardError(
            "stale_version",
            "Lisans durumu başka bir işlem tarafından değiştirilmiş. Sayfayı yenileyin.",
          );
        }

        return {
          organizationId,
          entityId: licenseId,
          before: { status: license.status },
          after: { status: payload.status },
          transition: `${license.status}->${payload.status}`,
          metadata: { subscriptionStatus: subscription?.status ?? null },
        };
      },
    });

    revalidateLicenseRoutes(organizationId);
    redirect(readReturnTo(formData, `/admin/organizations/${organizationId}`));
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, `/admin/organizations/${organizationId}`, error, "Lisans durumu değiştirilemedi.");
  }
}

export async function updateAdminInvoiceStatusAction(invoiceId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/billing");
  try {
    const actor = await assertAdminAccess();
    const payload = parseInvoiceStatusPayload(formData);
    const confirm = readHighRiskConfirmation(formData);

    await runAdminMutation({
      action: "invoice.status_change",
      actor,
      entityType: "Invoice",
      entityId: invoiceId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: { invoiceId, status: payload.status },
      execute: async ({ tx }) => executeUpdateInvoiceStatus(tx, invoiceId, payload.status),
    });

    revalidateBillingRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Fatura durumu güncellenemedi.");
  }
}

export async function updateAdminProductStatusAction(productId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/products");
  try {
    const actor = await assertAdminAccess();
    const payload = parseProductStatusPayload(formData);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AdminValidationError("Ürün bulunamadı.");

    if (payload.status !== "ACTIVE") {
      const confirm = readHighRiskConfirmation(formData);
      await runAdminMutation({
        action: "product.disable",
        actor,
        entityType: "Product",
        entityId: productId,
        confirmed: confirm.confirmed,
        reason: confirm.reason,
        requestHashPayload: { productId, status: payload.status },
        execute: async ({ tx }) => {
          const updated = await tx.product.update({
            where: { id: productId },
            data: { status: payload.status, isActive: false },
          });
          return {
            entityId: productId,
            before: { status: product.status },
            after: { status: updated.status },
            transition: `${product.status}->${payload.status}`,
          };
        },
      });
    } else {
      await runAdminMutation({
        action: "product.enable",
        actor,
        entityType: "Product",
        entityId: productId,
        requestHashPayload: { productId, status: payload.status },
        execute: async ({ tx }) => {
          const updated = await tx.product.update({
            where: { id: productId },
            data: { status: payload.status, isActive: true },
          });
          return {
            entityId: productId,
            before: { status: product.status },
            after: { status: updated.status },
            transition: `${product.status}->${payload.status}`,
          };
        },
      });
    }

    revalidateCatalogRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Ürün durumu güncellenemedi.");
  }
}

export async function updateAdminPlanActiveAction(planId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/plans");
  try {
    const actor = await assertAdminAccess();
    const payload = parsePlanActivePayload(formData);
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new AdminValidationError("Paket bulunamadı.");

    if (!payload.isActive) {
      const confirm = readHighRiskConfirmation(formData);
      await runAdminMutation({
        action: "plan.disable",
        actor,
        entityType: "Plan",
        entityId: planId,
        confirmed: confirm.confirmed,
        reason: confirm.reason,
        requestHashPayload: { planId, isActive: payload.isActive },
        execute: async ({ tx }) => {
          const updated = await tx.plan.update({
            where: { id: planId },
            data: { isActive: false },
          });
          return {
            entityId: planId,
            before: { isActive: plan.isActive },
            after: { isActive: updated.isActive },
            transition: `${plan.isActive}->false`,
          };
        },
      });
    } else {
      await runAdminMutation({
        action: "plan.enable",
        actor,
        entityType: "Plan",
        entityId: planId,
        requestHashPayload: { planId, isActive: payload.isActive },
        execute: async ({ tx }) => {
          const updated = await tx.plan.update({
            where: { id: planId },
            data: { isActive: true },
          });
          return {
            entityId: planId,
            before: { isActive: plan.isActive },
            after: { isActive: updated.isActive },
            transition: `${plan.isActive}->true`,
          };
        },
      });
    }

    revalidateCatalogRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Paket durumu güncellenemedi.");
  }
}

export async function updateAdminSubscriptionStatusAction(subscriptionId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/subscriptions");
  try {
    const actor = await assertAdminAccess();
    const payload = parseSubscriptionStatusPayload(formData);
    const confirm = readHighRiskConfirmation(formData);

    await runAdminMutation({
      action: "subscription.status_change",
      actor,
      entityType: "Subscription",
      entityId: subscriptionId,
      confirmed: confirm.confirmed,
      reason: confirm.reason || payload.auditNote,
      requestHashPayload: {
        subscriptionId,
        status: payload.status,
        acknowledgePaytrPaid: payload.acknowledgePaytrPaid,
      },
      execute: async ({ tx }) => {
        const subscription = await tx.subscription.findUnique({ where: { id: subscriptionId } });
        if (!subscription) throw new AdminValidationError("Abonelik bulunamadı.");

        const transition = evaluateSubscriptionStatusTransition(subscription.status, payload.status);
        if (!transition.ok) {
          throw new AdminMutationGuardError("invalid_state_transition", transition.message);
        }

        const paidPaytr = await tx.subscriptionPayment.findFirst({
          where: {
            organizationId: subscription.organizationId,
            planId: subscription.planId,
            status: "PAID",
            provider: "PAYTR",
          },
          orderBy: { paidAt: "desc" },
        });

        if (
          payload.status === "ACTIVE" &&
          paidPaytr &&
          subscription.status !== "ACTIVE" &&
          !payload.acknowledgePaytrPaid
        ) {
          throw new AdminValidationError(
            "Bu plan için PAID PayTR ödemesi var. Çift aktivasyonu önlemek için acknowledgePaytrPaid işaretleyin ve audit notu girin.",
          );
        }

        if (transition.kind === "noop") {
          return {
            organizationId: subscription.organizationId,
            entityId: subscription.id,
            before: { status: subscription.status },
            after: { status: subscription.status },
            transition: "noop",
          };
        }

        const nextCancelAt =
          payload.status === "CANCELLED"
            ? new Date()
            : payload.status === "ACTIVE" || payload.status === "TRIALING"
              ? null
              : subscription.cancelAt;

        const updatedRows = await tx.subscription.updateMany({
          where: { id: subscriptionId, status: subscription.status },
          data: {
            status: payload.status,
            cancelAt: nextCancelAt,
          },
        });
        if (updatedRows.count === 0) {
          throw new AdminMutationGuardError(
            "stale_version",
            "Abonelik durumu başka bir işlem tarafından değiştirilmiş. Sayfayı yenileyin.",
          );
        }

        const updated = await tx.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
        const accessSync = await syncSubscriptionAccessState(tx, {
          subscription: {
            id: updated.id,
            organizationId: updated.organizationId,
            licenseId: updated.licenseId,
            status: updated.status,
            cancelAt: updated.cancelAt,
            currentPeriodEnd: updated.currentPeriodEnd,
          },
          previousStatus: subscription.status,
        });

        return {
          organizationId: subscription.organizationId,
          entityId: subscriptionId,
          before: { subscriptionStatus: subscription.status },
          after: { subscriptionStatus: updated.status, cancelAt: updated.cancelAt },
          transition: `${subscription.status}->${payload.status}`,
          metadata: {
            auditNote: payload.auditNote,
            acknowledgePaytrPaid: payload.acknowledgePaytrPaid,
            paidPaytrMerchantOidMasked: maskMerchantOid(paidPaytr?.merchantOid ?? null),
            accessSync: {
              intent: accessSync.intent,
              reason: accessSync.reason,
              licenseId: accessSync.licenseId,
              license: accessSync.license,
              installation: accessSync.installation,
            },
          },
        };
      },
    });

    revalidateCatalogRoutes();
    revalidateBillingRoutes();
    const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (subscription) revalidateLicenseRoutes(subscription.organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Abonelik durumu güncellenemedi.");
  }
}

export async function revokeAdminApiKeyAction(apiKeyId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/integrations");
  try {
    const actor = await assertAdminAccess();

    await runAdminMutation({
      action: "api_key.revoke",
      actor,
      entityType: "ApiKey",
      entityId: apiKeyId,
      requestHashPayload: { apiKeyId },
      execute: async ({ tx }) => {
        const apiKey = await tx.apiKey.findUnique({ where: { id: apiKeyId } });
        if (!apiKey) throw new AdminValidationError("API anahtarı bulunamadı.");
        if (apiKey.revokedAt) throw new AdminValidationError("API anahtarı zaten iptal edilmiş.");

        await tx.apiKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } });

        return {
          organizationId: apiKey.organizationId,
          entityId: apiKeyId,
          before: { revokedAt: apiKey.revokedAt },
          after: { revokedAt: new Date().toISOString() },
          metadata: { prefix: apiKey.prefix, name: apiKey.name },
        };
      },
    });

    revalidateIntegrationRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "API anahtarı iptal edilemedi.");
  }
}

export async function toggleAdminWebhookAction(webhookId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/integrations");
  try {
    const actor = await assertAdminAccess();
    const payload = parseWebhookActivePayload(formData);

    await runAdminMutation({
      action: "webhook.toggle",
      actor,
      entityType: "WebhookEndpoint",
      entityId: webhookId,
      requestHashPayload: { webhookId, isActive: payload.isActive },
      execute: async ({ tx }) => {
        const webhook = await tx.webhookEndpoint.findUnique({ where: { id: webhookId } });
        if (!webhook) throw new AdminValidationError("Webhook bulunamadı.");

        const updated = await tx.webhookEndpoint.update({
          where: { id: webhookId },
          data: { isActive: payload.isActive },
        });

        return {
          organizationId: webhook.organizationId,
          entityId: webhookId,
          before: { isActive: webhook.isActive },
          after: { isActive: updated.isActive },
          transition: `${webhook.isActive}->${updated.isActive}`,
        };
      },
    });

    revalidateIntegrationRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Webhook durumu güncellenemedi.");
  }
}

export async function createAdminRestaurantAction(organizationId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const payload = parseRestaurantPayload(formData);
    await assertOrganization(organizationId);

    await runAdminMutation({
      action: "restaurant.create",
      actor,
      organizationId,
      entityType: "Restaurant",
      requestHashPayload: { organizationId, ...payload },
      execute: async ({ tx }) => {
        const restaurant = await tx.restaurant.create({
          data: { ...payload, organizationId },
        });
        return {
          organizationId,
          entityId: restaurant.id,
          after: { name: restaurant.name, slug: restaurant.slug },
        };
      },
    });

    revalidateOrganizationRoutes(organizationId);
    revalidatePath("/dashboard/organization");
    redirect(`/admin/organizations/${organizationId}`);
  } catch (error) {
    throwIfRedirectError(error);
    if (isUniqueConflict(error)) {
      redirectWithError(formData, `/admin/organizations/${organizationId}`, new Error("Bu işletme slug değeri zaten kullanılıyor."));
    }
    redirectWithError(formData, `/admin/organizations/${organizationId}`, error, "İşletme oluşturulamadı.");
  }
}

export async function addAdminMembershipAction(organizationId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const payload = parseMembershipPayload(formData);
    await assertOrganization(organizationId);

    const wexpayAccess = await evaluateProductAccess({ organizationId, productKey: "wexpay" });

    await runAdminMutation({
      action: "membership.add",
      actor,
      organizationId,
      entityType: "Membership",
      requestHashPayload: {
        organizationId,
        email: maskEmailForAudit(payload.email),
        role: payload.role,
        mustChangePassword: payload.mustChangePassword,
        hasTemporaryPassword: Boolean(payload.temporaryPassword),
      },
      execute: async ({ tx }) => {
        const existingUser = await tx.user.findUnique({ where: { email: payload.email } });
        if (!existingUser && !payload.temporaryPassword) {
          throw new AdminValidationError("Yeni kullanıcı oluşturmak için geçici şifre zorunludur.");
        }

        const passwordData = payload.temporaryPassword
          ? {
              passwordHash: await hashPassword(payload.temporaryPassword),
              passwordSetAt: new Date(),
              mustChangePassword: payload.mustChangePassword,
            }
          : {};

        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: { name: payload.name ?? undefined, isActive: true, ...passwordData },
            })
          : await tx.user.create({
              data: { email: payload.email, name: payload.name, isActive: true, ...passwordData },
            });

        const existingMembership = await tx.membership.findUnique({
          where: { organizationId_userId: { organizationId, userId: user.id } },
        });

        if (!existingMembership || existingMembership.status !== "ACTIVE") {
          const activeStaffCount = await tx.membership.count({
            where: { organizationId, status: "ACTIVE" },
          });
          const limitCheck = assertStaffEntitlementLimit(wexpayAccess, activeStaffCount);
          if (!limitCheck.ok) {
            throw new AdminValidationError(limitCheck.message);
          }
        }

        const membership = await tx.membership.upsert({
          where: { organizationId_userId: { organizationId, userId: user.id } },
          update: { role: payload.role, status: "ACTIVE" },
          create: { organizationId, userId: user.id, role: payload.role, status: "ACTIVE", acceptedAt: new Date() },
        });

        return {
          organizationId,
          entityId: membership.id,
          after: { role: membership.role, status: membership.status },
          metadata: {
            userId: user.id,
            emailMasked: maskEmailForAudit(user.email),
            role: membership.role,
            emailInvitationSent: false,
            passwordSet: Boolean(payload.temporaryPassword),
            mustChangePassword: payload.mustChangePassword,
          },
        };
      },
    });

    revalidateOrganizationRoutes(organizationId);
    revalidateUserRoutes(organizationId);
    redirect(readReturnTo(formData, `/admin/organizations/${organizationId}`));
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, `/admin/organizations/${organizationId}`, error, "Kullanıcı eklenemedi.");
  }
}

export async function updateAdminMembershipRoleAction(organizationId: string, membershipId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, `/admin/organizations/${organizationId}`);
  try {
    const actor = await assertAdminAccess();
    const payload = parseMembershipRolePayload(formData);

    await runAdminMutation({
      action: "membership.role_change",
      actor,
      organizationId,
      entityType: "Membership",
      entityId: membershipId,
      requestHashPayload: { organizationId, membershipId, role: payload.role },
      execute: async ({ tx }) => {
        const membership = await tx.membership.findFirst({
          where: { id: membershipId, organizationId },
          include: { user: true },
        });
        if (!membership) throw new AdminValidationError("Üyelik bulunamadı.");
        if (membership.role === "OWNER" && payload.role !== "OWNER") {
          try {
            await assertMembershipChangePreservesActiveOwners(tx, {
              organizationId,
              excludingMembershipId: membership.id,
            });
          } catch (error) {
            if (error instanceof LastActiveOwnerError) {
              throw new AdminValidationError("Son sahip rolü düşürülemez.");
            }
            throw error;
          }
        }
        const updated = await tx.membership.update({ where: { id: membershipId }, data: { role: payload.role } });
        return {
          organizationId,
          entityId: membershipId,
          before: { role: membership.role },
          after: { role: updated.role },
          transition: `${membership.role}->${updated.role}`,
          metadata: { emailMasked: maskEmailForAudit(membership.user.email) },
        };
      },
    });

    revalidateUserRoutes(organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Üyelik rolü güncellenemedi.");
  }
}

export async function updateAdminMembershipStatusAction(organizationId: string, membershipId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, `/admin/organizations/${organizationId}`);
  try {
    const actor = await assertAdminAccess();
    const payload = parseMembershipStatusPayload(formData);

    await runAdminMutation({
      action: "membership.status_change",
      actor,
      organizationId,
      entityType: "Membership",
      entityId: membershipId,
      requestHashPayload: { organizationId, membershipId, status: payload.status },
      execute: async ({ tx }) => {
        const membership = await tx.membership.findFirst({
          where: { id: membershipId, organizationId },
          include: { user: true },
        });
        if (!membership) throw new AdminValidationError("Üyelik bulunamadı.");
        if (membership.role === "OWNER" && payload.status !== "ACTIVE") {
          try {
            await assertMembershipChangePreservesActiveOwners(tx, {
              organizationId,
              excludingMembershipId: membership.id,
            });
          } catch (error) {
            if (error instanceof LastActiveOwnerError) {
              throw new AdminValidationError("Son sahip askıya alınamaz veya kaldırılamaz.");
            }
            throw error;
          }
        }
        const updated = await tx.membership.update({ where: { id: membershipId }, data: { status: payload.status } });
        return {
          organizationId,
          entityId: membershipId,
          before: { status: membership.status },
          after: { status: updated.status },
          transition: `${membership.status}->${updated.status}`,
          metadata: { emailMasked: maskEmailForAudit(membership.user.email) },
        };
      },
    });

    revalidateUserRoutes(organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Üyelik durumu güncellenemedi.");
  }
}

export async function resetAdminUserPasswordAction(userId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/users");
  try {
    const actor = await assertAdminAccess();
    const payload = parseUserPasswordResetPayload(formData);
    const passwordHash = await hashPassword(payload.temporaryPassword);

    await runAdminMutation({
      action: "user.password_reset",
      actor,
      entityType: "User",
      entityId: userId,
      requestHashPayload: { userId, mustChangePassword: payload.mustChangePassword },
      execute: async ({ tx }) => {
        const locked = await lockUserForUpdate(tx, userId);
        if (!locked) throw new AdminValidationError("Kullanıcı bulunamadı.");

        await tx.user.update({
          where: { id: userId },
          data: {
            passwordHash,
            passwordSetAt: new Date(),
            mustChangePassword: payload.mustChangePassword,
            isActive: true,
          },
        });

        return {
          entityId: userId,
          before: { isActive: locked.isActive },
          after: { isActive: true },
          metadata: { emailMasked: maskEmailForAudit(locked.email), mustChangePassword: payload.mustChangePassword },
        };
      },
    });

    revalidateUserRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Şifre sıfırlanamadı.");
  }
}

export async function toggleAdminUserActiveAction(userId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/users");
  try {
    const actor = await assertAdminAccess();

    await runAdminMutation({
      action: "user.active_change",
      actor,
      entityType: "User",
      entityId: userId,
      requestHashPayload: { userId },
      execute: async ({ tx }) => {
        const locked = await lockUserForUpdate(tx, userId);
        if (!locked) throw new AdminValidationError("Kullanıcı bulunamadı.");

        const nextActive = resolveNextActiveFromLockedUser(locked);

        if (!nextActive) {
          await assertUserDeactivationPreservesActiveOwners(tx, userId);
        }

        await tx.user.update({ where: { id: userId }, data: { isActive: nextActive } });

        return {
          entityId: userId,
          before: { isActive: locked.isActive },
          after: { isActive: nextActive },
          transition: `${locked.isActive}->${nextActive}`,
          metadata: { emailMasked: maskEmailForAudit(locked.email) },
        };
      },
    });

    revalidateUserRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Kullanıcı durumu güncellenemedi.");
  }
}

export async function createAdminInvoiceAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/billing");
  try {
    const actor = await assertAdminAccess();
    const payload = parseInvoiceCreatePayload(formData);
    const confirm = readHighRiskConfirmation(formData);
    const mutationId = readMutationId(formData);
    await assertOrganization(payload.organizationId);

    const money = assertMoneyInvariant({
      subtotal: payload.subtotal,
      tax: payload.tax,
      total: payload.total,
    });
    if (!money.ok) throw new AdminValidationError(money.message);
    const createStatus = assertInvoiceCreateStatus(payload.status);
    if (!createStatus.ok) throw new AdminValidationError(createStatus.message);

    if (payload.subscriptionId) {
      const subscription = await prisma.subscription.findUnique({ where: { id: payload.subscriptionId } });
      if (!subscription || subscription.organizationId !== payload.organizationId) {
        throw new AdminMutationGuardError("tenant_mismatch", "Abonelik bu organizasyona ait değil.");
      }
    }

    await runAdminMutation({
      action: "invoice.create",
      actor,
      organizationId: payload.organizationId,
      entityType: "Invoice",
      mutationId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: {
        organizationId: payload.organizationId,
        subscriptionId: payload.subscriptionId,
        invoiceNo: payload.invoiceNo,
        status: payload.status,
        subtotal: payload.subtotal,
        tax: payload.tax,
        total: payload.total,
        currency: payload.currency,
      },
      execute: async ({ tx }) => {
        if (payload.subscriptionId) {
          const subscription = await tx.subscription.findUnique({ where: { id: payload.subscriptionId } });
          if (!subscription || subscription.organizationId !== payload.organizationId) {
            throw new AdminMutationGuardError("tenant_mismatch", "Abonelik bu organizasyona ait değil.");
          }
        }
        const invoice = await tx.invoice.create({
          data: {
            organizationId: payload.organizationId,
            subscriptionId: payload.subscriptionId,
            invoiceNo: payload.invoiceNo,
            status: payload.status,
            subtotal: payload.subtotal,
            tax: payload.tax,
            total: payload.total,
            currency: payload.currency,
            issuedAt: payload.status === "ISSUED" ? new Date() : null,
            dueAt: payload.dueAt,
            paidAt: null,
          },
        });
        return {
          organizationId: payload.organizationId,
          entityId: invoice.id,
          after: { invoiceNo: invoice.invoiceNo, total: String(invoice.total), status: invoice.status },
          replayResult: { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo },
        };
      },
    });
    revalidateBillingRoutes();
    revalidateOrganizationRoutes(payload.organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    if (isUniqueConflict(error)) {
      redirectWithError(formData, returnTo, new AdminValidationError("Bu fatura numarası zaten kullanılıyor."));
    }
    redirectWithError(formData, returnTo, error, "Fatura oluşturulamadı.");
  }
}

export async function createAdminBillingPaymentAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/billing");
  try {
    const actor = await assertAdminAccess();
    const payload = parseBillingPaymentCreatePayload(formData);
    const confirm = readHighRiskConfirmation(formData);
    const mutationId = readMutationId(formData);
    await assertOrganization(payload.organizationId);

    const amountCheck = assertPositiveAmount(payload.amount);
    if (!amountCheck.ok) throw new AdminValidationError(amountCheck.message);
    if (!isAllowedAdminBillingPaymentProvider(payload.provider)) {
      throw new AdminValidationError("Manuel tahsilat sağlayıcısı yalnız admin_manual olabilir.");
    }

    await runAdminMutation({
      action: "billing_payment.create",
      actor,
      organizationId: payload.organizationId,
      entityType: "BillingPayment",
      mutationId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: {
        organizationId: payload.organizationId,
        invoiceId: payload.invoiceId,
        subscriptionId: payload.subscriptionId,
        amount: payload.amount,
        currency: payload.currency,
        status: payload.status,
        provider: payload.provider,
        providerRef: payload.providerRef,
      },
      execute: async ({ tx }) =>
        executeCreateBillingPayment(tx, {
          organizationId: payload.organizationId,
          invoiceId: payload.invoiceId,
          subscriptionId: payload.subscriptionId,
          amount: payload.amount,
          currency: payload.currency,
          status: payload.status as "PENDING" | "PAID" | "FAILED" | "REFUNDED",
          provider: payload.provider,
          providerRef: payload.providerRef,
        }),
    });
    revalidateBillingRoutes();
    revalidateOrganizationRoutes(payload.organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Tahsilat kaydedilemedi.");
  }
}

export async function updateAdminBillingPaymentStatusAction(paymentId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/billing");
  try {
    const actor = await assertAdminAccess();
    const status = String(formData.get("status") ?? "").trim();
    const confirm = readHighRiskConfirmation(formData);

    await runAdminMutation({
      action: "billing_payment.status_change",
      actor,
      entityType: "BillingPayment",
      entityId: paymentId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: { paymentId, status },
      execute: async ({ tx }) => executeUpdateBillingPaymentStatus(tx, paymentId, status),
    });

    revalidateBillingRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Tahsilat durumu güncellenemedi.");
  }
}

export async function createAdminProductAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/products");
  try {
    const actor = await assertAdminAccess();
    const payload = parseProductCreatePayload(formData);
    await runAdminMutation({
      action: "product.create",
      actor,
      entityType: "Product",
      requestHashPayload: payload,
      execute: async ({ tx }) => {
        const product = await tx.product.create({
          data: {
            key: payload.key,
            name: payload.name,
            description: payload.description,
            status: payload.status,
            isActive: payload.status === "ACTIVE",
          },
        });
        return {
          entityId: product.id,
          after: { key: product.key, name: product.name, status: product.status },
        };
      },
    });
    revalidateCatalogRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    if (isUniqueConflict(error)) redirectWithError(formData, returnTo, new Error("Bu ürün key değeri zaten kullanılıyor."));
    redirectWithError(formData, returnTo, error, "Ürün oluşturulamadı.");
  }
}

export async function updateAdminProductAction(productId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/products");
  try {
    const actor = await assertAdminAccess();
    const payload = parseProductUpdatePayload(formData);
    await runAdminMutation({
      action: "product.update",
      actor,
      entityType: "Product",
      entityId: productId,
      requestHashPayload: { productId, ...payload },
      execute: async ({ tx }) => {
        const before = await tx.product.findUnique({ where: { id: productId } });
        if (!before) throw new AdminValidationError("Ürün bulunamadı.");
        const updated = await tx.product.update({
          where: { id: productId },
          data: {
            name: payload.name,
            description: payload.description,
            status: payload.status,
            isActive: payload.isActive,
          },
        });
        return {
          entityId: productId,
          before: { name: before.name, status: before.status },
          after: { name: updated.name, status: updated.status },
        };
      },
    });
    revalidateCatalogRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Ürün güncellenemedi.");
  }
}

export async function createAdminPlanAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/plans");
  try {
    const actor = await assertAdminAccess();
    const payload = parsePlanCreatePayload(formData);
    await runAdminMutation({
      action: "plan.create",
      actor,
      entityType: "Plan",
      requestHashPayload: payload,
      execute: async ({ tx }) => {
        const product = await tx.product.findUnique({ where: { id: payload.productId } });
        if (!product) throw new AdminValidationError("Ürün bulunamadı.");
        const plan = await tx.plan.create({ data: payload });
        return {
          entityId: plan.id,
          after: { key: plan.key, name: plan.name, productId: plan.productId },
        };
      },
    });
    revalidateCatalogRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    if (isUniqueConflict(error)) redirectWithError(formData, returnTo, new Error("Bu paket key değeri zaten kullanılıyor."));
    redirectWithError(formData, returnTo, error, "Paket oluşturulamadı.");
  }
}

export async function updateAdminPlanAction(planId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/plans");
  try {
    const actor = await assertAdminAccess();
    const payload = parsePlanUpdatePayload(formData);
    await runAdminMutation({
      action: "plan.update",
      actor,
      entityType: "Plan",
      entityId: planId,
      requestHashPayload: { planId, ...payload },
      execute: async ({ tx }) => {
        const before = await tx.plan.findUnique({ where: { id: planId } });
        if (!before) throw new AdminValidationError("Paket bulunamadı.");
        const updated = await tx.plan.update({ where: { id: planId }, data: payload });
        return {
          entityId: planId,
          before: { name: before.name, isActive: before.isActive },
          after: { name: updated.name, isActive: updated.isActive },
        };
      },
    });
    revalidateCatalogRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Paket güncellenemedi.");
  }
}

export async function upsertAdminEntitlementAction(planId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/plans");
  try {
    const actor = await assertAdminAccess();
    const payload = parseEntitlementPayload(formData);
    const entitlementId = String(formData.get("entitlementId") ?? "").trim() || null;
    await runAdminMutation({
      action: "entitlement.upsert",
      actor,
      entityType: "Entitlement",
      entityId: entitlementId ?? undefined,
      requestHashPayload: { planId, entitlementId, ...payload },
      execute: async ({ tx }) => {
        const plan = await tx.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new AdminValidationError("Paket bulunamadı.");
        const entitlement = entitlementId
          ? await tx.entitlement.update({
              where: { id: entitlementId },
              data: {
                key: payload.key,
                valueType: payload.valueType,
                valueBool: payload.valueBool,
                valueInt: payload.valueInt,
                valueString: payload.valueString,
              },
            })
          : await tx.entitlement.create({
              data: {
                planId,
                key: payload.key,
                valueType: payload.valueType,
                valueBool: payload.valueBool,
                valueInt: payload.valueInt,
                valueString: payload.valueString,
              },
            });
        return {
          entityId: entitlement.id,
          after: { planId, key: entitlement.key, valueType: entitlement.valueType },
          transition: entitlementId ? "update" : "create",
        };
      },
    });
    revalidateCatalogRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    if (isUniqueConflict(error)) redirectWithError(formData, returnTo, new Error("Bu limit anahtarı pakette zaten tanımlı."));
    redirectWithError(formData, returnTo, error, "Limit kaydedilemedi.");
  }
}

export async function setAdminEntitlementActiveAction(planId: string, entitlementId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/plans");
  try {
    const actor = await assertAdminAccess();
    const isActive = String(formData.get("isActive") ?? "").trim() === "true";
    const note = String(formData.get("note") ?? "").trim() || null;
    const confirm = readHighRiskConfirmation(formData);

    await runAdminMutation({
      action: isActive ? "entitlement.enable" : "entitlement.disable",
      actor,
      entityType: "Entitlement",
      entityId: entitlementId,
      confirmed: isActive ? undefined : confirm.confirmed,
      reason: isActive ? note : confirm.reason || note,
      requestHashPayload: { planId, entitlementId, isActive, note },
      execute: async ({ tx }) => {
        const entitlement = await tx.entitlement.findFirst({
          where: { id: entitlementId, planId },
          include: { plan: { select: { id: true, key: true, name: true } } },
        });
        if (!entitlement) throw new AdminValidationError("Limit kaydı bulunamadı.");

        const previousIsActive = entitlement.isActive;
        if (previousIsActive === isActive) {
          return {
            entityId: entitlementId,
            before: { isActive: previousIsActive },
            after: { isActive },
            transition: "noop",
            metadata: { planId, key: entitlement.key, note },
          };
        }

        const updated = await tx.entitlement.update({
          where: { id: entitlement.id },
          data: {
            isActive,
            deactivatedAt: isActive ? null : new Date(),
          },
        });

        return {
          entityId: entitlementId,
          before: { isActive: previousIsActive },
          after: { isActive: updated.isActive },
          transition: `${previousIsActive}->${updated.isActive}`,
          metadata: { planId, key: entitlement.key, note },
        };
      },
    });

    revalidateCatalogRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Limit durumu güncellenemedi.");
  }
}

/** @deprecated Physical delete is forbidden — use setAdminEntitlementActiveAction. */
export async function deleteAdminEntitlementAction(planId: string, entitlementId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/plans");
  try {
    await assertAdminAccess();
    assertEntitlementPhysicalDeleteForbidden();
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Limit silinemez; devre dışı bırakın.");
  }
}

export async function createAdminSubscriptionAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/subscriptions");
  try {
    const actor = await assertAdminAccess();
    const payload = parseSubscriptionCreatePayload(formData);
    const confirm = readHighRiskConfirmation(formData);
    const mutationId = readMutationId(formData);
    await assertOrganization(payload.organizationId);
    const plan = await prisma.plan.findUnique({ where: { id: payload.planId }, include: { product: true } });
    if (!plan) throw new AdminValidationError("Paket bulunamadı.");

    await runAdminMutation({
      action: "subscription.create",
      actor,
      organizationId: payload.organizationId,
      entityType: "Subscription",
      mutationId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: {
        organizationId: payload.organizationId,
        planId: payload.planId,
        status: payload.status,
        interval: payload.interval,
        currentPeriodStart: payload.currentPeriodStart.toISOString(),
        currentPeriodEnd: payload.currentPeriodEnd?.toISOString() ?? null,
        provider: payload.provider,
        providerRef: payload.providerRef,
      },
      execute: async ({ tx }) =>
        executeCreateSubscription(tx, {
          organizationId: payload.organizationId,
          planId: payload.planId,
          status: payload.status,
          interval: payload.interval as "MONTHLY" | "YEARLY" | "ONE_TIME",
          currentPeriodStart: payload.currentPeriodStart,
          currentPeriodEnd: payload.currentPeriodEnd,
          provider: payload.provider,
          providerRef: payload.providerRef,
        }),
    });

    revalidateCatalogRoutes();
    revalidateBillingRoutes();
    revalidateLicenseRoutes(payload.organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Abonelik oluşturulamadı.");
  }
}

export async function updateAdminLicenseDetailsAction(organizationId: string, licenseId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, `/admin/organizations/${organizationId}`);
  try {
    const actor = await assertAdminAccess();
    const payload = parseLicenseDetailsPayload(formData);
    const confirm = readHighRiskConfirmation(formData);

    await runAdminMutation({
      action: "license.details_change",
      actor,
      organizationId,
      entityType: "License",
      entityId: licenseId,
      confirmed: confirm.confirmed,
      reason: confirm.reason,
      requestHashPayload: {
        organizationId,
        licenseId,
        licenseType: payload.licenseType,
        startsAt: payload.startsAt?.toISOString() ?? null,
        endsAt: payload.endsAt?.toISOString() ?? null,
      },
      execute: async ({ tx }) => {
        const license = await tx.license.findFirst({ where: { id: licenseId, organizationId } });
        if (!license) throw new AdminValidationError("Lisans bulunamadı.");
        const updated = await tx.license.update({
          where: { id: licenseId },
          data: {
            licenseType: payload.licenseType,
            startsAt: payload.startsAt,
            endsAt: payload.endsAt,
          },
        });
        return {
          organizationId,
          entityId: licenseId,
          before: {
            licenseType: license.licenseType,
            startsAt: license.startsAt,
            endsAt: license.endsAt,
            status: license.status,
          },
          after: {
            licenseType: updated.licenseType,
            startsAt: updated.startsAt,
            endsAt: updated.endsAt,
            status: updated.status,
          },
        };
      },
    });

    revalidateLicenseRoutes(organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Lisans güncellenemedi.");
  }
}

export async function createAdminApiKeyAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/integrations");
  try {
    const actor = await assertAdminAccess();
    const payload = parseApiKeyCreatePayload(formData);
    const mutationId = readMutationId(formData);
    await assertOrganization(payload.organizationId);

    let flashKey: { name: string; prefix: string; rawKey: string } | null = null;

    const result = await runAdminMutation({
      action: "api_key.create",
      actor,
      organizationId: payload.organizationId,
      entityType: "ApiKey",
      mutationId,
      requestHashPayload: {
        organizationId: payload.organizationId,
        productId: payload.productId,
        name: payload.name,
      },
      execute: async ({ tx }) => {
        const rawKey = `wex_${randomBytes(24).toString("base64url")}`;
        const prefix = rawKey.slice(0, 12);
        flashKey = { name: payload.name, prefix, rawKey };

        const apiKey = await tx.apiKey.create({
          data: {
            organizationId: payload.organizationId,
            productId: payload.productId,
            name: payload.name,
            prefix,
            hashedKey: hashApiKey(rawKey),
            scopes: ["wexpay:read", "wexpay:write"],
          },
        });

        return {
          organizationId: payload.organizationId,
          entityId: apiKey.id,
          after: { name: apiKey.name, prefix: apiKey.prefix },
          replayResult: { apiKeyId: apiKey.id, prefix: apiKey.prefix },
        };
      },
    });

    if (flashKey && !result.metadata?.idempotentReplay) {
      await setAdminApiKeyFlashCookie(flashKey);
    }

    revalidateIntegrationRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "API anahtarı oluşturulamadı.");
  }
}

export async function createAdminWebhookAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/integrations");
  try {
    const actor = await assertAdminAccess();
    const payload = parseWebhookCreatePayload(formData);
    const mutationId = readMutationId(formData);
    await assertOrganization(payload.organizationId);

    await runAdminMutation({
      action: "webhook.create",
      actor,
      organizationId: payload.organizationId,
      entityType: "WebhookEndpoint",
      mutationId,
      requestHashPayload: {
        organizationId: payload.organizationId,
        productId: payload.productId,
        url: payload.url,
        events: payload.events,
      },
      execute: async ({ tx }) => {
        const webhook = await tx.webhookEndpoint.create({
          data: {
            organizationId: payload.organizationId,
            productId: payload.productId,
            url: payload.url,
            secretHash: sha256(randomBytes(32).toString("base64url")),
            events: payload.events,
            isActive: true,
          },
        });

        return {
          organizationId: payload.organizationId,
          entityId: webhook.id,
          after: { url: webhook.url, events: webhook.events },
          replayResult: { webhookId: webhook.id },
        };
      },
    });

    revalidateIntegrationRoutes();
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Webhook oluşturulamadı.");
  }
}

export async function updateAdminSupportTicketAction(ticketId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/support");
  try {
    const actor = await assertAdminAccess();
    const payload = parseSupportTicketUpdatePayload(formData);

    await runAdminMutation({
      action: "support_ticket.update",
      actor,
      entityType: "SupportTicket",
      entityId: ticketId,
      requestHashPayload: { ticketId, status: payload.status, hasReply: Boolean(payload.adminReply) },
      execute: async ({ tx }) => {
        const ticket = await tx.auditLog.findUnique({ where: { id: ticketId } });
        if (!ticket || ticket.action !== "customer.support_ticket.created") {
          throw new AdminValidationError("Destek talebi bulunamadı.");
        }
        const currentMeta =
          typeof ticket.metadataJson === "object" && ticket.metadataJson !== null
            ? (ticket.metadataJson as Record<string, unknown>)
            : {};
        const nextMeta = {
          ...currentMeta,
          status: payload.status,
          adminReply: payload.adminReply ?? (typeof currentMeta.adminReply === "string" ? currentMeta.adminReply : null),
          adminRepliedAt: payload.adminReply ? new Date().toISOString() : currentMeta.adminRepliedAt ?? null,
          adminActor: getAdminActionActor(actor),
        };
        await tx.auditLog.update({ where: { id: ticketId }, data: { metadataJson: nextMeta } });
        return {
          organizationId: ticket.organizationId,
          entityId: ticketId,
          before: { status: currentMeta.status ?? null },
          after: { status: payload.status },
          metadata: { hasReply: Boolean(payload.adminReply) },
        };
      },
    });

    revalidatePath("/admin/support");
    revalidatePath("/admin");
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Destek talebi güncellenemedi.");
  }
}

export async function updateAdminAppInstallationSettingsAction(organizationId: string, installationId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, `/admin/organizations/${organizationId}`);
  try {
    const actor = await assertAdminAccess();
    const payload = parseAppInstallationSettingsPayload(formData);

    await runAdminMutation({
      action: "installation.settings_change",
      actor,
      organizationId,
      entityType: "AppInstallation",
      entityId: installationId,
      requestHashPayload: { organizationId, installationId, ...payload },
      execute: async ({ tx }) => {
        const installation = await tx.appInstallation.findFirst({ where: { id: installationId, organizationId } });
        if (!installation) throw new AdminValidationError("Kurulum kaydı bulunamadı.");
        const settingsJson = {
          ...(typeof installation.settingsJson === "object" && installation.settingsJson !== null ? installation.settingsJson : {}),
          onboardingStatus: payload.onboardingStatus,
          message: payload.message,
          estimatedBusinessDays: payload.estimatedBusinessDays,
          source: payload.source,
        };
        await tx.appInstallation.update({ where: { id: installationId }, data: { settingsJson } });
        return {
          organizationId,
          entityId: installationId,
          after: settingsJson,
        };
      },
    });

    revalidateOrganizationRoutes(organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Kurulum ayarları güncellenemedi.");
  }
}

export async function updateAdminDemoRequestStatusAction(demoRequestId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/support");
  try {
    const actor = await assertAdminAccess();
    const payload = parseDemoRequestLeadStatusPayload(formData);

    await runAdminMutation({
      action: "demo_request.status_change",
      actor,
      entityType: "DemoRequest",
      entityId: demoRequestId,
      requestHashPayload: { demoRequestId, leadStatus: payload.leadStatus },
      execute: async ({ tx }) => {
        const demoRequest = await tx.auditLog.findUnique({ where: { id: demoRequestId } });
        if (!demoRequest || demoRequest.action !== "public.demo_request.created") {
          throw new AdminValidationError("Demo talebi bulunamadı.");
        }

        const statusUpdates = await tx.auditLog.findMany({
          where: {
            action: "public.demo_request.status_updated",
            entityId: demoRequestId,
          },
          orderBy: { createdAt: "asc" },
          select: { metadataJson: true, createdAt: true },
        });

        const previousStatus = resolveDemoLeadStatus(demoRequest.metadataJson, statusUpdates);
        const nextStatus = payload.leadStatus;

        if (previousStatus !== nextStatus) {
          await tx.auditLog.create({
            data: {
              action: "public.demo_request.status_updated",
              entityType: "DemoRequest",
              entityId: demoRequestId,
              message: `Lead durumu ${previousStatus} → ${nextStatus}`,
              metadataJson: {
                source: "admin_demo_request_management",
                originalDemoRequestId: demoRequestId,
                previousStatus,
                nextStatus,
                actor: getAdminActionActor(actor),
              },
            },
          });
        }

        return {
          entityId: demoRequestId,
          before: { leadStatus: previousStatus },
          after: { leadStatus: nextStatus },
          transition: previousStatus === nextStatus ? "noop" : `${previousStatus}->${nextStatus}`,
        };
      },
    });

    revalidatePath("/admin/support");
    revalidatePath("/admin/applications");
    revalidatePath("/admin");
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Lead durumu güncellenemedi.");
  }
}

export async function updateAdminDemoRequestFollowUpAction(demoRequestId: string, formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/support");
  try {
    const actor = await assertAdminAccess();
    const payload = parseDemoRequestFollowUpPayload(formData);

    await runAdminMutation({
      action: "demo_request.follow_up",
      actor,
      entityType: "DemoRequest",
      entityId: demoRequestId,
      requestHashPayload: {
        demoRequestId,
        note: payload.note,
        followUpAt: payload.followUpAt,
      },
      execute: async ({ tx }) => {
        const demoRequest = await tx.auditLog.findUnique({ where: { id: demoRequestId } });
        if (!demoRequest || demoRequest.action !== "public.demo_request.created") {
          throw new AdminValidationError("Demo talebi bulunamadı.");
        }

        await tx.auditLog.create({
          data: {
            action: "public.demo_request.followup_updated",
            entityType: "DemoRequest",
            entityId: demoRequestId,
            message: payload.note ? "Lead takip notu güncellendi" : "Lead takip tarihi güncellendi",
            metadataJson: {
              source: "admin_demo_request_management",
              originalDemoRequestId: demoRequestId,
              note: payload.note,
              followUpAt: payload.followUpAt,
              actor: getAdminActionActor(actor),
            },
          },
        });

        return {
          entityId: demoRequestId,
          after: { note: payload.note, followUpAt: payload.followUpAt ?? null },
        };
      },
    });

    revalidatePath("/admin/support");
    revalidatePath("/admin/applications");
    revalidatePath("/admin");
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Takip bilgisi kaydedilemedi.");
  }
}
