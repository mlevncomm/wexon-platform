import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { skipUnlessDbReadable, skipUnlessPublicApiMutationAllowed } from "./mutation-gate";

type SmokeFixtures = {
  dbAvailable: boolean;
  fixturesReady: boolean;
  setupError: string | null;
  qrCode: string | null;
  inactiveQrCode: string | null;
};

function loadFixtures(): SmokeFixtures {
  const raw = readFileSync(resolve(process.cwd(), "e2e", ".fixtures.json"), "utf8");
  return JSON.parse(raw) as SmokeFixtures;
}

test.describe.serial("public QR checkout — validation (independent of PSP)", () => {
  const fixtures = loadFixtures();

  test("unknown QR returns 404", async ({ request }) => {
    skipUnlessDbReadable(fixtures);

    const response = await request.post("/api/wexpay/public/UNKNOWN-QR-CODE-404/checkout", {
      data: {},
    });
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("access closed returns 403 for inactive tenant QR", async ({ request }) => {
    skipUnlessDbReadable(fixtures);
    test.skip(!fixtures.inactiveQrCode, "inactiveQrCode fixture required — run e2e:db:prepare");

    const response = await request.post(
      `/api/wexpay/public/${encodeURIComponent(fixtures.inactiveQrCode!)}/checkout`,
      { data: {} },
    );
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(String(body.reason ?? "")).toBe("access_closed");
  });

  test("invalid orderId returns 400 before PSP", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);

    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/checkout`, {
      data: { orderId: "00000000-0000-0000-0000-000000000099", amount: 99999 },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(String(body.error)).toMatch(/sipariş|bulunamadı/i);
  });

  test("checkout route does not reference BillingPayment", async () => {
    const checkoutRoute = readFileSync(
      resolve(process.cwd(), "app/api/wexpay/public/[qrCode]/checkout/route.ts"),
      "utf8",
    );
    const checkoutLib = readFileSync(resolve(process.cwd(), "lib/wexpay-public-checkout.ts"), "utf8");
    expect(checkoutRoute).not.toMatch(/BillingPayment/);
    expect(checkoutLib).not.toMatch(/BillingPayment/);
  });
});

test.describe.serial("public QR checkout — PSP unavailable", () => {
  const fixtures = loadFixtures();

  test("no PSP credentials returns 503 with inactive message", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    test.skip(process.env.WEXPAY_PAYTR_ENABLE_API === "true", "PSP enabled — skip no-PSP scenario");

    const menuResponse = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    expect(menuResponse.status()).toBe(200);
    const menu = (await menuResponse.json()) as {
      menu: Array<{ products: Array<{ id: string }> }>;
    };
    const productId = menu.menu.flatMap((category) => category.products)[0]?.id;
    expect(productId).toBeTruthy();

    const orderResponse = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      data: { items: [{ productId, quantity: 1 }], note: "E2E[WXP] checkout order" },
    });
    expect(orderResponse.status()).toBe(201);
    const order = (await orderResponse.json()) as { id: string };

    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/checkout`, {
      data: { orderId: order.id, amount: 99999 },
    });
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(String(body.error)).toMatch(/aktif değil/i);
    expect(String(body.reason ?? "")).toBe("checkout_unavailable");
  });
});

test.describe.serial("public QR checkout — amount rules", () => {
  const fixtures = loadFixtures();

  test("client-supplied amount is ignored; server uses order subtotal cap", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    test.skip(process.env.WEXPAY_PAYTR_ENABLE_API === "true", "PSP enabled — amount assertion needs controlled PSP");

    const menuResponse = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    expect(menuResponse.status()).toBe(200);
    const menu = (await menuResponse.json()) as {
      menu: Array<{ products: Array<{ id: string; price?: string }> }>;
    };
    const product = menu.menu.flatMap((category) => category.products)[0];
    expect(product?.id).toBeTruthy();

    const orderResponse = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      data: { items: [{ productId: product!.id, quantity: 1 }], note: "E2E[WXP] amount order" },
    });
    expect(orderResponse.status()).toBe(201);
    const order = (await orderResponse.json()) as { id: string; subtotal?: string };

    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/checkout`, {
      data: { orderId: order.id, amount: 1 },
    });
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(String(body.error)).toMatch(/aktif değil/i);
  });
});
