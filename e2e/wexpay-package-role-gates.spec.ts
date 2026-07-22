/**
 * Authenticated package + role gates for WexPay restaurant panel hardening.
 * Seeds Essential/Growth orgs and role users; cleans up after each test.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  ActivationJourneyStatus,
  ActivationStepKey,
  ActivationJourneyStepStatus,
  MembershipRole,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";
import { hashPassword } from "@/lib/wexon-passwords";

const STEP_KEYS = [
  ActivationStepKey.BUSINESS_PROFILE,
  ActivationStepKey.BRANCH_SETUP,
  ActivationStepKey.TABLE_SETUP,
  ActivationStepKey.STAFF_INVITE,
  ActivationStepKey.MENU_IMPORT,
  ActivationStepKey.PAYMENT_PROVIDER,
  ActivationStepKey.VALIDATION,
  ActivationStepKey.GO_LIVE,
] as const;

type TierKey = "essential" | "growth";

type PackagedTenant = {
  organizationId: string;
  restaurantId: string;
  branchId: string;
  ownerEmail: string;
  planKey: string;
};

type RoleUser = {
  userId: string;
  email: string;
  role: MembershipRole;
};

function prismaClient() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  expect(databaseUrl).toBeTruthy();
  return new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });
}

async function createPackagedTenant(
  prisma: PrismaClient,
  ownerEmail: string,
  label: string,
  tier: TierKey,
): Promise<PackagedTenant> {
  const product = await prisma.product.findUniqueOrThrow({ where: { key: "wexpay" } });
  const plan = await prisma.plan.findFirstOrThrow({
    where: {
      productId: product.id,
      isActive: true,
      OR: [{ tierKey: tier }, { key: `wexpay_${tier}` }],
    },
    orderBy: { sortOrder: "asc" },
  });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: ownerEmail },
    select: { id: true },
  });
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const organization = await prisma.organization.create({
    data: {
      name: `${label} ${stamp}`,
      slug: `${label.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-")}-${stamp}`,
      isActive: true,
      isDemo: false,
    },
  });
  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: "OWNER",
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });
  const license = await prisma.license.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      planId: plan.id,
      status: "ACTIVE",
      licenseType: "MONTHLY",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.appInstallation.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      licenseId: license.id,
      status: "ACTIVE",
    },
  });
  await prisma.activationFeeLedger.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      planId: plan.id,
      status: "WAIVED",
      currency: "TRY",
      activationFeeMinor: 0,
      grossAmountMinor: 0,
    },
  });
  const restaurant = await prisma.restaurant.create({
    data: {
      organizationId: organization.id,
      name: `${label} Restoran`,
      slug: `restaurant-${stamp}`,
      isActive: true,
    },
  });
  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: `${label} Şube`,
      slug: `branch-${stamp}`,
      address: "Paket gate E2E",
      isActive: true,
    },
  });
  await prisma.activationJourney.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      status: ActivationJourneyStatus.ACTIVE,
      source: "LEGACY_BACKFILL",
      currentStep: ActivationStepKey.GO_LIVE,
      version: 8,
      completedAt: new Date(),
      steps: {
        create: STEP_KEYS.map((stepKey) => ({
          stepKey,
          status: ActivationJourneyStepStatus.COMPLETED,
          completedAt: new Date(),
          safeMetadataJson:
            stepKey === ActivationStepKey.BRANCH_SETUP
              ? { restaurantId: restaurant.id, branchId: branch.id }
              : undefined,
        })),
      },
    },
  });
  return {
    organizationId: organization.id,
    restaurantId: restaurant.id,
    branchId: branch.id,
    ownerEmail,
    planKey: plan.key,
  };
}

async function createRoleUser(
  prisma: PrismaClient,
  organizationId: string,
  role: MembershipRole,
  stamp: string,
): Promise<RoleUser> {
  const email = `gate-${role.toLowerCase()}-${stamp}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `Gate ${role}`,
      passwordHash: await hashPassword(customerPassword()),
      passwordSetAt: new Date(),
      isActive: true,
    },
  });
  await prisma.membership.create({
    data: {
      organizationId,
      userId: user.id,
      role,
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });
  return { userId: user.id, email, role };
}

async function cleanupTenant(prisma: PrismaClient, tenant: PackagedTenant, extraUserIds: string[] = []) {
  const orgId = tenant.organizationId;
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
  await prisma.businessNotification.deleteMany({ where: { branch: { restaurant: { organizationId: orgId } } } }).catch(() => undefined);
  await prisma.payment.deleteMany({ where: { branch: { restaurant: { organizationId: orgId } } } }).catch(() => undefined);
  await prisma.customerOrder.deleteMany({ where: { branch: { restaurant: { organizationId: orgId } } } }).catch(() => undefined);
  await prisma.restaurantTable.deleteMany({ where: { branch: { restaurant: { organizationId: orgId } } } }).catch(() => undefined);
  await prisma.menuProduct.deleteMany({ where: { branch: { restaurant: { organizationId: orgId } } } }).catch(() => undefined);
  await prisma.menuCategory.deleteMany({ where: { branch: { restaurant: { organizationId: orgId } } } }).catch(() => undefined);
  await prisma.branch.deleteMany({ where: { restaurant: { organizationId: orgId } } }).catch(() => undefined);
  await prisma.restaurant.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
  await prisma.activationJourneyStep.deleteMany({ where: { journey: { organizationId: orgId } } }).catch(() => undefined);
  await prisma.activationJourney.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
  await prisma.activationFeeLedger.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
  await prisma.appInstallation.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
  await prisma.license.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
  await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
  await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => undefined);
  if (extraUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } }).catch(() => undefined);
  }
}

async function expectPanelAccess(page: Page, organizationId: string) {
  await page.goto(`/apps/wexpay?organizationId=${encodeURIComponent(organizationId)}`);
  await expect(page.locator(".wexpay-shell")).toBeVisible({ timeout: 20_000 });
}

async function loginAs(page: Page, email: string) {
  await page.context().clearCookies();
  await loginCustomer(page, email, customerPassword());
}

/** Server actions resolve org from cookie/header; query alone is not enough. */
async function setActiveOrganizationCookie(page: Page, organizationId: string) {
  const base = new URL(page.url() || "http://localhost:3100");
  await page.context().addCookies([
    {
      name: "wexon_active_organization_id",
      value: organizationId,
      domain: base.hostname,
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

test.describe("wexpay package + role gates (authenticated)", () => {
  const fixtures = loadFixtures();

  test("Essential hides CSV and returns 403 on direct export API", async ({ page }) => {
    test.skip(!fixtures.dbAvailable || !fixtures.fixturesReady || !fixtures.licensedCustomerEmail, "fixtures required");
    const prisma = prismaClient();
    let tenant: PackagedTenant | null = null;
    try {
      tenant = await createPackagedTenant(prisma, fixtures.licensedCustomerEmail, "Gate Essential CSV", "essential");
      await loginAs(page, tenant.ownerEmail);
      await page.goto(
        `/apps/wexpay/reports?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(tenant.branchId)}`,
      );
      await expect(page.getByRole("heading", { name: "Raporlar" })).toBeVisible();
      await expect(page.getByRole("link", { name: "CSV indir" })).toHaveCount(0);

      const exportResponse = await page.request.get(
        `/api/wexpay/reports/export?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(tenant.branchId)}`,
      );
      expect(exportResponse.status()).toBe(403);
    } finally {
      if (tenant) await cleanupTenant(prisma, tenant);
      await prisma.$disconnect();
    }
  });

  test("Growth shows CSV export and download succeeds", async ({ page }) => {
    test.skip(!fixtures.dbAvailable || !fixtures.fixturesReady || !fixtures.licensedCustomerEmail, "fixtures required");
    const prisma = prismaClient();
    let tenant: PackagedTenant | null = null;
    try {
      tenant = await createPackagedTenant(prisma, fixtures.licensedCustomerEmail, "Gate Growth CSV", "growth");
      await loginAs(page, tenant.ownerEmail);
      await page.goto(
        `/apps/wexpay/reports?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(tenant.branchId)}`,
      );
      await expect(page.getByRole("link", { name: "CSV indir" })).toBeVisible();
      const href = await page.getByRole("link", { name: "CSV indir" }).getAttribute("href");
      expect(href).toBeTruthy();
      const exportResponse = await page.request.get(new URL(href!, page.url()).toString());
      expect(exportResponse.status()).toBe(200);
      expect(exportResponse.headers()["content-type"]).toContain("text/csv");
    } finally {
      if (tenant) await cleanupTenant(prisma, tenant);
      await prisma.$disconnect();
    }
  });

  test("Essential blocks second active branch create; Growth allows it", async ({ page }) => {
    test.skip(!fixtures.dbAvailable || !fixtures.fixturesReady || !fixtures.licensedCustomerEmail, "fixtures required");
    const prisma = prismaClient();
    let essential: PackagedTenant | null = null;
    let growth: PackagedTenant | null = null;
    try {
      essential = await createPackagedTenant(prisma, fixtures.licensedCustomerEmail, "Gate Essential Branch", "essential");
      growth = await createPackagedTenant(prisma, fixtures.licensedCustomerEmail, "Gate Growth Branch", "growth");

      await loginAs(page, essential.ownerEmail);
      await page.goto(`/apps/wexpay/branches?organizationId=${encodeURIComponent(essential.organizationId)}`);
      await expect(page.getByText(/Çoklu şube|multi-location/i)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Yeni şube oluştur" })).toHaveCount(0);

      await page.goto(`/apps/wexpay/branches?organizationId=${encodeURIComponent(growth.organizationId)}`);
      await setActiveOrganizationCookie(page, growth.organizationId);
      await page.goto(`/apps/wexpay/branches?organizationId=${encodeURIComponent(growth.organizationId)}`);
      await expect(page.getByRole("heading", { name: "Yeni şube oluştur" })).toBeVisible();
      const stamp = Date.now().toString(36);
      const branchName = `Growth Branch ${stamp}`;
      const createPanel = page
        .locator("form")
        .filter({ has: page.getByRole("button", { name: "Şube oluştur" }) });
      await createPanel.locator('select[name="restaurantId"]').selectOption(growth.restaurantId);
      await createPanel.locator('input[name="name"]').fill(branchName);
      await createPanel.locator('input[name="slug"]').fill(`growth-b-${stamp}`);
      await createPanel.evaluate((form, orgId) => {
        const redirect = form.querySelector<HTMLInputElement>('input[name="redirectTo"]');
        if (redirect) {
          const url = new URL(redirect.value, window.location.origin);
          url.searchParams.set("organizationId", orgId);
          redirect.value = `${url.pathname}?${url.searchParams.toString()}`;
        }
      }, growth.organizationId);
      await Promise.all([
        page.waitForURL(new RegExp(`organizationId=${growth.organizationId}`)),
        createPanel.getByRole("button", { name: "Şube oluştur" }).click(),
      ]);
      await expect(page.locator("p").filter({ hasText: branchName }).first()).toBeVisible({
        timeout: 15_000,
      });
      const activeCount = await prisma.branch.count({
        where: { restaurantId: growth.restaurantId, isActive: true },
      });
      expect(activeCount).toBe(2);
    } finally {
      if (essential) await cleanupTenant(prisma, essential);
      if (growth) await cleanupTenant(prisma, growth);
      await prisma.$disconnect();
    }
  });

  test("STAFF kitchen/cashier allowed; settings denied; refund option hidden", async ({ page }) => {
    test.skip(!fixtures.dbAvailable || !fixtures.fixturesReady || !fixtures.licensedCustomerEmail, "fixtures required");
    const prisma = prismaClient();
    let tenant: PackagedTenant | null = null;
    let staff: RoleUser | null = null;
    try {
      tenant = await createPackagedTenant(prisma, fixtures.licensedCustomerEmail, "Gate Staff Role", "growth");
      staff = await createRoleUser(prisma, tenant.organizationId, MembershipRole.STAFF, `${Date.now().toString(36)}`);
      await prisma.payment.create({
        data: {
          branchId: tenant.branchId,
          tableId: (
            await prisma.restaurantTable.create({
              data: {
                branchId: tenant.branchId,
                label: "Staff Masa",
                seats: 2,
                qrCode: `STAFF-GATE-${Date.now()}`,
                status: "OCCUPIED",
                isActive: true,
              },
            })
          ).id,
          amount: "25.00",
          currency: "TRY",
          status: "PAID",
          provider: "manual",
          providerRef: `staff-paid-${Date.now()}`,
          paidAt: new Date(),
        },
      });

      await loginAs(page, staff.email);
      await expectPanelAccess(page, tenant.organizationId);

      await page.goto(
        `/apps/wexpay/kitchen?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(tenant.branchId)}`,
      );
      await expect(page.locator(".wexpay-shell")).toBeVisible();
      await expect(page.getByText(/Ayarlara erişim yok|Yetkisiz/i)).toHaveCount(0);

      await page.goto(
        `/apps/wexpay/payments?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(tenant.branchId)}`,
      );
      await expect(page.getByText(/salt okunur/i)).toBeVisible();
      await expect(page.locator('select[name="status"] option[value="REFUNDED"]')).toHaveCount(0);

      await page.goto(`/apps/wexpay/settings?organizationId=${encodeURIComponent(tenant.organizationId)}`);
      await expect(page.getByText(/Ayarlara erişim yok|erişim yok/i)).toBeVisible();
      await expect(page.getByText(/Sanal POS bağlantısı/i)).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Paket / Lisans" })).toHaveCount(0);
    } finally {
      if (tenant) await cleanupTenant(prisma, tenant, staff ? [staff.userId] : []);
      await prisma.$disconnect();
    }
  });

  test("VIEWER is read-only; BILLING has no WexPay panel; OWNER/ADMIN settings allowed", async ({ page }) => {
    test.skip(!fixtures.dbAvailable || !fixtures.fixturesReady || !fixtures.licensedCustomerEmail, "fixtures required");
    const prisma = prismaClient();
    let tenant: PackagedTenant | null = null;
    const extraUsers: string[] = [];
    try {
      tenant = await createPackagedTenant(prisma, fixtures.licensedCustomerEmail, "Gate Viewer Billing", "growth");
      const stamp = Date.now().toString(36);
      const viewer = await createRoleUser(prisma, tenant.organizationId, MembershipRole.VIEWER, stamp);
      const billing = await createRoleUser(prisma, tenant.organizationId, MembershipRole.BILLING, stamp);
      const admin = await createRoleUser(prisma, tenant.organizationId, MembershipRole.ADMIN, stamp);
      extraUsers.push(viewer.userId, billing.userId, admin.userId);

      await loginAs(page, viewer.email);
      await expectPanelAccess(page, tenant.organizationId);
      await page.goto(
        `/apps/wexpay/payments?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(tenant.branchId)}`,
      );
      await expect(page.getByRole("heading", { name: "Ödeme kaydet" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Ödeme durumu güncelle" })).toHaveCount(0);
      await page.goto(`/apps/wexpay/settings?organizationId=${encodeURIComponent(tenant.organizationId)}`);
      await expect(page.getByText(/Ayarlara erişim yok|erişim yok/i)).toBeVisible();

      await loginAs(page, billing.email);
      await page.goto(`/apps/wexpay?organizationId=${encodeURIComponent(tenant.organizationId)}`);
      await expect(page.getByRole("heading", { name: /erişiminiz aktif değil/i })).toBeVisible();
      await expect(page.locator(".wexpay-shell")).toHaveCount(0);

      await loginAs(page, admin.email);
      await page.goto(`/apps/wexpay/settings?organizationId=${encodeURIComponent(tenant.organizationId)}`);
      await expect(page.getByRole("heading", { name: "Sanal POS bağlantısı" })).toBeVisible();
      await expect(page.getByText(/Ayarlara erişim yok/i)).toHaveCount(0);

      await loginAs(page, tenant.ownerEmail);
      await page.goto(`/apps/wexpay/settings?organizationId=${encodeURIComponent(tenant.organizationId)}`);
      await expect(page.getByRole("heading", { name: "Sanal POS bağlantısı" })).toBeVisible();
    } finally {
      if (tenant) await cleanupTenant(prisma, tenant, extraUsers);
      await prisma.$disconnect();
    }
  });
});
