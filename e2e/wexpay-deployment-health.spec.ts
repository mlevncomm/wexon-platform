import { expect, test } from "@playwright/test";

/**
 * Deployment readiness route smoke — read-only, no table mutations.
 */
test.describe("deployment health routes", () => {
  test("GET /api/health returns ok without internals", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok", service: "wexon-platform" });
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/organizationId|DATABASE_URL|postgresql:\/\//i);
    const cache = response.headers()["cache-control"] ?? "";
    expect(cache.toLowerCase()).toContain("no-store");
  });

  test("GET /api/health/ready returns ready or generic not_ready", async ({ request }) => {
    const response = await request.get("/api/health/ready");
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    if (response.status() === 200) {
      expect(body).toEqual({ status: "ready" });
    } else {
      expect(body).toEqual({ status: "not_ready" });
    }
    expect(Object.keys(body)).toEqual(["status"]);
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/Prisma|DATABASE_URL|stack|host=/i);
  });
});
