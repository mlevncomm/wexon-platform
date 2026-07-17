"use server";

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDebug, assertAdminAccess, type AdminSession } from "@/lib/wexon-admin-auth";
import {
  assertEntitlementPhysicalDeleteForbidden,
  setEntitlementActiveState,
} from "@/lib/wexon-entitlement-lifecycle";
import { writeAuditLog } from "@/lib/wexon-audit";
import { hashApiKey } from "@/lib/wexon-api-key-hash";
import { resolveDemoLeadStatus } from "@/lib/wexon-demo-request-leads";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/wexon-passwords";
import { assertStaffEntitlementLimit, evaluateProductAccess } from "@/lib/wexon-core-access";
import { syncSubscriptionAccessState } from "@/lib/wexon-subscription-lifecycle";
import {
  assertMembershipChangePreservesActiveOwners,
  assertUserDeactivationPreservesActiveOwners,
  LastActiveOwnerError,
  lockUserForUpdate,
  resolveNextActiveFromLockedUser,
  runWithTransactionRetry,
} from "@/lib/wexon-active-owner";
import {
  AdminValidationError,
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
    email: actor.email,
  };
}

async function writeAdminAuditLog(input: AdminAuditInput, client: AuditClient = prisma) {
  return client.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: {
        actor: getAdminActionActor(input.actor),
        source: "admin_organization_management",
        ...(input.metadata ?? {}),
      },
    },
  });
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AdminValidationError) return error.message;
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

function redirectWithError(formData: FormData, fallback: string, error: unknown, message = "İşlem tamamlanamadı.") {
  const returnTo = readReturnTo(formData, fallback);
  const params = new URLSearchParams({ adminError: getActionErrorMessage(error, message) });
  redirect(`${returnTo}?${params.toString()}`);
}

