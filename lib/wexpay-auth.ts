import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAdminSession } from "@/lib/wexon-admin-auth";
import {
  adminPreviewHasValidWriteCapability,
  isAdminPreviewHostAllowed,
} from "@/lib/wexon-admin-preview-write";
import { wexpayAdminPreviewHref } from "@/lib/wexon-admin-preview-path";
import { assertCustomerDashboardAccess, getCustomerSession } from "@/lib/wexon-customer-auth";
import type { DashboardOrganizationSelector } from "@/lib/wexon-core-dashboard";
import { findSelectedOrganization } from "@/lib/wexon-core-dashboard";
import { requireProductAccess } from "@/lib/wexon-core-access";
import { resolvePlatformOrganizationSelector } from "@/lib/wexon-organization-context";
import { isWexonProductionDeployment } from "@/lib/wexon-canonical-host";
import { prisma } from "@/lib/prisma";
import { customerLoginUrl } from "@/lib/wexon/urls";

export function canAccessWexPay(role: string) {
  return ["OWNER", "ADMIN", "MANAGER", "STAFF", "VIEWER"].includes(role);
}

export function canManageWexPay(role: string) {
  return ["OWNER", "ADMIN", "MANAGER"].includes(role);
}

/** Kitchen status transitions — STAFF included for floor operations. */
export function canOperateKitchenWexPay(role: string) {
  return ["OWNER", "ADMIN", "MANAGER", "STAFF"].includes(role);
}

/** Cashier / payment mutations — STAFF included for limited kasa ops. */
export function canOperateCashierWexPay(role: string) {
  return ["OWNER", "ADMIN", "MANAGER", "STAFF"].includes(role);
}

/** Provider credentials + sensitive settings — OWNER/ADMIN only. */
export function canConfigureWexPaySettings(role: string) {
  return ["OWNER", "ADMIN"].includes(role);
}

