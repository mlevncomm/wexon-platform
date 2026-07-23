import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importJWK, SignJWT, type JWK } from "jose";
import type { APIRequestContext, Cookie, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export type SmokeFixtures = {
  dbAvailable: boolean;
  fixturesReady: boolean;
  setupError: string | null;
  adminEmail: string | null;
  customerEmail: string;
  customerOrgId: string | null;
  licensedCustomerEmail: string;
  licensedOrgId: string | null;
  realOrgId: string | null;
  demoOrgId: string | null;
  inactiveWexPayOrgId: string | null;
  qrCode: string | null;
  inactiveQrCode: string | null;
};

export function loadFixtures(): SmokeFixtures {
  const raw = readFileSync(resolve(process.cwd(), "e2e", ".fixtures.json"), "utf8");
  return JSON.parse(raw) as SmokeFixtures;
}

export function e2eTimestamp() {
  return Date.now().toString(36);
}

export function e2eCustomerEmail(stamp = e2eTimestamp()) {
  return process.env.E2E_CUSTOMER_EMAIL?.trim() || `e2e.customer+${stamp}@example.com`;
}

export function e2eOrgName(stamp = e2eTimestamp()) {
  return `E2E Wexon Test Org ${stamp}`;
}

export function adminPassword() {
  return process.env.E2E_ADMIN_PASSWORD?.trim() || process.env.ADMIN_LOGIN_PASSWORD?.trim() || "";
}

export function customerPassword() {
  const fromEnv =
    process.env.E2E_CUSTOMER_PASSWORD?.trim() || process.env.SMOKE_CUSTOMER_PASSWORD?.trim() || "";
  const target = (process.env.WEXON_E2E_TARGET ?? "local").trim().toLowerCase();
  const looksProduction =
    target === "production" ||
    /https?:\/\/([a-z0-9-]+\.)?wexon\.dev\b/i.test(
      process.env.E2E_BASE_URL || process.env.SMOKE_BASE_URL || process.env.E2E_PUBLIC_ORIGIN || "",
    );

  // Never fall back to seeded local fixture password against production targets.
  if (looksProduction) {
    if (!fromEnv || fromEnv === "change-me") {
      throw new Error(
        "Production E2E requires E2E_CUSTOMER_PASSWORD or SMOKE_CUSTOMER_PASSWORD (seed fixture password is not allowed).",
      );
    }
    return fromEnv;
  }

  // Seeded fixture password is Wexon-Customer-2026; ignore placeholder values from .env.example.
  if (!fromEnv || fromEnv === "change-me") {
    return "Wexon-Customer-2026";
  }
  return fromEnv;
}

export function adminEmailFromEnv(fixtures: SmokeFixtures) {
  return process.env.E2E_ADMIN_EMAIL?.trim() || fixtures.adminEmail;
}

export function assertSafeE2ETarget() {
  const target = (process.env.WEXON_E2E_TARGET ?? "local").trim().toLowerCase();
  const confirm = process.env.WEXON_E2E_CONFIRM_PRODUCTION === "true";
  const base =
    process.env.E2E_BASE_URL ||
    process.env.SMOKE_BASE_URL ||
    process.env.E2E_PUBLIC_ORIGIN ||
    "";

  if (
    (target === "production" || /https?:\/\/([a-z0-9-]+\.)?wexon\.dev\b/i.test(base)) &&
    !(target === "production" && confirm)
  ) {
    throw new Error(
      [
        "Refusing to run E2E against production without explicit confirmation.",
        "Set WEXON_E2E_TARGET=production and WEXON_E2E_CONFIRM_PRODUCTION=true,",
        "or use a local/preview base URL (SMOKE_BASE_URL / E2E_BASE_URL).",
      ].join(" "),
    );
  }

  return { target, confirm, base };
}

function e2eCloudflareSubject(email: string) {
  return `e2e-cf-subject:${email.trim().toLowerCase()}`;
}

export async function mintE2eCloudflareAccessJwt(email: string) {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to mint CF Access test JWT on Vercel production.");
  }
  const privateRaw = process.env.WEXON_CF_ACCESS_TEST_PRIVATE_JWK?.trim();
  const teamDomain = process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim();
  const audience = process.env.CLOUDFLARE_ACCESS_AUD?.trim();
  if (!privateRaw || !teamDomain || !audience) {
    throw new Error("CF Access test JWT mint requires WEXON_CF_ACCESS_TEST_PRIVATE_JWK + team domain + AUD.");
  }
  const privateJwk = JSON.parse(privateRaw) as JWK;
  const key = await importJWK(privateJwk, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email })
    .setProtectedHeader({
      alg: "RS256",
      kid: typeof privateJwk.kid === "string" ? privateJwk.kid : undefined,
      typ: "JWT",
    })
    .setIssuer(`https://${teamDomain}`)
    .setAudience(audience)
    .setSubject(e2eCloudflareSubject(email))
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 60 * 60)
    .sign(key);
}

