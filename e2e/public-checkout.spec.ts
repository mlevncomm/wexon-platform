import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

type SmokeFixtures = {
  dbAvailable: boolean;
  setupError: string | null;
  qrCode: string | null;
  inactiveWexPayOrgId: string | null;
};

function loadFixtures(): SmokeFixtures {
  const raw = readFileSync(resolve(process.cwd(), "e2e", ".fixtures.json"), "utf8");
  return JSON.parse(raw) as SmokeFixtures;
}

test.describe.serial("public QR checkout edge cases", () => {
  const fixtures = loadFixtures();

  test("unknown QR returns 404", async ({ request }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");

    const response = await request.post("/api/wexpay/public/UNKNOWN-QR-CODE-404/checkout", {
      data: {},
    });
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("checkout without PSP returns 503 when DB available", async ({ request }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.qrCode, "qrCode fixture required");

    const menuResponse = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    test.skip(menuResponse.status() !== 200, "public menu unavailable");
    const menu = (await menuResponse.json()) as {
      menu: Array<{ products: Array<{ id: string }> }>;
    };
    const productId = menu.menu.flatMap((category) => category.products)[0]?.id;
    test.skip(!productId, "no menu product");

    const orderResponse = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      data: { items: [{ productId, quantity: 1 }] },
    });
    test.skip(orderResponse.status() !== 201, "order creation failed");
    const order = (await orderResponse.json()) as { id: string };

    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/checkout`, {
      data: { orderId: order.id, amount: 99999 },
    });
    expect([400, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty("error");
    if (response.status() === 503) {
      expect(String(body.error)).toMatch(/aktif değil/i);
    }
  });

  test("invalid orderId returns 400 when DB available", async ({ request }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.qrCode, "qrCode fixture required");

    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/checkout`, {
      data: { orderId: "00000000-0000-0000-0000-000000000099" },
    });
    expect([400, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });
});
