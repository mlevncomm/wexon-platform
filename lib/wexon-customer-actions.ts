"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { assertCustomerOrganizationRole, assertCustomerSession } from "@/lib/wexon-customer-auth";
import { hashApiKey } from "@/lib/wexon-api-key-hash";
import {
  CustomerValidationError,
  parseCustomerApiKeyPayload,
  parseCustomerAddMembershipPayload,
  parseCustomerMembershipRolePayload,
  parseCustomerMembershipStatusPayload,
  parseCustomerOrganizationPayload,
  parseCustomerRecordPayload,
  parseCustomerSupportTicketPayload,
  parseCustomerWebhookPayload,
} from "@/lib/wexon-customer-validation";
import { hashPassword, verifyPassword } from "@/lib/wexon-passwords";
import { assertStaffEntitlementLimit, evaluateProductAccess } from "@/lib/wexon-core-access";
import { prisma } from "@/lib/prisma";
import { customerLoginUrl } from "@/lib/wexon/urls";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectChangePasswordError(message: string): never {
  const params = new URLSearchParams({ customerError: message });
  redirect(`/dashboard/change-password?${params.toString()}`);
}

function redirectOrganizationError(organizationId: string | null, message: string): never {
  const params = new URLSearchParams({ customerError: message });
  if (organizationId) {
    params.set("organizationId", organizationId);
  }
  redirect(`/dashboard/organization?${params.toString()}`);
}

function redirectUsersError(organizationId: string | null, message: string): never {
  const params = new URLSearchParams({ customerError: message });
  if (organizationId) {
    params.set("organizationId", organizationId);
  }
  redirect(`/dashboard/users?${params.toString()}`);
}

function redirectSupportError(organizationId: string | null, message: string): never {
  const params = new URLSearchParams({ customerError: message });
  if (organizationId) params.set("organizationId", organizationId);
  redirect(`/dashboard/support?${params.toString()}`);
}

function redirectIntegrationsError(organizationId: string | null, message: string): never {
  const params = new URLSearchParams({ customerError: message });
  if (organizationId) params.set("organizationId", organizationId);
  redirect(`/dashboard/integrations?${params.toString()}`);
}

function revalidateCustomerUsers(organizationId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/users");
  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${organizationId}`);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function setApiKeyFlashCookie(value: { name: string; prefix: string; rawKey: string }) {
  const cookieStore = await cookies();
  cookieStore.set("wexon_api_key_flash", Buffer.from(JSON.stringify(value), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard/integrations",
    maxAge: 5 * 60,
  });
}

export async function changeCustomerPasswordAction(formData: FormData) {
  const session = await assertCustomerSession();
  const currentPassword = readString(formData, "currentPassword");
  const newPassword = readString(formData, "newPassword");
  const newPasswordConfirm = readString(formData, "newPasswordConfirm");

  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    redirectChangePasswordError("Tüm şifre alanları zorunludur.");
  }

  if (newPassword.length < 8) {
    redirectChangePasswordError("Yeni şifre en az 8 karakter olmalıdır.");
  }

  if (newPassword !== newPasswordConfirm) {
    redirectChangePasswordError("Yeni şifre ve tekrarı eşleşmiyor.");
  }

  if (currentPassword === newPassword) {
    redirectChangePasswordError("Yeni şifre mevcut şifreyle aynı olamaz.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user || !user.isActive) {
    redirect(customerLoginUrl());
  }

  if (!user.passwordHash) {
    redirectChangePasswordError("Şifre değiştirmek için önce geçerli bir şifre tanımlı olmalıdır.");
  }

  const currentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentPasswordValid) {
    redirectChangePasswordError("Mevcut şifre hatalı.");
  }

  const nextPasswordHash = await hashPassword(newPassword);
  const organizationId = user.memberships[0]?.organizationId ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: nextPasswordHash,
        passwordSetAt: new Date(),
        mustChangePassword: false,
        lastLoginAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        userId: user.id,
        action: "customer.password.changed",
        entityType: "User",
        entityId: user.id,
        metadataJson: {
          actor: {
            type: "customer_session",
            userId: user.id,
            email: user.email,
          },
          source: "customer_password_change",
          mustChangePasswordCleared: true,
        },
      },
    });
  });

  redirect("/dashboard");
}

export async function updateCustomerOrganizationAction(formData: FormData) {
  let organizationId: string | null = null;

  try {
    const payload = parseCustomerOrganizationPayload(formData);
    organizationId = payload.organizationId;
    const { user, membership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);

    await prisma.$transaction(async (tx) => {
      const before = await tx.organization.findUnique({
        where: { id: payload.organizationId },
      });

      if (!before) {
        throw new CustomerValidationError("Organizasyon bulunamadı.");
      }

      const updated = await tx.organization.update({
        where: { id: payload.organizationId },
        data: {
          name: payload.name,
          legalName: payload.legalName,
          taxNo: payload.taxNo,
          email: payload.email,
          phone: payload.phone,
          country: payload.country,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: user.id,
          action: "customer.organization.updated",
          entityType: "Organization",
          entityId: payload.organizationId,
          metadataJson: {
            actor: {
              type: "customer_session",
              userId: user.id,
              email: user.email,
              role: membership.role,
            },
            source: "dashboard_organization_self_service",
            before: {
              name: before.name,
              legalName: before.legalName,
              taxNo: before.taxNo,
              email: before.email,
              phone: before.phone,
              country: before.country,
            },
            after: {
              name: updated.name,
              legalName: updated.legalName,
              taxNo: updated.taxNo,
              email: updated.email,
              phone: updated.phone,
              country: updated.country,
            },
          },
        },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/organization");
    revalidatePath("/admin/organizations");
    revalidatePath(`/admin/organizations/${payload.organizationId}`);
    redirect(`/dashboard/organization?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) {
      redirectOrganizationError(organizationId, error.message);
    }
    throw error;
  }
}

