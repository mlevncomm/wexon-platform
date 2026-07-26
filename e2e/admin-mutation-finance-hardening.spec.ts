import { expect, test, type Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import {
  adminEmailFromEnv,
  adminPassword,
  expectAdminSessionCookieHostOnly,
  loadFixtures,
  loginAdmin,
} from "./helpers";

/**
 * Admin PR5 — mutation / finance hardening (isolated, 0 skip).
 * Titles are gated by scripts/run-wexpay-isolated-e2e.mjs.
 */
test.describe.serial("admin mutation finance hardening (PR5)", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();

  function requireFixtures() {
    expect(fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable").toBe(true);
    expect(fixtures.fixturesReady, fixtures.setupError ?? "fixtures incomplete").toBe(true);
    expect(fixtures.licensedOrgId, "licensed org required").toBeTruthy();
    const email = adminEmailFromEnv(fixtures);
    expect(email, "admin email required").toBeTruthy();
    return { email: email!, orgId: fixtures.licensedOrgId! };
  }

  async function openCollapsiblePanel(page: Page, title: string) {
    const panel = page.locator("details").filter({ hasText: title }).first();
    await expect(panel).toBeVisible();
    const isOpen = await panel.evaluate((el) => (el as HTMLDetailsElement).open);
    if (!isOpen) await panel.locator("summary").click();
    return panel;
  }

  test("PR5: billing create form requires reason confirmation and mutationId", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto("/admin/billing");
    await openCollapsiblePanel(page, "Yeni fatura oluştur");
    const form = page.getByTestId("admin-invoice-create-form");
    await expect(form).toBeVisible();
    await expect(form.locator('input[name="mutationId"]')).toHaveAttribute("value", /[0-9a-f-]{36}/i);
    await expect(form.locator('input[name="reason"]')).toBeVisible();
    await expect(form.locator('input[name="confirmed"]')).toBeVisible();
    const statusValues = await form.locator('select[name="status"] option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    expect(statusValues.sort()).toEqual(["DRAFT", "ISSUED"].sort());
  });

  test("PR5: double submit creates a single invoice", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto("/admin/billing");
    await openCollapsiblePanel(page, "Yeni fatura oluştur");
    const form = page.getByTestId("admin-invoice-create-form");
    const invoiceNo = `INV-E2E-PR5-${Date.now()}`;
    await form.locator('select[name="organizationId"]').selectOption(orgId);
    await form.locator('input[name="invoiceNo"]').fill(invoiceNo);
    await form.locator('input[name="subtotal"]').fill("100");
    await form.locator('input[name="tax"]').fill("20");
    await form.locator('input[name="total"]').fill("120");
    await form.locator('input[name="reason"]').fill("E2E çift gönderim kanıtı");
    await form.locator('input[name="confirmed"]').check();

    const submit = form.getByRole("button", { name: /Fatura oluştur/i });
    await Promise.all([
      page.waitForURL(/\/admin\/billing/),
      (async () => {
        await submit.click({ noWaitAfter: true });
        await submit.click({ noWaitAfter: true }).catch(() => undefined);
      })(),
    ]);

    if (page.url().includes("adminError=")) {
      const body = await page.locator("body").innerText();
      throw new Error(`invoice create redirected with adminError; body snippet: ${body.slice(0, 500)}`);
    }

    const count = await prisma.invoice.count({ where: { invoiceNo } });
    expect(count).toBe(1);
  });

  test("PR5: invalid invoice transition shows safe UI error", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: orgId,
        invoiceNo: `INV-E2E-PAID-${Date.now()}`,
        status: "PAID",
        subtotal: 10,
        tax: 0,
        total: 10,
        currency: "TRY",
        issuedAt: new Date(),
        paidAt: new Date(),
      },
    });
    await loginAdmin(page, email, password);
    await page.goto("/admin/billing");
    const statusForm = page.getByTestId(`invoice-status-form-${invoice.id}`);
    await expect(statusForm).toBeVisible();
    await statusForm.locator('select[name="status"]').selectOption("DRAFT");
    await statusForm.locator('input[name="reason"]').fill("Geçersiz transition denemesi");
    await statusForm.locator('input[name="confirmed"]').check();
    await Promise.all([
      page.waitForURL(/adminError=/),
      statusForm.getByRole("button", { name: /Kaydet|Güncelle|Uygula/i }).click(),
    ]);
    await expect(page.getByText(/geçişine izin verilmez|geçersiz|sayfayı yenileyip|Fatura durumu/i).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Prisma|P2002|PostgreSQL/i);
    const refreshed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(refreshed.status).toBe("PAID");
  });

  test("PR5: subscription create requires mutationId reason confirmed", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto("/admin/subscriptions");
    await openCollapsiblePanel(page, "Yeni abonelik oluştur");
    const form = page.locator("form").filter({ has: page.locator('select[name="provider"]') }).first();
    await expect(form.locator('input[name="mutationId"]')).toHaveAttribute("value", /[0-9a-f-]{36}/i);
    await expect(form.locator('input[name="reason"]')).toBeVisible();
    await expect(form.locator('input[name="confirmed"]')).toBeVisible();
  });

  test("PR5: subscription status requires explicit confirmed", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto("/admin/subscriptions");
    const statusForm = page.locator("form").filter({ has: page.locator('input[name="auditNote"]') }).first();
    await expect(statusForm.locator('input[name="confirmed"]')).toBeVisible();
  });

  test("PR5: licenses create and status expose high-risk fields", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto("/admin/licenses");
    await openCollapsiblePanel(page, "Yeni lisans ata");
    const createForm = page.locator("form").filter({ has: page.locator('input[name="mutationId"]') }).first();
    await expect(createForm.locator('input[name="mutationId"]')).toHaveAttribute("value", /[0-9a-f-]{36}/i);
    await expect(createForm.locator('input[name="reason"]')).toBeVisible();
    await expect(createForm.locator('input[name="confirmed"]')).toBeVisible();
    const statusForm = page.locator("form").filter({ has: page.locator('input[name="reason"]') }).filter({ has: page.locator('select[name="status"]') }).first();
    if ((await statusForm.count()) > 0) {
      await expect(statusForm.locator('input[name="confirmed"]')).toBeVisible();
    }
  });

  test("PR5: integrations API key and webhook require mutationId", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto("/admin/integrations");
    const keyForm = page.locator("form").filter({ has: page.locator('input[name="name"]') }).first();
    await expect(keyForm.locator('input[name="mutationId"]')).toHaveAttribute("value", /[0-9a-f-]{36}/i);
    const webhookForm = page.locator("form").filter({ has: page.locator('input[name="url"], input[name="targetUrl"]') }).first();
    if ((await webhookForm.count()) > 0) {
      await expect(webhookForm.locator('input[name="mutationId"]')).toHaveAttribute("value", /[0-9a-f-]{36}/i);
    }
  });

  test("PR5: organization detail license details has no status bypass", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto(`/admin/organizations/${orgId}`);
    const detailsForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: /Lisans detaylarını kaydet/i }) });
    if ((await detailsForm.count()) > 0) {
      await expect(detailsForm.locator('select[name="status"]')).toHaveCount(0);
      await expect(detailsForm.locator('input[name="reason"]')).toBeVisible();
      await expect(detailsForm.locator('input[name="confirmed"]')).toBeVisible();
    }
  });

  test("PR5: subscription providers remain allowlisted", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto("/admin/subscriptions");
    await openCollapsiblePanel(page, "Yeni abonelik oluştur");
    const provider = page.locator('select[name="provider"]');
    await expect(provider).toBeVisible();
    const values = await provider.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    expect(values.sort()).toEqual(["admin_manual", "paytr"].sort());
  });

  test("PR5: logout clears admin session cookie", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await expectAdminSessionCookieHostOnly(page);
    await page.getByRole("button", { name: "Admin profil menüsü" }).click();
    await Promise.all([
      page.waitForURL(/\/(login|admin\/login)/),
      page.getByRole("menuitem", { name: /Çıkış yap/i }).click(),
    ]);
    const cookies = await page.context().cookies();
    const v3 = cookies.find((c) => c.name === "wexon_admin_session_v3");
    expect(!v3 || !v3.value).toBeTruthy();
  });
});
