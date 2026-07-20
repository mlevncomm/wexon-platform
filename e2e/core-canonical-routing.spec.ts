import { expect, test } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

const CORE_HOST = "core.wexon.dev";

/**
 * Host-aware Core canonical routing for /wexpay/activation.
 * Uses Host: core.wexon.dev against the local isolated server.
 */
test.describe("core canonical routing (activation)", () => {
  test("prefixed /dashboard/wexpay/activation GET canonicalizes to clean URL", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get("/dashboard/wexpay/activation?organizationId=org-smoke", {
      headers: { Host: CORE_HOST },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    const location = res.headers().location;
    expect(location).toBeTruthy();
    const url = new URL(location!, baseURL);
    expect(url.pathname).toBe("/wexpay/activation");
    expect(url.searchParams.get("organizationId")).toBe("org-smoke");
  });

  test("clean /wexpay/activation unauthenticated redirects to login with internal next", async ({
    request,
  }) => {
    const res = await request.get("/wexpay/activation?organizationId=org-smoke", {
      headers: { Host: CORE_HOST },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    const location = res.headers().location;
    expect(location).toBeTruthy();
    expect(location!).not.toMatch(/404/);
    const url = new URL(location!, "https://www.wexon.dev");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe(
      "/dashboard/wexpay/activation?organizationId=org-smoke",
    );
  });

  test("authenticated customer opens wizard on clean core URL and refresh keeps it", async ({
    page,
    request,
    context,
  }) => {
    test.setTimeout(120_000);
    const fixtures = loadFixtures();
    expect(fixtures.dbAvailable).toBe(true);
    expect(fixtures.fixturesReady).toBe(true);
    expect(fixtures.licensedCustomerEmail).toBeTruthy();
    expect(fixtures.licensedOrgId).toBeTruthy();

    await loginCustomer(page, fixtures.licensedCustomerEmail!, customerPassword());
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    expect(cookieHeader).toMatch(/wexon_customer_session=/);

    const orgId = fixtures.licensedOrgId!;
    const path = `/wexpay/activation?organizationId=${encodeURIComponent(orgId)}`;

    const first = await request.get(path, {
      headers: { Host: CORE_HOST, Cookie: cookieHeader },
      maxRedirects: 0,
    });
    expect(first.status()).toBe(200);
    const firstHtml = await first.text();
    // Licensed fixture org is already live → activation page renders live-state copy.
    // Assert route resolved (not soft-404 shell as primary content).
    expect(firstHtml).toContain("Akıllı Aktivasyon");
    expect(firstHtml).toMatch(/Kurulum Modu sihirbazı|Canlı Kullanım/);

    const second = await request.get(path, {
      headers: { Host: CORE_HOST, Cookie: cookieHeader },
      maxRedirects: 0,
    });
    expect(second.status()).toBe(200);
    const secondHtml = await second.text();
    expect(secondHtml).toContain("Akıllı Aktivasyon");
    expect(second.url()).toContain(`/wexpay/activation?organizationId=${orgId}`);
  });

  test("public legacy QR and opaque QR still resolve without core rewrite", async ({ request }) => {
    const legacy = await request.get("/wexpay/t/WEXPAY-DOES-NOT-EXIST-SMOKE", {
      headers: { Host: "www.wexon.dev" },
      maxRedirects: 0,
    });
    expect(legacy.status()).toBe(200);

    const opaque = await request.get("/q/invalid-opaque-token-smoke", {
      headers: { Host: "www.wexon.dev" },
      maxRedirects: 0,
    });
    expect(opaque.status()).toBe(200);

    const invite = await request.get("/invite/invalid-token-smoke", {
      headers: { Host: "www.wexon.dev" },
      maxRedirects: 0,
    });
    expect(invite.status()).toBe(200);
  });
});