export async function addCustomerOrganizationUserAction(formData: FormData) {
  let organizationId: string | null = null;

  try {
    const payload = parseCustomerAddMembershipPayload(formData);
    organizationId = payload.organizationId;
    const { user: actor, membership: actorMembership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);
    const passwordHash = await hashPassword(payload.temporaryPassword);
    const wexpayAccess = await evaluateProductAccess({ organizationId: payload.organizationId, productKey: "wexpay" });

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: payload.email },
        update: {
          name: payload.name ?? undefined,
          isActive: true,
          passwordHash,
          passwordSetAt: new Date(),
          mustChangePassword: payload.mustChangePassword,
        },
        create: {
          email: payload.email,
          name: payload.name,
          isActive: true,
          passwordHash,
          passwordSetAt: new Date(),
          mustChangePassword: payload.mustChangePassword,
        },
      });

      const existingMembership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: payload.organizationId, userId: user.id } },
      });

      if (!existingMembership || existingMembership.status !== "ACTIVE") {
        const activeStaffCount = await tx.membership.count({
          where: { organizationId: payload.organizationId, status: "ACTIVE" },
        });
        const limitCheck = assertStaffEntitlementLimit(wexpayAccess, activeStaffCount);
        if (!limitCheck.ok) {
          throw new CustomerValidationError(limitCheck.message);
        }
      }

      const membership = await tx.membership.upsert({
        where: { organizationId_userId: { organizationId: payload.organizationId, userId: user.id } },
        update: { role: payload.role, status: "ACTIVE" },
        create: { organizationId: payload.organizationId, userId: user.id, role: payload.role, status: "ACTIVE", acceptedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: actor.id,
          action: "customer.membership.added",
          entityType: "Membership",
          entityId: membership.id,
          metadataJson: {
            actor: { type: "customer_session", userId: actor.id, email: actor.email, role: actorMembership.role },
            source: "dashboard_user_management",
            targetUserId: user.id,
            targetEmail: user.email,
            role: membership.role,
            passwordSet: true,
            mustChangePassword: payload.mustChangePassword,
          },
        },
      });
    });

    revalidateCustomerUsers(payload.organizationId);
    redirect(`/dashboard/users?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) {
      redirectUsersError(organizationId, error.message);
    }
    throw error;
  }
}

export async function updateCustomerMembershipRoleAction(formData: FormData) {
  let organizationId: string | null = null;

  try {
    const payload = parseCustomerMembershipRolePayload(formData);
    organizationId = payload.organizationId;
    const { user: actor, membership: actorMembership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);

    await prisma.$transaction(async (tx) => {
      const target = await tx.membership.findFirst({
        where: { id: payload.membershipId, organizationId: payload.organizationId },
        include: { user: true },
      });

      if (!target) throw new CustomerValidationError("Üyelik bulunamadı.");

      if (target.role === "OWNER" && payload.role !== "OWNER") {
        const ownerCount = await tx.membership.count({ where: { organizationId: payload.organizationId, role: "OWNER", status: "ACTIVE" } });
        if (ownerCount <= 1 || target.userId === actor.id) {
          throw new CustomerValidationError("Son sahip rolü düşürülemez.");
        }
      }

      const updated = await tx.membership.update({
        where: { id: target.id },
        data: { role: payload.role },
      });

      await tx.auditLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: actor.id,
          action: "customer.membership.role_updated",
          entityType: "Membership",
          entityId: target.id,
          metadataJson: {
            actor: { type: "customer_session", userId: actor.id, email: actor.email, role: actorMembership.role },
            source: "dashboard_user_management",
            targetUserId: target.userId,
            targetEmail: target.user.email,
            before: { role: target.role },
            after: { role: updated.role },
          },
        },
      });
    });

    revalidateCustomerUsers(payload.organizationId);
    redirect(`/dashboard/users?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) {
      redirectUsersError(organizationId, error.message);
    }
    throw error;
  }
}