function redirectPathWithError(path: string, error: unknown, message = "İşlem tamamlanamadı.") {
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

function addPeriod(date: Date, interval: "MONTHLY" | "YEARLY") {
  const next = new Date(date);
  if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
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
    adminDebug("org:create:form_keys", { keys: Array.from(formData.keys()) });
    const actor = await assertAdminAccess();
    adminDebug("org:create:actor", { email: actor.email });
    const payload = parseOrganizationPayload(formData);
    adminDebug("org:create:validated", { name: payload.name, slug: payload.slug, email: payload.email, country: payload.country, isActive: payload.isActive });
    const organization = await prisma.$transaction(async (tx) => {
      adminDebug("org:create:db_create_start");
      const created = await tx.organization.create({ data: payload });
      adminDebug("org:create:created", { organizationId: created.id });
      await writeAdminAuditLog(
        {
          action: "admin.organization.created",
          actor,
          organizationId: created.id,
          entityType: "Organization",
          entityId: created.id,
          metadata: { after: payload },
        },
        tx,
      );
      adminDebug("org:create:audit_written", { organizationId: created.id });
      return created;
    });

    adminDebug("org:create:revalidate_start", { organizationId: organization.id });
    revalidateOrganizationRoutes(organization.id);
    const returnTo = readReturnTo(formData, `/admin/organizations/${organization.id}`);
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
    await prisma.$transaction(async (tx) => {
      const before = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!before) {
        throw new AdminValidationError("Organizasyon bulunamadı.");
      }

      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: payload,
      });

      await writeAdminAuditLog(
        {
          action: "admin.organization.updated",
          actor,
          organizationId,
          entityType: "Organization",
          entityId: organizationId,
          metadata: {
            before: {
              name: before.name,
              slug: before.slug,
              legalName: before.legalName,
              taxNo: before.taxNo,
              email: before.email,
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
              email: updated.email,
              phone: updated.phone,
              country: updated.country,
              isDemo: updated.isDemo,
              isActive: updated.isActive,
            },
          },
        },
        tx,
      );
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

    await prisma.$transaction(async (tx) => {
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

      await writeAdminAuditLog(
        {
          action: "admin.organization.deactivated",
          actor,
          organizationId,
          entityType: "Organization",
          entityId: organizationId,
          metadata: {
            before: { isActive: organization.isActive },
            after: { isActive: updated.isActive },
            productAccessDisabled: Boolean(wexPayProduct),
            hardDelete: false,
          },
        },
        tx,
      );
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

    await prisma.$transaction(async (tx) => {
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

      await writeAdminAuditLog(
        {
          action: "admin.organization.reactivated",
          actor,
          organizationId,
          entityType: "Organization",
          entityId: organizationId,
          metadata: {
            before: { isActive: organization.isActive },
            after: { isActive: updated.isActive },
            productAccessReactivated: Boolean(wexPayProduct),
          },
        },
        tx,
      );
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

    const organization = await prisma.organization.findUnique({
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
      throw new AdminValidationError("Bu müşteriye ait fatura veya ödeme kaydı olduğu için kalıcı silme yapılamaz. Müşteriyi pasife alabilirsiniz.");
    }

    await prisma.$transaction(async (tx) => {
      await writeAdminAuditLog(
        {
          action: "admin.organization.permanently_deleted",
          actor,
          organizationId,
          entityType: "Organization",
          entityId: organizationId,
          metadata: {
            organizationName: organization.name,
            organizationSlug: organization.slug,
            hardDelete: true,
          },
        },
        tx,
      );

      await deleteOrganizationGraph(tx, organizationId);
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

    if (process.env.NODE_ENV === "production") {
      throw new AdminValidationError("Bu işlem production ortamında devre dışıdır.");
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

    await prisma.$transaction(async (tx) => {
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

      await writeAdminAuditLog(
        {
          action: "admin.product_access.enabled",
          actor,
          organizationId,
          entityType: "AppInstallation",
          entityId: installation.id,
          metadata: { productKey: product.key, licenseId: license?.id ?? null },
        },
        tx,
      );
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

    await prisma.$transaction(async (tx) => {
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

      await writeAdminAuditLog(
        {
          action: "admin.product_access.status_changed",
          actor,
          organizationId,
          entityType: "AppInstallation",
          entityId: installation.id,
          metadata: { productKey: product.key, before: { status: before?.status ?? null }, after: { status: installation.status } },
        },
        tx,
      );
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
    await assertOrganization(organizationId);
    const product = await getWexPayProduct();
    await assertWexPayPlan(payload.planId, product.id);

    await prisma.$transaction(async (tx) => {
      const license = await tx.license.create({
        data: {
          organizationId,
          productId: product.id,
          planId: payload.planId,
          licenseType: payload.licenseType,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          status: payload.status,
        },
      });

      await tx.appInstallation.upsert({
        where: { organizationId_productId: { organizationId, productId: product.id } },
        update: { status: "ACTIVE", licenseId: license.id },
        create: {
          organizationId,
          productId: product.id,
          licenseId: license.id,
          status: "ACTIVE",
        },
      });

      await writeAdminAuditLog(
        {
          action: "admin.license.created",
          actor,
          organizationId,
          entityType: "License",
          entityId: license.id,
          metadata: { productKey: payload.productKey, after: payload },
        },
        tx,
      );
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

    await prisma.$transaction(async (tx) => {
      const updated = await tx.license.update({
        where: { id: licenseId },
        data: { planId: payload.planId },
        include: { plan: true },
      });

      await writeAdminAuditLog(
        {
          action: "admin.license.plan_changed",
          actor,
          organizationId,
          entityType: "License",
          entityId: licenseId,
          metadata: { before: { planId: license.planId, planName: license.plan.name }, after: { planId: updated.planId, planName: updated.plan.name } },
        },
        tx,
      );
    });

    revalidateLicenseRoutes(organizationId);
    redirect(readReturnTo(formData, `/admin/organizations/${organizationId}`));
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, `/admin/organizations/${organizationId}`, error, "Paket değiştirilemedi.");
  }
}

export async function changeAdminLicenseStatusAction(organizationId: string, licenseId: string, formData: FormData) {
  try {
    const actor = await assertAdminAccess();
    const payload = parseLicenseStatusPayload(formData);
    const license = await assertOrganizationLicense(organizationId, licenseId);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.license.update({
        where: { id: licenseId },
        data: { status: payload.status },
      });

      await writeAdminAuditLog(
        {
          action: "admin.license.status_changed",
          actor,
          organizationId,
          entityType: "License",
          entityId: licenseId,
          metadata: { before: { status: license.status }, after: { status: updated.status } },
        },
        tx,
      );
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
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new AdminValidationError("Fatura bulunamadı.");

    await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: payload.status,
          paidAt: payload.status === "PAID" ? new Date() : invoice.paidAt,
          issuedAt: payload.status === "ISSUED" && !invoice.issuedAt ? new Date() : invoice.issuedAt,
        },
      });

      await writeAdminAuditLog(
        {
          action: "admin.invoice.status_changed",
          actor,
          organizationId: invoice.organizationId,
          entityType: "Invoice",
          entityId: invoiceId,
          metadata: { before: { status: invoice.status }, after: { status: updated.status } },
        },
        tx,
      );
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

    await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { status: payload.status, isActive: payload.status === "ACTIVE" },
      });

      await writeAdminAuditLog(
        {
          action: "admin.product.status_changed",
          actor,
          entityType: "Product",
          entityId: productId,
          metadata: { before: { status: product.status }, after: { status: updated.status } },
        },
        tx,
      );
    });

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

    await prisma.$transaction(async (tx) => {
      const updated = await tx.plan.update({
        where: { id: planId },
        data: { isActive: payload.isActive },
      });

      await writeAdminAuditLog(
        {
          action: "admin.plan.active_changed",
          actor,
          entityType: "Plan",
          entityId: planId,
          metadata: { before: { isActive: plan.isActive }, after: { isActive: updated.isActive } },
        },
        tx,
      );
    });

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
    const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription) throw new AdminValidationError("Abonelik bulunamadı.");

    const paidPaytr = await prisma.subscriptionPayment.findFirst({
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
        `Bu plan için PAID PayTR ödemesi var (merchant_oid=${paidPaytr.merchantOid}). Çift aktivasyonu önlemek için acknowledgePaytrPaid işaretleyin ve audit notu girin.`,
      );
    }

    // Clear cancelAt on explicit reactivation, stamp it now on cancellation.
    const nextCancelAt =
      payload.status === "CANCELLED"
        ? new Date()
        : payload.status === "ACTIVE" || payload.status === "TRIALING"
          ? null
          : subscription.cancelAt;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: payload.status,
          cancelAt: nextCancelAt,
        },
      });

      // Keep License + this org/product AppInstallation consistent with the
      // deliberate status change (terminal close OR reactivation), atomically in
      // this transaction. A future-dated cancellation is a no-op here.
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

      await writeAdminAuditLog(
        {
          action: "admin.subscription.status_changed",
          actor,
          organizationId: subscription.organizationId,
          entityType: "Subscription",
          entityId: subscriptionId,
          metadata: {
            before: { subscriptionStatus: subscription.status },
            after: { subscriptionStatus: updated.status, cancelAt: updated.cancelAt },
            auditNote: payload.auditNote,
            acknowledgePaytrPaid: payload.acknowledgePaytrPaid,
            paidPaytrMerchantOid: paidPaytr?.merchantOid ?? null,
            accessSync: {
              intent: accessSync.intent,
              reason: accessSync.reason,
              licenseId: accessSync.licenseId,
              license: accessSync.license,
              installation: accessSync.installation,
            },
          },
        },
        tx,
      );
    });

    revalidateCatalogRoutes();
    revalidateBillingRoutes();
    revalidateLicenseRoutes(subscription.organizationId);
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
    const apiKey = await prisma.apiKey.findUnique({ where: { id: apiKeyId } });
    if (!apiKey) throw new AdminValidationError("API anahtarı bulunamadı.");
    if (apiKey.revokedAt) throw new AdminValidationError("API anahtarı zaten iptal edilmiş.");

    await prisma.$transaction(async (tx) => {
      await tx.apiKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } });
      await writeAdminAuditLog(
        {
          action: "admin.api_key.revoked",
          actor,
          organizationId: apiKey.organizationId,
          entityType: "ApiKey",
          entityId: apiKeyId,
          metadata: { prefix: apiKey.prefix, name: apiKey.name },
        },
        tx,
      );
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
    const webhook = await prisma.webhookEndpoint.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new AdminValidationError("Webhook bulunamadı.");

    await prisma.$transaction(async (tx) => {
      const updated = await tx.webhookEndpoint.update({
        where: { id: webhookId },
        data: { isActive: payload.isActive },
      });

      await writeAdminAuditLog(
        {
          action: "admin.webhook.active_changed",
          actor,
          organizationId: webhook.organizationId,
          entityType: "WebhookEndpoint",
          entityId: webhookId,
          metadata: { before: { isActive: webhook.isActive }, after: { isActive: updated.isActive } },
        },
        tx,
      );
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

    await prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: { ...payload, organizationId },
      });

      await writeAdminAuditLog(
        {
          action: "admin.restaurant.created",
          actor,
          organizationId,
          entityType: "Restaurant",
          entityId: restaurant.id,
          metadata: { after: payload },
        },
        tx,
      );
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

    await prisma.$transaction(async (tx) => {
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

      await writeAdminAuditLog(
        {
          action: "admin.membership.added",
          actor,
          organizationId,
          entityType: "Membership",
          entityId: membership.id,
          metadata: {
            userId: user.id,
            email: user.email,
            role: membership.role,
            emailInvitationSent: false,
            passwordSet: Boolean(payload.temporaryPassword),
            mustChangePassword: payload.mustChangePassword,
          },
        },
        tx,
      );
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
    await runWithTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        const membership = await tx.membership.findFirst({ where: { id: membershipId, organizationId }, include: { user: true } });
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
        await writeAdminAuditLog(
          {
            action: "admin.membership.role_updated",
            actor,
            organizationId,
            entityType: "Membership",
            entityId: membershipId,
            metadata: { email: membership.user.email, before: { role: membership.role }, after: { role: updated.role } },
          },
          tx,
        );
      }),
    );
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
    await runWithTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        const membership = await tx.membership.findFirst({ where: { id: membershipId, organizationId }, include: { user: true } });
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
        await writeAdminAuditLog(
          {
            action: "admin.membership.status_updated",
            actor,
            organizationId,
            entityType: "Membership",
            entityId: membershipId,
            metadata: { email: membership.user.email, before: { status: membership.status }, after: { status: updated.status } },
          },
          tx,
        );
      }),
    );
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
    await runWithTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        // Lock User first (before any org locks elsewhere) so races with
        // toggleAdminUserActiveAction serialize consistently.
        const locked = await lockUserForUpdate(tx, userId);
        if (!locked) throw new AdminValidationError("Kullanıcı bulunamadı.");

        await tx.user.update({
          where: { id: userId },
          data: { passwordHash, passwordSetAt: new Date(), mustChangePassword: payload.mustChangePassword, isActive: true },
        });
        await writeAdminAuditLog(
          {
            action: "admin.user.password_reset",
            actor,
            entityType: "User",
            entityId: userId,
            metadata: {
              email: locked.email,
              mustChangePassword: payload.mustChangePassword,
              before: { isActive: locked.isActive },
              after: { isActive: true },
            },
          },
          tx,
        );
      }),
    );
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
    await runWithTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        // 1) Lock User FOR UPDATE  2) read fresh state  3) compute nextActive
        // 4) owner guard (locks orgs)  5) update + audit — all in one transaction.
        // Never use a pre-transaction User snapshot for nextActive / audit.
        const locked = await lockUserForUpdate(tx, userId);
        if (!locked) throw new AdminValidationError("Kullanıcı bulunamadı.");

        const nextActive = resolveNextActiveFromLockedUser(locked);

        // Reactivation (false → true) must never be blocked by the owner guard.
        if (!nextActive) {
          await assertUserDeactivationPreservesActiveOwners(tx, userId);
        }

        await tx.user.update({ where: { id: userId }, data: { isActive: nextActive } });
        await writeAdminAuditLog(
          {
            action: nextActive ? "admin.user.reactivated" : "admin.user.deactivated",
            actor,
            entityType: "User",
            entityId: userId,
            metadata: {
              email: locked.email,
              before: { isActive: locked.isActive },
              after: { isActive: nextActive },
            },
          },
          tx,
        );
      }),
    );
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
    await assertOrganization(payload.organizationId);
    await prisma.$transaction(async (tx) => {
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
          issuedAt: payload.status === "ISSUED" || payload.status === "PAID" ? new Date() : null,
          dueAt: payload.dueAt,
          paidAt: payload.status === "PAID" ? new Date() : null,
        },
      });
      await writeAdminAuditLog(
        {
          action: "admin.invoice.created",
          actor,
          organizationId: payload.organizationId,
          entityType: "Invoice",
          entityId: invoice.id,
          metadata: { invoiceNo: invoice.invoiceNo, total: String(invoice.total), status: invoice.status },
        },
        tx,
      );
    });
    revalidateBillingRoutes();
    revalidateOrganizationRoutes(payload.organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    if (isUniqueConflict(error)) redirectWithError(formData, returnTo, new Error("Bu fatura numarası zaten kullanılıyor."));
    redirectWithError(formData, returnTo, error, "Fatura oluşturulamadı.");
  }
}

