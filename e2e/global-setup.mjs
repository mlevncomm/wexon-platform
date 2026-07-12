import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function loadLocalEnvFile(fileName, { override = false } = {}) {
  const fullPath = resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return;
  const parsed = dotenv.parse(readFileSync(fullPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile(".env");
loadLocalEnvFile(".env.local", { override: true });

const fixturesPath = resolve(process.cwd(), "e2e", ".fixtures.json");
const SMOKE_QR_CODE = "WEXPAY-real-test-MASA-01";
const INACTIVE_QR_CODE = "WEXPAY-inactive-test-MASA-01";

function emptyFixtures(reason) {
  return {
    dbAvailable: false,
    fixturesReady: false,
    setupError: reason,
    adminEmail: (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null,
    customerEmail: "real@wexon.dev",
    customerOrgId: null,
    licensedCustomerEmail: "real@wexon.dev",
    licensedOrgId: null,
    realOrgId: null,
    demoOrgId: null,
    inactiveWexPayOrgId: null,
    qrCode: null,
    inactiveQrCode: null,
  };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
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
    const [realOrg, demoOrg, realUser, qrTable, inactiveQrTable, inactiveWexPay, wexPayInstall, license, productCount] =
      await withTimeout(
        Promise.all([
          prisma.organization.findFirst({
            where: { slug: "wexpay-real-test", isDemo: false, isActive: true },
            select: { id: true, name: true, isDemo: true },
          }),
          prisma.organization.findFirst({
            where: { slug: "mavi-bahce-demo", isActive: true },
            select: { id: true, name: true },
          }),
          prisma.user.findFirst({
            where: {
              email: "real@wexon.dev",
              isActive: true,
              memberships: {
                some: {
                  status: "ACTIVE",
                  organization: { slug: "wexpay-real-test" },
                },
              },
            },
            select: {
              email: true,
              memberships: {
                where: {
                  status: "ACTIVE",
                  organization: { slug: "wexpay-real-test" },
                },
                take: 1,
                select: { organizationId: true },
              },
            },
          }),
          prisma.restaurantTable.findFirst({
            where: {
              qrCode: SMOKE_QR_CODE,
              isActive: true,
              branch: {
                isActive: true,
                restaurant: {
                  isActive: true,
                  organization: { slug: "wexpay-real-test", isDemo: false, isActive: true },
                },
              },
            },
            select: { qrCode: true },
          }),
          prisma.restaurantTable.findFirst({
            where: {
              qrCode: INACTIVE_QR_CODE,
              isActive: true,
              branch: {
                isActive: true,
                restaurant: {
                  isActive: true,
                  organization: { slug: "wexpay-inactive-test", isDemo: false, isActive: true },
                },
              },
            },
            select: { qrCode: true },
          }),
          prisma.appInstallation.findFirst({
            where: {
              product: { key: "wexpay" },
              status: { not: "ACTIVE" },
              organization: { slug: "wexpay-inactive-test" },
            },
            select: { organizationId: true, status: true },
          }),
          prisma.appInstallation.findFirst({
            where: {
              product: { key: "wexpay" },
              status: "ACTIVE",
              organization: { slug: "wexpay-real-test" },
            },
            select: { id: true, status: true },
          }),
          prisma.license.findFirst({
            where: {
              status: "ACTIVE",
              organization: { slug: "wexpay-real-test" },
              product: { key: "wexpay" },
            },
            select: { id: true, status: true },
          }),
          prisma.menuProduct.count({
            where: {
              isActive: true,
              branch: {
                restaurant: { organization: { slug: "wexpay-real-test" } },
              },
            },
          }),
        ]),
        8000,
        "database fixture query",
      );

    const missing = [];
    if (!realOrg) missing.push("organization:wexpay-real-test");
    if (!realUser) missing.push("user:real@wexon.dev");
    if (!qrTable) missing.push(`table:${SMOKE_QR_CODE}`);
    if (!wexPayInstall) missing.push("app_installation:wexpay ACTIVE");
    if (!license) missing.push("license:wexpay ACTIVE");
    if (productCount < 2) missing.push("menu_products:>=2");

    const fixturesReady = missing.length === 0;
    const customerOrgId = fixturesReady
      ? (realUser?.memberships[0]?.organizationId ?? realOrg?.id ?? demoOrg?.id ?? null)
      : null;
    const customerEmail = fixturesReady
      ? (realUser?.email ?? (realOrg ? "real@wexon.dev" : "demo@wexon.dev"))
      : "real@wexon.dev";
    const licensedOrgId = fixturesReady ? (realOrg?.id ?? customerOrgId) : null;
    const fixtures = {
      dbAvailable: true,
      fixturesReady,
      setupError: fixturesReady ? null : `Seed incomplete — run npm run prisma:seed:real (${missing.join(", ")})`,
      adminEmail: (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null,
      customerEmail,
      customerOrgId,
      licensedCustomerEmail: "real@wexon.dev",
      licensedOrgId,
      realOrgId: fixturesReady ? (realOrg?.id ?? null) : null,
      demoOrgId: fixturesReady ? (demoOrg?.id ?? null) : null,
      inactiveWexPayOrgId: fixturesReady ? (inactiveWexPay?.organizationId ?? null) : null,
      qrCode: fixturesReady ? (qrTable?.qrCode ?? null) : null,
      inactiveQrCode: fixturesReady ? (inactiveQrTable?.qrCode ?? null) : null,
    };

    writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2), "utf8");
    if (fixturesReady) {
      console.log("[smoke] fixtures ready:", fixturesPath);
    } else {
      console.warn("[smoke] DB connected but seed incomplete:", fixtures.setupError);
    }
  } catch (error) {
    const reason =
      error instanceof Error ? `${error.name}: ${error.message || "database fixture setup failed"}` : "database fixture setup failed";
    const fixtures = emptyFixtures(reason);
    writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2), "utf8");
    console.warn("[smoke] DB fixtures unavailable:", reason);
  } finally {
    await prisma.$disconnect();
  }
}
