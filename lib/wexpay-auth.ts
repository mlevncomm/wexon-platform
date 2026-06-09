import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/wexon-admin-auth";
import { assertCustomerDashboardAccess, getCustomerSession } from "@/lib/wexon-customer-auth";
import type { DashboardOrganizationSelector } from "@/lib/wexon-core-dashboard";
import { findSelectedOrganization } from "@/lib/wexon-core-dashboard";
import { requireProductAccess } from "@/lib/wexon-core-access";
import { resolvePlatformOrganizationSelector } from "@/lib/wexon-organization-context";
import { prisma } from "@/lib/prisma";

export function canAccessWexPay(role: string) {
  return ["OWNER", "ADMIN", "MANAGER", "STAFF", "VIEWER"].includes(role);
}

export function canManageWexPay(role: string) {
  return ["OWNER", "ADMIN", "MANAGER"].includes(role);
}

const organizationTreeInclude = {
  restaurants: {
    include: {
      branches: {
        include: {
          tables: true,
          products: true,
          categories: { include: { products: true } },
          orders: true,
          payments: true,
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
  const tables = branches.flatMap((branch) => branch.tables);
  const menuProducts = branches.flatMap((branch) => branch.categories.flatMap((category) => category.products));
  const orders = branches.flatMap((branch) => branch.orders);
  const payments = branches.flatMap((branch) => branch.payments);
  const canManage =
    input.mode === "admin_preview" ? true : input.membership ? canManageWexPay(input.membership.role) : false;

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
    tables,
    menuProducts,
    orders,
    payments,
    canManage,
  };
}

export async function getWexPayAccess(explicitSelector?: DashboardOrganizationSelector) {
  const selector = await resolvePlatformOrganizationSelector(explicitSelector);
  const customerSession = await getCustomerSession();

  if (customerSession) {
    const access = await assertCustomerDashboardAccess(selector);
    if (!access.organizationId || !access.user) {
      redirect("/dashboard/login");
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
      const params = new URLSearchParams({
        customerError: "WexPay önizlemesi için müşteri seçin veya organizationId parametresi kullanın.",
      });
      redirect(`/dashboard/login?${params.toString()}`);
    }

    const selected = await findSelectedOrganization(selector);
    if (!selected.organization) {
      redirect("/unauthorized");
    }

    return buildAllowedWexPayAccess({
      organizationId: selected.organization.id,
      mode: "admin_preview",
      user: null,
      membership: null,
    });
  }

  const nextParams = new URLSearchParams();
  if (selector?.organizationId) nextParams.set("organizationId", selector.organizationId);
  if (selector?.organizationSlug) nextParams.set("organizationSlug", selector.organizationSlug);
  const nextPath = nextParams.toString() ? `/apps/wexpay?${nextParams.toString()}` : "/apps/wexpay";
  redirect(`/dashboard/login?next=${encodeURIComponent(nextPath)}`);
}

export async function assertWexPayAccess(explicitSelector?: DashboardOrganizationSelector) {
  return getWexPayAccess(explicitSelector);
}