export async function createAdminBillingPaymentAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/billing");
  try {
    const actor = await assertAdminAccess();
    const payload = parseBillingPaymentCreatePayload(formData);
    await assertOrganization(payload.organizationId);
    await prisma.$transaction(async (tx) => {
      const payment = await tx.billingPayment.create({
        data: {
          organizationId: payload.organizationId,
          invoiceId: payload.invoiceId,
          subscriptionId: payload.subscriptionId,
          amount: payload.amount,
          currency: payload.currency,
          status: payload.status,
          provider: payload.provider,
          providerRef: payload.providerRef,
          paidAt: payload.status === "PAID" ? new Date() : null,
        },
      });
      if (payload.invoiceId && payload.status === "PAID") {
        await tx.invoice.update({
          where: { id: payload.invoiceId },
          data: { status: "PAID", paidAt: new Date() },
        });
      }
      await writeAdminAuditLog(
        {
          action: "admin.payment.created",
          actor,
          organizationId: payload.organizationId,
          entityType: "BillingPayment",
          entityId: payment.id,
          metadata: { amount: String(payment.amount), status: payment.status, invoiceId: payment.invoiceId },
        },
        tx,
      );
    });
    revalidateBillingRoutes();
    revalidateOrganizationRoutes(payload.organizationId);
    redirect(returnTo);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(formData, returnTo, error, "Tahsilat kaydedilemedi.");
  }
}

