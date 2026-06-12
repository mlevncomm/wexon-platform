import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const fixturesPath = resolve(process.cwd(), "e2e", ".fixtures.json");

function emptyFixtures(reason) {
  return {
    dbAvailable: false,
    setupError: reason,
    adminEmail: (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null,
    customerEmail: "demo@wexon.dev",
    customerOrgId: null,
    licensedCustomerEmail: "real@wexon.dev",
    licensedOrgId: null,
    realOrgId: null,
    demoOrgId: null,
    inactiveWexPayOrgId: null,
    qrCode: null,
  };
}

export default async function globalSetup() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    const fixtures = emptyFixtures("DIRECT_URL or DATABASE_URL is not configured.");
    writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2), "utf8");
    console.warn("[smoke] DB fixtures unavailable:", fixtures.setupError);
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

  try {
    const [realOrg, demoOrg, customerUser, qrTable, inactiveWexPay] = await Promise.all([
      prisma.organization.findFirst({
        where: { slug: "wexpay-real-test" },
        select: { id: true, name: true },
      }),
      prisma.organization.findFirst({
        where: { slug: "mavi-bahce-demo" },
        select: { id: true, name: true },
      }),
      prisma.user.findFirst({
        where: {
          email: { in: ["real@wexon.dev", "demo@wexon.dev"] },
          isActive: true,
          memberships: { some: { status: "ACTIVE" } },
        },
        orderBy: { email: "asc" },
        select: {
          email: true,
          memberships: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { organizationId: true },
          },
        },
      }),
      prisma.restaurantTable.findFirst({
        where: {
          qrCode: { not: "" },
          isActive: true,
          branch: {
            isActive: true,
            restaurant: {
              isActive: true,
              organization: { isDemo: false, isActive: true },
            },
          },
        },
        select: { qrCode: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.appInstallation.findFirst({
        where: { product: { key: "wexpay" }, status: { not: "ACTIVE" } },
        select: { organizationId: true, status: true },
      }),
    ]);

    const fallbackOrg = realOrg ?? demoOrg;
    const customerOrgId = customerUser?.memberships[0]?.organizationId ?? fallbackOrg?.id ?? null;
    const licensedCustomerEmail = realOrg ? "real@wexon.dev" : customerUser?.email ?? "demo@wexon.dev";
    const licensedOrgId = realOrg?.id ?? customerOrgId;

    const fixtures = {
      dbAvailable: true,
      setupError: null,
      adminEmail: (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null,
      customerEmail: customerUser?.email ?? "demo@wexon.dev",
      customerOrgId,
      licensedCustomerEmail,
      licensedOrgId,
      realOrgId: realOrg?.id ?? null,
      demoOrgId: demoOrg?.id ?? null,
      inactiveWexPayOrgId: inactiveWexPay?.organizationId ?? null,
      qrCode: qrTable?.qrCode ?? null,
    };

    writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2), "utf8");
    console.log("[smoke] fixtures written:", fixturesPath);
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message || "database fixture setup failed"}` : "database fixture setup failed";
    const fixtures = emptyFixtures(reason);
    writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2), "utf8");
    console.warn("[smoke] DB fixtures unavailable:", reason);
  } finally {
    await prisma.$disconnect();
  }
}
