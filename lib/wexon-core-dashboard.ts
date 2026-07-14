import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/wexon-admin-auth";
import { assertCustomerDashboardAccess, getCustomerSession } from "@/lib/wexon-customer-auth";
import { evaluateProductAccess } from "@/lib/wexon-core-access";
import { coreNavigationUrl, customerLoginUrl } from "@/lib/wexon/urls";

export type EntitlementValue = boolean | number | string | null;
export type EntitlementMap = Record<string, EntitlementValue>;
export type DashboardOrganizationSelector = {
  organizationId?: string;
  organizationSlug?: string;
};

export type DashboardOrganizationContext = {
  organizationId: string | null;
  organizationSlug: string | null;
  selectedBy: "id" | "slug" | "fallback" | "missing";
  mode?: "customer" | "admin_preview" | "public_fallback";
};

export const entitlementLabels: Record<string, string> = {
  branch_limit: "Şube limiti",
  table_limit: "Masa limiti",
  product_limit: "Ürün limiti",
  staff_limit: "Personel limiti",
  monthly_order_limit: "Aylık işlem limiti",
  api_request_limit: "API kullanım limiti",
  reporting_level: "Rapor seviyesi",
  integration_level: "Entegrasyon seviyesi",
  support_level: "Destek seviyesi",
  role_level: "Rol seviyesi",
};

export const roleDescriptions = [
  {
    title: "Sahip",
    description: "Organizasyon, lisans, ödeme ve kullanıcı yönetiminde tam yetkilidir.",
  },
  {
    title: "Yönetici",
    description: "İşletme ayarları, ürünler, masalar ve raporları yönetebilir.",
  },
  {
    title: "Müdür",
    description: "Günlük operasyon, sipariş, masa ve personel süreçlerini yönetebilir.",
  },
  {
    title: "Personel",
    description: "Sipariş ve masa operasyonlarını kullanabilir.",
  },
  {
    title: "Görüntüleyici",
    description: "Sadece rapor ve temel bilgileri görüntüleyebilir.",
  },
];

