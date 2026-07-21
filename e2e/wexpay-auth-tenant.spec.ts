import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

test("customer switches owned tenants, foreign/admin stay denied, and re-login works", async ({
  page,
}) => {
  const fixtures = loadFixtures();
  expect(fixtures.dbAvailable).toBe(true);
  expect(fixtures.fixturesReady).toBe(true);
  expect(fixtures.licensedCustomerEmail).toBeTruthy();

  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  expect(databaseUrl).toBeTruthy();
  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: fixtures.licensedCustomerEmail },
    select: { id: true },
  });
  const stamp = Date.now().toString(36);
  const organizationIds: string[] = [];

  try {
    for (const [suffix, slugSuffix] of [
      ["Bir", "bir"],
      ["İki", "iki"],
      ["Yabancı", "yabanci"],
    ] as const) {
      const organization = await prisma.organization.create({
        data: {
          name: `Tenant QA ${suffix} ${stamp}`,
          slug: `tenant-qa-${slugSuffix}-${stamp}`,
          isActive: true,
          isDemo: false,
        },
      });
      organizationIds.push(organization.id);
    }
    await prisma.membership.createMany({
      data: organizationIds.slice(0, 2).map((organizationId) => ({
        organizationId,
        userId: owner.id,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      })),
    });

    const browserIssues: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        browserIssues.push(message.text());
      }
    });
    page.on("pageerror", (error) => browserIssues.push(error.message));

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    await page.goto(`/dashboard?organizationId=${organizationIds[0]}`);
    await expect(page.getByText(`Tenant QA Bir ${stamp}`).first()).toBeVisible();

    await page.getByRole("button", { name: "Profil menüsü" }).click();
    await expect(page.getByText("Organizasyon değiştir")).toBeVisible();
    const switcherLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="organizationId="]')).map(
        (link) => ({ href: link.getAttribute("href"), text: link.textContent }),
      ),
    );
    const secondOrganizationHref = switcherLinks.find((link) =>
      link.text?.includes(`Tenant QA İki ${stamp}`),
    )?.href;
    expect(secondOrganizationHref).toContain(`organizationId=${organizationIds[1]}`);
    await page.goto(secondOrganizationHref!, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await expect(page).toHaveURL(new RegExp(`organizationId=${organizationIds[1]}`));
    await expect(page.getByText(`Tenant QA İki ${stamp}`).first()).toBeVisible();

    await page.goto(`/dashboard?organizationId=${organizationIds[2]}`);
    await expect(page).toHaveURL(/\/unauthorized/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto(`/dashboard?organizationId=${organizationIds[0]}`);
    await page.getByRole("button", { name: "Profil menüsü" }).click();
    await page
      .getByRole("menuitem", { name: "Çıkış yap" })
      .evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page).toHaveURL(/\/(dashboard\/)?login/, { timeout: 15_000 });

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    await page.goto(`/dashboard?organizationId=${organizationIds[1]}`);
    await expect(page.getByText(`Tenant QA İki ${stamp}`).first()).toBeVisible();

    expect(browserIssues.filter((issue) => /hydration|unhandled|encType or method/i.test(issue))).toEqual([]);
  } finally {
    await page.goto("about:blank").catch(() => undefined);
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.membership.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  }
});