const organizationTreeInclude = {
  restaurants: {
    include: {
      branches: {
        select: {
          id: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

async function loadOrganizationTree(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: organizationTreeInclude,
  });
}

type WexPayAccessMode = "customer" | "admin_preview";

async function buildAllowedWexPayAccess(input: {
  organizationId: string;
  mode: WexPayAccessMode;
  user: { id: string; email: string } | null;
  membership: { role: string } | null;
  adminWriteAllowed?: boolean;
}) {
  const coreDecision = await requireProductAccess({
    organizationId: input.organizationId,
    productKey: "wexpay",
  });

  if (!coreDecision.ok) {
    return {
      allowed: false as const,
      reason: coreDecision.reason,
      mode: input.mode,
      access: { user: input.user, organizationId: input.organizationId },
      membership: input.membership,
      organization: coreDecision.access.organization,
      license: coreDecision.access.license,
      installation: coreDecision.access.installation,
      coreAccess: coreDecision.access,
    };
  }

  if (input.mode === "customer" && coreDecision.organization?.isDemo) {
    return {
      allowed: false as const,
      reason: "demo_tenant" as const,
      mode: input.mode,
      access: { user: input.user, organizationId: input.organizationId },
      membership: input.membership,
      organization: coreDecision.organization,
      license: coreDecision.license,
      installation: coreDecision.installation,
      coreAccess: coreDecision,
    };
  }

  const organization = await loadOrganizationTree(input.organizationId);
  if (!organization || !organization.isActive) {
    return {
      allowed: false as const,
      reason: "organization" as const,
      mode: input.mode,
      access: { user: input.user, organizationId: input.organizationId },
      membership: input.membership,
      organization,
    };
  }

  const branches = organization.restaurants.flatMap((restaurant) => restaurant.branches);
  const role = input.mode === "admin_preview" ? "ADMIN" : input.membership?.role ?? "VIEWER";

  let canManage = false;
  let canOperateKitchen = false;
  let canOperateCashier = false;
  let canConfigureSettings = false;

  if (input.mode === "admin_preview") {
    // Admin preview: canAccess=true (allowed), manage flags only with write capability.
    // Demo org never gets write flags.
    const writeAllowed =
      !organization.isDemo &&
      Boolean(input.adminWriteAllowed);
    canManage = writeAllowed;
    canOperateKitchen = writeAllowed;
    canOperateCashier = writeAllowed;
    canConfigureSettings = writeAllowed;
  } else if (input.membership) {
    canManage = canManageWexPay(input.membership.role);
    canOperateKitchen = canOperateKitchenWexPay(role);
    canOperateCashier = canOperateCashierWexPay(role);
    canConfigureSettings = canConfigureWexPaySettings(role);
  }

  return {
    allowed: true as const,
    mode: input.mode,
    access: { user: input.user, organizationId: input.organizationId },
    membership: input.membership,
    organization,
    license: coreDecision.license,
    installation: coreDecision.installation,
    subscription: coreDecision.subscription,
    billingState: coreDecision.billingState,
    entitlementMap: coreDecision.entitlementMap,
    coreAccess: coreDecision,
    branches,
    canAccess: true as const,
    canManage,
    canOperateKitchen,
    canOperateCashier,
    canConfigureSettings,
  };
}

export async function getWexPayAccess(explicitSelector?: DashboardOrganizationSelector) {
  const selector = await resolvePlatformOrganizationSelector(explicitSelector);
  const customerSession = await getCustomerSession();

  if (customerSession) {
    const access = await assertCustomerDashboardAccess(selector);
    if (!access.organizationId || !access.user) {
      redirect(customerLoginUrl());
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: access.user.id, organizationId: access.organizationId, status: "ACTIVE" },
    });

    if (!membership || !canAccessWexPay(membership.role)) {
      return {
        allowed: false as const,
        reason: "role" as const,
        mode: "customer" as const,
        access,
        membership,
        organization: null,
      };
    }

    return buildAllowedWexPayAccess({
      organizationId: access.organizationId,
      mode: "customer",
      user: access.user,
      membership,
    });
  }

  const adminSession = await getAdminSession();
  if (adminSession) {
    if (!selector?.organizationId?.trim() && !selector?.organizationSlug?.trim()) {
      redirect(
        customerLoginUrl({
          customerError: "WexPay önizlemesi için müşteri seçin veya organizationId parametresi kullanın.",
        }),
      );
    }

    const selected = await findSelectedOrganization(selector);
    if (!selected.organization) {
      redirect("/unauthorized");
    }

    // getWexPayAccess is the /apps/wexpay gate. Admin preview belongs on the
    // admin host only — redirect when possible; otherwise deny (no write).
    const headerStore = await headers();
    const host = headerStore.get("host") ?? headerStore.get("x-forwarded-host");
    const productionWexon = isWexonProductionDeployment();
    const onAdminHost = isAdminPreviewHostAllowed(host, productionWexon);

    if (onAdminHost) {
      redirect(wexpayAdminPreviewHref(selected.organization.id));
    }

    // Cross-host legacy (app/core): admin session must not open manage on these hosts.
    return {
      allowed: false as const,
      reason: "role" as const,
      mode: "admin_preview" as const,
      access: { user: null, organizationId: selected.organization.id },
      membership: null,
      organization: selected.organization,
    };
  }

  const nextParams = new URLSearchParams();
  if (selector?.organizationId) nextParams.set("organizationId", selector.organizationId);
  if (selector?.organizationSlug) nextParams.set("organizationSlug", selector.organizationSlug);
  const nextPath = nextParams.toString() ? `/apps/wexpay?${nextParams.toString()}` : "/apps/wexpay";
  redirect(customerLoginUrl({ next: nextPath }));
}

/**
 * Admin-host preview access for `/admin/organizations/:id/wexpay-preview`.
 * Defaults to read-only; write flags require a valid short-lived capability.
 */
export async function getWexPayAdminPreviewAccess(organizationId: string) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return {
      allowed: false as const,
      reason: "role" as const,
      mode: "admin_preview" as const,
      access: { user: null, organizationId },
      membership: null,
      organization: null,
    };
  }

  const headerStore = await headers();
  const host = headerStore.get("host") ?? headerStore.get("x-forwarded-host");
  if (!isAdminPreviewHostAllowed(host, isWexonProductionDeployment())) {
    return {
      allowed: false as const,
      reason: "role" as const,
      mode: "admin_preview" as const,
      access: { user: null, organizationId },
      membership: null,
      organization: null,
    };
  }

  const writeAllowed = await adminPreviewHasValidWriteCapability({
    organizationId,
    adminId: adminSession.adminId,
    cloudflareSubject: adminSession.cloudflareSubject,
  });

  return buildAllowedWexPayAccess({
    organizationId,
    mode: "admin_preview",
    user: null,
    membership: null,
    adminWriteAllowed: writeAllowed,
  });
}

export async function assertWexPayAccess(explicitSelector?: DashboardOrganizationSelector) {
  return getWexPayAccess(explicitSelector);
}
