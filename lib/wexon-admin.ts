import { prisma } from "@/lib/prisma";
import { evaluateProductAccess } from "@/lib/wexon-core-access";
import { groupDemoLeadFollowUpUpdates, groupDemoLeadStatusUpdates, resolveDemoLeadFollowUp, resolveDemoLeadStatus } from "@/lib/wexon-demo-request-leads";

export function formatAdminStatus(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Aktif",
    UPCOMING: "Yakında",
    INTERNAL: "İç kullanım",
    DISABLED: "Pasif",
    TRIAL: "Deneme",
    TRIALING: "Deneme sürecinde",
    PAST_DUE: "Gecikmiş",
    SUSPENDED: "Askıda",
    CANCELLED: "İptal",
    EXPIRED: "Süresi dolmuş",
    MONTHLY: "Aylık",
    YEARLY: "Yıllık",
    ONE_TIME: "Tek seferlik",
    PENDING: "Bekliyor",
    PAID: "Ödendi",
    FAILED: "Başarısız",
    REFUNDED: "İade",
    DRAFT: "Taslak",
    ISSUED: "Kesildi",
    VOID: "İptal edildi",
    OVERDUE: "Vadesi geçti",
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

export function displayPlanName(name: string) {
  const names: Record<string, string> = {
    Basic: "Başlangıç",
    Standard: "Standart",
    Pro: "Profesyonel",
  };
  return names[name] ?? name;
}

export function formatAdminDate(value: Date | null) {
  return value ? value.toLocaleDateString("tr-TR") : "-";
}

const organizationInclude = {
  restaurants: true,
  memberships: {
    include: {
      user: true,
    },
  },
  licenses: {
    include: {
      product: true,
      plan: {
        include: {
          entitlements: true,
        },
      },
    },
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
  },
  invoices: true,
  billingPayments: true,
  apiKeys: true,
  webhookEndpoints: true,
  auditLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 8,
  },
};