export async function createAdminProductAction(formData: FormData) {
  const returnTo = readReturnTo(formData, "/admin/products");
  try {
    const actor = await assertAdminAccess();
    const payload = parseProductCreatePayload(formData);
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          key: payload.key,
          name: payload.name,
          description: payload.description,
          status: payload.status,
          isActive: payload.status === "ACTIVE",
        },
      });
      await writeAdminAuditLog(
        { action: "admin.product.created", actor, entityType: "Product", entityId: product.id, metadata: { key: product.key, name: product.name } },
        tx,
      );
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
    await prisma.$transaction(async (tx) => {
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
      await writeAdminAuditLog(
        {
          action: "admin.product.updated",
          actor,
          entityType: "Product",
          entityId: productId,
          metadata: { before: { name: before.name, status: before.status }, after: { name: updated.name, status: updated.status } },
        },
        tx,
      );
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
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: payload.productId } });
      if (!product) throw new AdminValidationError("Ürün bulunamadı.");
      const plan = await tx.plan.create({ data: payload });
      await writeAdminAuditLog(
        { action: "admin.plan.created", actor, entityType: "Plan", entityId: plan.id, metadata: { key: plan.key, name: plan.name, productId: plan.productId } },
        tx,
      );
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
    await prisma.$transaction(async (tx) => {
      const before = await tx.plan.findUnique({ where: { id: planId } });
      if (!before) throw new AdminValidationError("Paket bulunamadı.");
      const updated = await tx.plan.update({ where: { id: planId }, data: payload });
      await writeAdminAuditLog(
        {
          action: "admin.plan.updated",
          actor,
          entityType: "Plan",
          entityId: planId,
          metadata: { before: { name: before.name, isActive: before.isActive }, after: { name: updated.name, isActive: updated.isActive } },
        },
        tx,
      );
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
    await prisma.$transaction(async (tx) => {
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
      await writeAdminAuditLog(
        {
          action: entitlementId ? "admin.entitlement.updated" : "admin.entitlement.created",
          actor,
          entityType: "Entitlement",
          entityId: entitlement.id,
          metadata: { planId, key: entitlement.key, valueType: entitlement.valueType },
        },
        tx,
      );
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
    await setEntitlementActiveState({ actor, planId, entitlementId, isActive, note });
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
    await assertOrganization(payload.organizationId);
    const plan = await prisma.plan.findUnique({ where: { id: payload.planId }, include: { product: true } });
    if (!plan) throw new AdminValidationError("Paket bulunamadı.");

    await prisma.$transaction(async (tx) => {
      let license = await tx.license.findFirst({
        where: { organizationId: payload.organizationId, productId: plan.productId, status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] } },
      });
      const periodEnd = payload.currentPeriodEnd ?? (payload.interval === "ONE_TIME" ? null : addPeriod(payload.currentPeriodStart, payload.interval === "YEARLY" ? "YEARLY" : "MONTHLY"));
      if (!license) {
        license = await tx.license.create({
          data: {
            organizationId: payload.organizationId,
            productId: plan.productId,
            planId: plan.id,
            status: payload.status === "TRIALING" ? "TRIAL" : "ACTIVE",
            licenseType: payload.interval === "YEARLY" ? "YEARLY" : payload.interval === "ONE_TIME" ? "ONE_TIME" : "MONTHLY",
            startsAt: payload.currentPeriodStart,
            endsAt: periodEnd,
          },
        });
      }
      const existingSubscription = await tx.subscription.findUnique({ where: { licenseId: license.id } });
      if (existingSubscription) throw new AdminValidationError("Bu lisans için zaten abonelik var.");

      const subscription = await tx.subscription.create({
        data: {
          organizationId: payload.organizationId,
          licenseId: license.id,
          planId: plan.id,
          status: payload.status,
          interval: payload.interval,
          currentPeriodStart: payload.currentPeriodStart,
          currentPeriodEnd: periodEnd,
          provider: payload.provider,
          providerRef: payload.providerRef,
        },
      });

      await tx.appInstallation.upsert({
        where: { organizationId_productId: { organizationId: payload.organizationId, productId: plan.productId } },
        update: { status: "ACTIVE", licenseId: license.id },
        create: { organizationId: payload.organizationId, productId: plan.productId, licenseId: license.id, status: "ACTIVE" },
      });

      await writeAdminAuditLog(
        {
          action: "admin.subscription.created",
          actor,
          organizationId: payload.organizationId,
          entityType: "Subscription",
          entityId: subscription.id,
          metadata: { planId: plan.id, licenseId: license.id, status: subscription.status },
        },
        tx,
      );
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
    await prisma.$transaction(async (tx) => {
      const license = await tx.license.findFirst({ where: { id: licenseId, organizationId } });
      if (!license) throw new AdminValidationError("Lisans bulunamadı.");
      const updated = await tx.license.update({
        where: { id: licenseId },
        data: {
          licenseType: payload.licenseType,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          status: payload.status,
        },
      });
      await writeAdminAuditLog(
        {
          action: "admin.license.updated",
          actor,
          organizationId,
          entityType: "License",
          entityId: licenseId,
          metadata: {
            before: { licenseType: license.licenseType, startsAt: license.startsAt, endsAt: license.endsAt, status: license.status },
            after: { licenseType: updated.licenseType, startsAt: updated.startsAt, endsAt: updated.endsAt, status: updated.status },
          },
        },
        tx,
      );
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
    await assertOrganization(payload.organizationId);
    const rawKey = `wex_${randomBytes(24).toString("base64url")}`;
    const prefix = rawKey.slice(0, 12);

    await prisma.$transaction(async (tx) => {
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
      await writeAdminAuditLog(
        {
          action: "admin.api_key.created",
          actor,
          organizationId: payload.organizationId,
          entityType: "ApiKey",
          entityId: apiKey.id,
          metadata: { name: apiKey.name, prefix: apiKey.prefix },
        },
        tx,
      );
    });

    await setAdminApiKeyFlashCookie({ name: payload.name, prefix, rawKey });
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
    await assertOrganization(payload.organizationId);
    await prisma.$transaction(async (tx) => {
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
      await writeAdminAuditLog(
        {
          action: "admin.webhook.created",
          actor,
          organizationId: payload.organizationId,
          entityType: "WebhookEndpoint",
          entityId: webhook.id,
          metadata: { url: webhook.url, events: webhook.events },
        },
        tx,
      );
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
    const ticket = await prisma.auditLog.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.action !== "customer.support_ticket.created") {
      throw new AdminValidationError("Destek talebi bulunamadı.");
    }
    const currentMeta = typeof ticket.metadataJson === "object" && ticket.metadataJson !== null ? (ticket.metadataJson as Record<string, unknown>) : {};
    const nextMeta = {
      ...currentMeta,
      status: payload.status,
      adminReply: payload.adminReply ?? (typeof currentMeta.adminReply === "string" ? currentMeta.adminReply : null),
      adminRepliedAt: payload.adminReply ? new Date().toISOString() : currentMeta.adminRepliedAt ?? null,
      adminActor: actor.email,
    };
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.update({ where: { id: ticketId }, data: { metadataJson: nextMeta } });
      await writeAdminAuditLog(
        {
          action: "admin.support_ticket.updated",
          actor,
          organizationId: ticket.organizationId,
          entityType: "SupportTicket",
          entityId: ticketId,
          metadata: { status: payload.status, hasReply: Boolean(payload.adminReply) },
        },
        tx,
      );
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
    await prisma.$transaction(async (tx) => {
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
      await writeAdminAuditLog(
        {
          action: "admin.installation.settings_updated",
          actor,
          organizationId,
          entityType: "AppInstallation",
          entityId: installationId,
          metadata: settingsJson,
        },
        tx,
      );
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
    const demoRequest = await prisma.auditLog.findUnique({ where: { id: demoRequestId } });
    if (!demoRequest || demoRequest.action !== "public.demo_request.created") {
      throw new AdminValidationError("Demo talebi bulunamadı.");
    }

    const statusUpdates = await prisma.auditLog.findMany({
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
      await writeAuditLog({
        action: "public.demo_request.status_updated",
        entityType: "DemoRequest",
        entityId: demoRequestId,
        source: "admin_demo_request_management",
        message: `Lead durumu ${previousStatus} → ${nextStatus}`,
        metadata: {
          originalDemoRequestId: demoRequestId,
          previousStatus,
          nextStatus,
          actor: getAdminActionActor(actor),
        },
      });
    }

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
    const demoRequest = await prisma.auditLog.findUnique({ where: { id: demoRequestId } });
    if (!demoRequest || demoRequest.action !== "public.demo_request.created") {
      throw new AdminValidationError("Demo talebi bulunamadı.");
    }

    await writeAuditLog({
      action: "public.demo_request.followup_updated",
      entityType: "DemoRequest",
      entityId: demoRequestId,
      source: "admin_demo_request_management",
      message: payload.note ? "Lead takip notu güncellendi" : "Lead takip tarihi güncellendi",
      metadata: {
        originalDemoRequestId: demoRequestId,
        note: payload.note,
        followUpAt: payload.followUpAt,
        actor: getAdminActionActor(actor),
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
