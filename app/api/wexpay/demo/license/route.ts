import { prisma } from "@/lib/prisma";
import { coreEntitlementNumber } from "@/lib/wexon-core-access";
import { getEntitlementUsage } from "@/lib/wexpay-read";
import { requireWexPayDemoContext } from "../_access";
import { errorResponse } from "../_utils";

const BILLING_INTERVAL_LABEL: Record<string, string> = {
  MONTHLY: "Aylık",
  YEARLY: "Yıllık",
  ONE_TIME: "Tek seferlik",
};

const LICENSE_STATUS_LABEL: Record<string, string> = {
  TRIAL: "Deneme",
  ACTIVE: "Aktif",
  PAST_DUE: "Gecikmiş",
  CANCELLED: "İptal",
  EXPIRED: "Süresi dolmuş",
  SUSPENDED: "Askıda",
};

export async function GET() {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const license = demo.coreAccess.license;
    const subscription = demo.coreAccess.subscription;
    const plan = license.plan;
    const usage = await getEntitlementUsage(demo.organizationId, demo.entitlementMap);

    const providerCredentials = await prisma.wexPayProviderCredential.count({
      where: {
        organizationId: demo.organizationId,
        isActive: true,
      },
    });

    const renewalAt =
      subscription?.currentPeriodEnd?.toISOString() ??
      license.endsAt?.toISOString() ??
      null;

    return Response.json({
      plan: {
        id: plan.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        billingInterval: plan.billingInterval,
        billingIntervalLabel: BILLING_INTERVAL_LABEL[plan.billingInterval] ?? plan.billingInterval,
      },
      license: {
        id: license.id,
        status: license.status,
        statusLabel: LICENSE_STATUS_LABEL[license.status] ?? license.status,
        licenseType: license.licenseType,
        startsAt: license.startsAt.toISOString(),
        endsAt: license.endsAt?.toISOString() ?? null,
        renewalAt,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            interval: subscription.interval,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
      installation: {
        id: demo.coreAccess.installation.id,
        status: demo.coreAccess.installation.status,
      },
      virtualPos: {
        connected: providerCredentials > 0,
        label: providerCredentials > 0 ? "Bağlı" : "Bağlı değil (demo MOCK)",
      },
      entitlements: demo.entitlementMap,
      usage: usage.map((row) => ({
        key: row.key,
        label: row.label,
        used: row.used,
        limit: row.unlimited ? null : row.limit,
        unlimited: row.unlimited,
        displayLimit: row.unlimited ? "Sınırsız" : String(row.limit),
      })),
      limits: {
        tables: coreEntitlementNumber(demo.entitlementMap, "table_limit"),
        products: coreEntitlementNumber(demo.entitlementMap, "product_limit"),
        staff: coreEntitlementNumber(demo.entitlementMap, "staff_limit"),
        branches: coreEntitlementNumber(demo.entitlementMap, "branch_limit"),
      },
    });
  } catch {
    return errorResponse("Lisans bilgileri alınırken bir sorun oluştu.", 500);
  }
}