export async function deactivateCustomerMembershipAction(formData: FormData) {
  let organizationId: string | null = null;

  try {
    const payload = parseCustomerMembershipStatusPayload(formData);
    organizationId = payload.organizationId;
    const { user: actor, membership: actorMembership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);

    await prisma.$transaction(async (tx) => {
      const target = await tx.membership.findFirst({
        where: { id: payload.membershipId, organizationId: payload.organizationId },
        include: { user: true },
      });

      if (!target) throw new CustomerValidationError("Üyelik bulunamadı.");
      if (target.userId === actor.id) throw new CustomerValidationError("Kendi üyeliğinizi pasife alamazsınız.");

      if (target.role === "OWNER") {
        const ownerCount = await tx.membership.count({ where: { organizationId: payload.organizationId, role: "OWNER", status: "ACTIVE" } });
        if (ownerCount <= 1) throw new CustomerValidationError("Son sahip pasife alınamaz.");
      }

      const updated = await tx.membership.update({ where: { id: target.id }, data: { status: "SUSPENDED" } });

      await tx.auditLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: actor.id,
          action: "customer.membership.deactivated",
          entityType: "Membership",
          entityId: target.id,
          metadataJson: {
            actor: { type: "customer_session", userId: actor.id, email: actor.email, role: actorMembership.role },
            source: "dashboard_user_management",
            targetUserId: target.userId,
            targetEmail: target.user.email,
            before: { status: target.status },
            after: { status: updated.status },
          },
        },
      });
    });

    revalidateCustomerUsers(payload.organizationId);
    redirect(`/dashboard/users?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) {
      redirectUsersError(organizationId, error.message);
    }
    throw error;
  }
}

export async function reactivateCustomerMembershipAction(formData: FormData) {
  let organizationId: string | null = null;

  try {
    const payload = parseCustomerMembershipStatusPayload(formData);
    organizationId = payload.organizationId;
    const { user: actor, membership: actorMembership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);

    await prisma.$transaction(async (tx) => {
      const target = await tx.membership.findFirst({
        where: { id: payload.membershipId, organizationId: payload.organizationId },
        include: { user: true },
      });

      if (!target) throw new CustomerValidationError("Üyelik bulunamadı.");

      const updated = await tx.membership.update({ where: { id: target.id }, data: { status: "ACTIVE" } });

      await tx.auditLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: actor.id,
          action: "customer.membership.reactivated",
          entityType: "Membership",
          entityId: target.id,
          metadataJson: {
            actor: { type: "customer_session", userId: actor.id, email: actor.email, role: actorMembership.role },
            source: "dashboard_user_management",
            targetUserId: target.userId,
            targetEmail: target.user.email,
            before: { status: target.status },
            after: { status: updated.status },
          },
        },
      });
    });

    revalidateCustomerUsers(payload.organizationId);
    redirect(`/dashboard/users?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) {
      redirectUsersError(organizationId, error.message);
    }
    throw error;
  }
}