const organizationDashboardInclude = {
  licenses: {
    include: {
      product: true,
      plan: {
        include: {
          entitlements: {
            where: { isActive: true },
            orderBy: { key: "asc" as const },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  appInstallations: {
    include: {
      product: true,
      license: {
        include: {
          plan: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  restaurants: {
    include: {
      branches: {
        include: {
          _count: {
            select: {
              tables: true,
              products: true,
            },
          },
        },
        orderBy: { createdAt: "asc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  invoices: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
  billingPayments: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
  subscriptions: {
    include: {
      plan: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
  memberships: {
    include: {
      user: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  apiKeys: {
    orderBy: { createdAt: "desc" as const },
  },
  webhookEndpoints: {
    orderBy: { createdAt: "desc" as const },
  },
  auditLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 8,
  },
};

export async function findSelectedOrganization(selector?: DashboardOrganizationSelector) {
  const organizationId = selector?.organizationId?.trim();
  const organizationSlug = selector?.organizationSlug?.trim();

  if (organizationId) {
    return {
      selectedBy: "id" as const,
      organization: await prisma.organization.findUnique({
        where: { id: organizationId },
        include: organizationDashboardInclude,
      }),
    };
  }

  if (organizationSlug) {
    return {
      selectedBy: "slug" as const,
      organization: await prisma.organization.findUnique({
        where: { slug: organizationSlug },
        include: organizationDashboardInclude,
      }),
    };
  }

  const activeOrganization = await prisma.organization.findFirst({
    where: { isActive: true },
    include: organizationDashboardInclude,
    orderBy: { createdAt: "desc" },
  });

  if (activeOrganization) {
    return { selectedBy: "fallback" as const, organization: activeOrganization };
  }

  return {
    selectedBy: "fallback" as const,
    organization: await prisma.organization.findFirst({
      include: organizationDashboardInclude,
      orderBy: { createdAt: "desc" },
    }),
  };
}

function createOrganizationContext(
  organization: { id: string; slug: string } | null,
  selectedBy: DashboardOrganizationContext["selectedBy"],
  mode: DashboardOrganizationContext["mode"] = "public_fallback",
): DashboardOrganizationContext {
  return {
    organizationId: organization?.id ?? null,
    organizationSlug: organization?.slug ?? null,
    selectedBy: organization ? selectedBy : "missing",
    mode,
  };
}

export async function getOrganizationDashboardData(
  selector?: DashboardOrganizationSelector,
  mode: DashboardOrganizationContext["mode"] = "public_fallback",
) {
  const { organization, selectedBy } = await findSelectedOrganization(selector);

  const products = await prisma.product.findMany({
    where: { key: { in: ["wexpay", "wexhotel", "wexb2b"] } },
    include: {
      plans: true,
    },
    orderBy: { key: "asc" },
  });

  if (!organization) {
    return {
      organization: null,
      organizationContext: createOrganizationContext(null, "missing", mode),
      products,
      wexPayAccess: null,
      wexPayLicense: null,
      wexPayInstallation: null,
      wexPaySubscription: null,
      upcomingProducts: products.filter((product) => product.status === "UPCOMING"),
      linkedRestaurant: null,
      branchCount: 0,
      tableCount: 0,
      menuProductCount: 0,
      entitlementMap: {},
    };
  }

  const wexPayLicense = organization.licenses.find((license) => license.product.key === "wexpay") ?? null;
  const wexPayInstallation =
    organization.appInstallations.find((installation) => installation.product.key === "wexpay") ?? null;
  const wexPaySubscription =
    organization.subscriptions.find((subscription) => subscription.plan.product.key === "wexpay") ?? null;
  const wexPayAccess = await evaluateProductAccess({
    organizationId: organization.id,
    productKey: "wexpay",
  });
  const wexPayEntitlementMap = wexPayAccess.entitlementMap as EntitlementMap;
  const linkedRestaurant = organization.restaurants[0] ?? null;
  const branchCount = organization.restaurants.reduce(
    (total, restaurant) => total + restaurant.branches.length,
    0,
  );
  const tableCount = organization.restaurants.reduce(
    (total, restaurant) =>
      total + restaurant.branches.reduce((branchTotal, branch) => branchTotal + branch._count.tables, 0),
    0,
  );
  const menuProductCount = organization.restaurants.reduce(
    (total, restaurant) =>
      total + restaurant.branches.reduce((branchTotal, branch) => branchTotal + branch._count.products, 0),
    0,
  );

  return {
    organization,
    organizationContext: createOrganizationContext(organization, selectedBy, mode),
    products,
    wexPayAccess,
    wexPayLicense: wexPayAccess.license ?? wexPayLicense,
    wexPayInstallation: wexPayAccess.installation ?? wexPayInstallation,
    wexPaySubscription,
    upcomingProducts: products.filter((product) => product.status === "UPCOMING"),
    linkedRestaurant,
    branchCount,
    tableCount,
    menuProductCount,
    entitlementMap: wexPayEntitlementMap,
  };
}

export async function getDemoOrganizationDashboardData() {
  return getOrganizationDashboardData();
}

export async function getCustomerDashboardData(selector?: DashboardOrganizationSelector) {
  const customerSession = await getCustomerSession();

  if (customerSession) {
    const access = await assertCustomerDashboardAccess(selector);
    if (!access.user) {
      redirect(customerLoginUrl());
    }
    if (access.user.mustChangePassword) {
      redirect("/dashboard/change-password");
    }
    if (!access.organizationId) {
      redirect(customerLoginUrl({ customerError: "Aktif üyelik bulunamadı." }));
    }
    return getOrganizationDashboardData({ organizationId: access.organizationId }, "customer");
  }

  const adminSession = await getAdminSession();
  if (adminSession) {
    if (!selector?.organizationId?.trim() && !selector?.organizationSlug?.trim()) {
      redirect(
        customerLoginUrl({
          customerError: "Müşteri panelini görüntülemek için müşteri girişi yapın.",
        }),
      );
    }
    return getOrganizationDashboardData(selector, "admin_preview");
  }

  const params = new URLSearchParams();
  const organizationId = selector?.organizationId?.trim();
  const organizationSlug = selector?.organizationSlug?.trim();
  if (organizationId) params.set("organizationId", organizationId);
  if (organizationSlug) params.set("organizationSlug", organizationSlug);
  const next = params.toString() ? `/dashboard?${params.toString()}` : "/dashboard";
  redirect(customerLoginUrl({ next }));
}

export function dashboardHref(path: string, context: DashboardOrganizationContext) {
  const params = new URLSearchParams();
  if (context.organizationId) {
    params.set("organizationId", context.organizationId);
  }
  if (context.organizationSlug) {
    params.set("organizationSlug", context.organizationSlug);
  }
  return coreNavigationUrl(path, params.toString());
}

export function formatCoreStatus(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Aktif",
    UPCOMING: "Yakında",
    TRIAL: "Deneme",
    TRIALING: "Deneme sürecinde",
    PENDING: "Hazırlanıyor",
    PAST_DUE: "Gecikmiş",
    SUSPENDED: "Askıya alındı",
    CANCELLED: "İptal",
    EXPIRED: "Süresi doldu",
    MONTHLY: "Aylık",
    YEARLY: "Yıllık",
    ONE_TIME: "Tek seferlik",
    OWNER: "Sahip",
    ADMIN: "Yönetici",
    MANAGER: "Müdür",
    STAFF: "Personel",
    BILLING: "Faturalama",
    VIEWER: "Görüntüleyici",
    INVITED: "Davet edildi",
    REMOVED: "Kaldırıldı",
  };

  return labels[status] ?? status;
}

export function formatCoreDate(value: Date | null) {
  return value ? value.toLocaleDateString("tr-TR") : "-";
}

export function readEntitlements(
  entitlements: Array<{
    key: string;
    valueBool: boolean | null;
    valueInt: number | null;
    valueString: string | null;
  }>,
) {
  return entitlements.reduce<EntitlementMap>((accumulator, entitlement) => {
    accumulator[entitlement.key] =
      entitlement.valueInt ?? entitlement.valueString ?? entitlement.valueBool ?? null;
    return accumulator;
  }, {});
}

export function entitlementNumber(entitlements: EntitlementMap, key: string) {
  return Number(entitlements[key] ?? 0);
}