/** Attach CF Access JWT for subsequent admin requests (local/CI test mode only). */
export async function attachE2eCloudflareAccessJwt(page: Page, email: string) {
  const token = await mintE2eCloudflareAccessJwt(email);
  await page.context().setExtraHTTPHeaders({
    "Cf-Access-Jwt-Assertion": token,
  });
  return token;
}

export async function loginAdmin(page: Page, email: string, password?: string) {
  void password;
  await attachE2eCloudflareAccessJwt(page, email);
  await page.goto("/admin/login");
  await expect(page.getByRole("button", { name: /Yönetim paneline devam et/i })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/admin(\/applications)?\/?$/, { timeout: 30_000 }),
    page.getByRole("button", { name: /Yönetim paneline devam et/i }).click(),
  ]);
  await expect(page, "admin continue login must not stay on login with denial").not.toHaveURL(
    /adminError=/,
  );
}

export async function loginCustomer(page: Page, email: string, password: string) {
  await page.goto("/dashboard/login");
  await page.getByLabel("E-posta").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/dashboard/login")),
    page.locator('button[type="submit"]').click(),
  ]);
}

export async function loginUnified(page: Page, email: string, password: string, next?: string) {
  const path = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  await page.goto(path);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

export function cookieByName(cookies: Cookie[], name: string) {
  return cookies.find((cookie) => cookie.name === name) ?? null;
}

export async function expectSessionCookieSecureFlags(page: Page, name: string) {
  const cookies = await page.context().cookies();
  const cookie = cookieByName(cookies, name);
  expect(cookie, `${name} cookie should exist`).toBeTruthy();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite?.toLowerCase()).toBe("lax");
  expect(cookie!.path || "/").toBe("/");
  // Secure is environment-dependent on http localhost; only assert when https.
  if (page.url().startsWith("https://")) {
    expect(cookie!.secure).toBe(true);
  }
  return cookie!;
}

/** Admin session cookies must be host-only v3 (no Domain=.wexon.dev). */
export async function expectAdminSessionCookieHostOnly(page: Page) {
  const cookie = await expectSessionCookieSecureFlags(page, "wexon_admin_session_v3");
  const domain = (cookie.domain || "").replace(/^\./, "");
  const pageHost = new URL(page.url()).hostname;
  expect(cookie.domain?.startsWith(".") ?? false, "admin cookie must not use Domain=.wexon.dev").toBe(false);
  if (pageHost === "localhost" || pageHost === "127.0.0.1") {
    expect(["localhost", "127.0.0.1"]).toContain(domain || pageHost);
  }
  // Prior cookies must not grant a parallel session.
  const all = await page.context().cookies();
  const legacy = cookieByName(all, "wexon_admin_session");
  const v2 = cookieByName(all, "wexon_admin_session_v2");
  expect(!legacy || !legacy.value, "legacy wexon_admin_session must be absent or empty").toBeTruthy();
  expect(!v2 || !v2.value, "v2 wexon_admin_session_v2 must be absent or empty").toBeTruthy();
  return cookie;
}

/** Seed necessary-only cookie consent so the marketing banner does not block E2E clicks. */
export async function seedCookieConsentRejected(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wexon_cookie_consent",
      JSON.stringify({
        necessary: true,
        analytics: false,
        marketing: false,
        updatedAt: new Date().toISOString(),
      }),
    );
  });
}

export async function fillDemoRequestForm(
  page: Page,
  input: {
    fullName: string;
    company: string;
    email: string;
    phone: string;
    product?: string;
    message: string;
  },
) {
  await page.locator('input[name="fullName"]').fill(input.fullName);
  await page.locator('input[name="company"]').fill(input.company);
  await page.locator('input[name="email"]').fill(input.email);
  await page.locator('input[name="phone"]').fill(input.phone);
  if (input.product) {
    await page.locator('select[name="product"]').selectOption(input.product);
  }
  await page.locator('textarea[name="message"]').fill(input.message);
}

export async function submitDemoRequest(page: Page) {
  await page.getByRole("button", { name: /Demo Talebi Gönder|Ön Başvuru Gönder/i }).click();
}

export async function softGet(request: APIRequestContext, path: string) {
  const response = await request.get(path, { maxRedirects: 0 });
  return response;
}