export async function createCustomerSupportTicketAction(formData: FormData) {
  let organizationId: string | null = null;
  try {
    const payload = parseCustomerSupportTicketPayload(formData);
    organizationId = payload.organizationId;
    const { user, membership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN", "MANAGER", "STAFF", "BILLING", "VIEWER"]);

    await prisma.auditLog.create({
      data: {
        organizationId: payload.organizationId,
        userId: user.id,
        action: "customer.support_ticket.created",
        entityType: "SupportTicket",
        entityId: payload.organizationId,
        metadataJson: {
          actor: { type: "customer_session", userId: user.id, email: user.email, role: membership.role },
          source: "dashboard_support",
          subject: payload.subject,
          category: payload.category,
          priority: payload.priority,
          message: payload.message,
          status: "OPEN",
        },
      },
    });

    revalidatePath("/dashboard/support");
    redirect(`/dashboard/support?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) redirectSupportError(organizationId, error.message);
    throw error;
  }
}

export async function createCustomerApiKeyAction(formData: FormData) {
  let organizationId: string | null = null;
  try {
    const payload = parseCustomerApiKeyPayload(formData);
    organizationId = payload.organizationId;
    const { user, membership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);
    const rawKey = `wex_${randomBytes(24).toString("base64url")}`;
    const prefix = rawKey.slice(0, 12);

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: payload.organizationId,
        userId: user.id,
        name: payload.name,
        prefix,
        hashedKey: hashApiKey(rawKey),
        scopes: ["wexpay:read"],
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: payload.organizationId,
        userId: user.id,
        action: "customer.api_key.created",
        entityType: "ApiKey",
        entityId: apiKey.id,
        metadataJson: {
          actor: { type: "customer_session", userId: user.id, email: user.email, role: membership.role },
          source: "dashboard_integrations",
          name: apiKey.name,
          prefix: apiKey.prefix,
        },
      },
    });

    await setApiKeyFlashCookie({ name: apiKey.name, prefix: apiKey.prefix, rawKey });
    revalidatePath("/dashboard/integrations");
    redirect(`/dashboard/integrations?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) redirectIntegrationsError(organizationId, error.message);
    throw error;
  }
}

export async function deactivateCustomerApiKeyAction(formData: FormData) {
  let organizationId: string | null = null;
  try {
    const payload = parseCustomerRecordPayload(formData, "API anahtarı");
    organizationId = payload.organizationId;
    const { user, membership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);
    const apiKey = await prisma.apiKey.findFirst({ where: { id: payload.recordId, organizationId: payload.organizationId } });
    if (!apiKey) throw new CustomerValidationError("API anahtarı bulunamadı.");

    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { revokedAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        organizationId: payload.organizationId,
        userId: user.id,
        action: "customer.api_key.deactivated",
        entityType: "ApiKey",
        entityId: apiKey.id,
        metadataJson: {
          actor: { type: "customer_session", userId: user.id, email: user.email, role: membership.role },
          source: "dashboard_integrations",
          prefix: apiKey.prefix,
        },
      },
    });

    revalidatePath("/dashboard/integrations");
    redirect(`/dashboard/integrations?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) redirectIntegrationsError(organizationId, error.message);
    throw error;
  }
}

export async function createCustomerWebhookAction(formData: FormData) {
  let organizationId: string | null = null;
  try {
    const payload = parseCustomerWebhookPayload(formData);
    organizationId = payload.organizationId;
    const { user, membership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);
    const webhook = await prisma.webhookEndpoint.create({
      data: {
        organizationId: payload.organizationId,
        url: payload.url,
        secretHash: sha256(randomBytes(32).toString("base64url")),
        events: payload.events,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: payload.organizationId,
        userId: user.id,
        action: "customer.webhook.created",
        entityType: "WebhookEndpoint",
        entityId: webhook.id,
        metadataJson: {
          actor: { type: "customer_session", userId: user.id, email: user.email, role: membership.role },
          source: "dashboard_integrations",
          url: webhook.url,
          events: webhook.events,
        },
      },
    });

    revalidatePath("/dashboard/integrations");
    redirect(`/dashboard/integrations?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) redirectIntegrationsError(organizationId, error.message);
    throw error;
  }
}

export async function deactivateCustomerWebhookAction(formData: FormData) {
  let organizationId: string | null = null;
  try {
    const payload = parseCustomerRecordPayload(formData, "Webhook");
    organizationId = payload.organizationId;
    const { user, membership } = await assertCustomerOrganizationRole(payload.organizationId, ["OWNER", "ADMIN"]);
    const webhook = await prisma.webhookEndpoint.findFirst({ where: { id: payload.recordId, organizationId: payload.organizationId } });
    if (!webhook) throw new CustomerValidationError("Webhook bulunamadı.");

    await prisma.webhookEndpoint.update({ where: { id: webhook.id }, data: { isActive: false } });
    await prisma.auditLog.create({
      data: {
        organizationId: payload.organizationId,
        userId: user.id,
        action: "customer.webhook.deactivated",
        entityType: "WebhookEndpoint",
        entityId: webhook.id,
        metadataJson: {
          actor: { type: "customer_session", userId: user.id, email: user.email, role: membership.role },
          source: "dashboard_integrations",
          url: webhook.url,
        },
      },
    });

    revalidatePath("/dashboard/integrations");
    redirect(`/dashboard/integrations?organizationId=${payload.organizationId}`);
  } catch (error) {
    if (error instanceof CustomerValidationError) redirectIntegrationsError(organizationId, error.message);
    throw error;
  }
}