export async function getAdminOverviewData() {
  const [organizations, products, plans, licenses, appInstallations, invoices, auditLogs] = await Promise.all([
    prisma.organization.findMany({ include: { restaurants: true, memberships: true, licenses: true } }),
    prisma.product.findMany({ include: { appInstallations: true, licenses: true, plans: true }, orderBy: { key: "asc" } }),
    prisma.plan.findMany({ include: { entitlements: true, product: true } }),
    prisma.license.findMany({ include: { organization: true, product: true, plan: true } }),
    prisma.appInstallation.findMany({ include: { organization: true, product: true } }),
    prisma.invoice.findMany({ include: { organization: true }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ include: { organization: true, user: true }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const wexPayAccessDecisions = await Promise.all(
    organizations.map((organization) =>
      evaluateProductAccess({
        organizationId: organization.id,
        productKey: "wexpay",
      }),
    ),
  );

  return { organizations, products, plans, licenses, appInstallations, invoices, auditLogs, wexPayAccessDecisions };
}

export async function getAdminOrganizationsData() {
  return prisma.organization.findMany({ include: organizationInclude, orderBy: { createdAt: "desc" } });
}

export async function getAdminOrganizationDetail(id: string) {
  return prisma.organization.findUnique({ where: { id }, include: organizationInclude });
}

export async function getAdminProductsData() {
  return prisma.product.findMany({ include: { plans: true, licenses: true, appInstallations: true }, orderBy: { key: "asc" } });
}

export async function getAdminPlansData() {
  return prisma.plan.findMany({ include: { product: true, entitlements: true, licenses: true }, orderBy: [{ productId: "asc" }, { sortOrder: "asc" }] });
}

export async function getAdminLicensesData() {
  return prisma.license.findMany({ include: { organization: true, product: true, plan: true }, orderBy: { createdAt: "desc" } });
}

export async function getAdminSubscriptionsData() {
  return prisma.subscription.findMany({ include: { organization: true, plan: true, license: true }, orderBy: { createdAt: "desc" } });
}

export async function getAdminBillingData() {
  const [invoices, billingPayments] = await Promise.all([
    prisma.invoice.findMany({ include: { organization: true, subscription: true }, orderBy: { createdAt: "desc" } }),
    prisma.billingPayment.findMany({ include: { organization: true, invoice: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return { invoices, billingPayments };
}

export async function getAdminIntegrationsData() {
  const [apiKeys, webhookEndpoints] = await Promise.all([
    prisma.apiKey.findMany({ include: { organization: true, product: true }, orderBy: { createdAt: "desc" } }),
    prisma.webhookEndpoint.findMany({ include: { organization: true, product: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return { apiKeys, webhookEndpoints };
}

export async function getAdminOperationOptions() {
  const [organizations, plans, products, subscriptions, invoices] = await Promise.all([
    prisma.organization.findMany({
      select: { id: true, name: true, slug: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      include: { product: true },
      orderBy: [{ productId: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.product.findMany({
      select: { id: true, name: true, key: true },
      orderBy: { key: "asc" },
    }),
    prisma.subscription.findMany({
      select: {
        id: true,
        organizationId: true,
        planId: true,
        status: true,
        organization: { select: { name: true } },
        plan: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.invoice.findMany({
      select: { id: true, invoiceNo: true, organizationId: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return { organizations, plans, products, subscriptions, invoices };
}

export async function getAdminUsersData(q?: string) {
  const query = q?.trim();
  return prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      memberships: {
        include: { organization: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getAdminSettingsData() {
  const [
    organizations,
    users,
    products,
    plans,
    licenses,
    subscriptions,
    invoices,
    payments,
    apiKeys,
    webhooks,
    restaurants,
    auditLogs,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.product.count(),
    prisma.plan.count(),
    prisma.license.count(),
    prisma.subscription.count(),
    prisma.invoice.count(),
    prisma.billingPayment.count(),
    prisma.apiKey.count({ where: { revokedAt: null } }),
    prisma.webhookEndpoint.count(),
    prisma.restaurant.count(),
    prisma.auditLog.count(),
  ]);

  return {
    organizations,
    users,
    products,
    plans,
    licenses,
    subscriptions,
    invoices,
    payments,
    apiKeys,
    webhooks,
    restaurants,
    auditLogs,
  };
}

export type AdminAuditLogFilters = {
  organizationId?: string;
  level?: string;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export function formatAdminDateTime(value: Date | string) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function getAdminAuditLogsData(filters: AdminAuditLogFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(20, filters.pageSize ?? 40));
  const q = filters.q?.trim();

  const where = {
    ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
    ...(filters.level ? { level: filters.level } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { message: { contains: q, mode: "insensitive" as const } },
            { entityType: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
            { organization: { name: { contains: q, mode: "insensitive" as const } } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [logs, total, organizations, errorCount, warnCount, failureCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { organization: true, user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.count({ where: { level: "ERROR" } }),
    prisma.auditLog.count({ where: { level: "WARN" } }),
    prisma.auditLog.count({ where: { status: "FAILURE" } }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    organizations,
    stats: { errorCount, warnCount, failureCount },
  };
}

export async function getAdminSupportTicketsData() {
  const tickets = await prisma.auditLog.findMany({
      where: { action: "customer.support_ticket.created" },
      include: { organization: true, user: true },
      orderBy: { createdAt: "desc" },
    });
  return { tickets, loadedAt: new Date() };
}

export async function getAdminDemoRequestsData() {
  const requests = await prisma.auditLog.findMany({
    where: { action: "public.demo_request.created" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const requestIds = requests.map((request) => request.id);
  const [statusUpdates, followUpUpdates] =
    requestIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.auditLog.findMany({
            where: {
              action: "public.demo_request.status_updated",
              entityId: { in: requestIds },
            },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              entityId: true,
              metadataJson: true,
              createdAt: true,
            },
          }),
          prisma.auditLog.findMany({
            where: {
              action: "public.demo_request.followup_updated",
              entityId: { in: requestIds },
            },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              entityId: true,
              metadataJson: true,
              createdAt: true,
            },
          }),
        ]);

  const updatesByRequestId = groupDemoLeadStatusUpdates(statusUpdates);
  const followUpsByRequestId = groupDemoLeadFollowUpUpdates(followUpUpdates);

  const enrichedRequests = requests.map((request) => ({
    ...request,
    leadStatus: resolveDemoLeadStatus(request.metadataJson, updatesByRequestId.get(request.id) ?? []),
    followUp: resolveDemoLeadFollowUp(followUpsByRequestId.get(request.id) ?? []),
  }));

  return { requests: enrichedRequests, loadedAt: new Date() };
}

export async function getAdminOrganizationMutationOptions() {
  const wexPayProduct = await prisma.product.findFirst({
    where: {
      OR: [{ key: "wexpay" }, { name: { equals: "WexPay", mode: "insensitive" } }],
    },
    include: {
      plans: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return {
    wexPayProduct,
    wexPayPlans: wexPayProduct?.plans ?? [],
  };
}

export type AdminHeaderSnapshot = {
  stats: {
    organizations: number;
    pendingInvoices: number;
    attentionLicenses: number;
    openSupportTickets: number;
    pendingWork: number;
  };
  organizations: Array<{ id: string; name: string; slug: string }>;
  recentActivity: Array<{
    id: string;
    action: string;
    organizationName: string | null;
    createdAt: string;
  }>;
};

function readSupportMeta(value: unknown) {
  return typeof value === "object" && value !== null ? (value as { status?: string }) : {};
}

export async function getAdminHeaderSnapshot(): Promise<AdminHeaderSnapshot> {
  const [organizations, organizationCount, pendingInvoices, attentionLicenses, supportTickets, recentLogs] =
    await Promise.all([
      prisma.organization.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { updatedAt: "desc" },
        take: 16,
      }),
      prisma.organization.count(),
      prisma.invoice.count({ where: { status: { in: ["ISSUED", "OVERDUE"] } } }),
      prisma.license.count({ where: { status: { in: ["TRIAL", "PAST_DUE"] } } }),
      prisma.auditLog.findMany({
        where: { action: "customer.support_ticket.created" },
        select: { metadataJson: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.auditLog.findMany({
        select: {
          id: true,
          action: true,
          createdAt: true,
          organization: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

  const openSupportTickets = supportTickets.filter(
    (ticket) => readSupportMeta(ticket.metadataJson).status === "OPEN",
  ).length;

  return {
    stats: {
      organizations: organizationCount,
      pendingInvoices,
      attentionLicenses,
      openSupportTickets,
      pendingWork: pendingInvoices + attentionLicenses + openSupportTickets,
    },
    organizations,
    recentActivity: recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      organizationName: log.organization?.name ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
