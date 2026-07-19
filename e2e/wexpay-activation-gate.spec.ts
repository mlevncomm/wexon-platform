import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadFixtures } from "./helpers";

/**
 * Public-live gate: journey must be ACTIVE. Does not relax the gate —
 * temporarily flips fixture journey to IN_PROGRESS then restores.
 */
test.describe.serial("wexpay activation public gate", () => {
  const fixtures = loadFixtures();

  test("public menu/order/checkout/bill closed while journey is not ACTIVE", async ({ request }) => {
    test.setTimeout(120_000);
    test.skip(!fixtures.dbAvailable || !fixtures.fixturesReady || !fixtures.qrCode || !fixtures.realOrgId, "fixtures required");

    const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    if (!databaseUrl) test.skip(true, "DATABASE_URL required");

    const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });
    const product = await prisma.product.findFirst({ where: { key: "wexpay" }, select: { id: true } });
    expect(product).toBeTruthy();

    const journey = await prisma.activationJourney.findUnique({
      where: {
        organizationId_productId: {
          organizationId: fixtures.realOrgId!,
          productId: product!.id,
        },
      },
    });
    expect(journey, "seed must create ACTIVE ActivationJourney for real tenant").toBeTruthy();
    expect(journey!.status).toBe("ACTIVE");

    const previous = {
      status: journey!.status,
      completedAt: journey!.completedAt,
      source: journey!.source,
    };
    const qr = encodeURIComponent(fixtures.qrCode!);

    try {
      await prisma.activationJourney.update({
        where: { id: journey!.id },
        data: { status: "IN_PROGRESS", completedAt: null },
      });

      const menu = await request.get(`/api/wexpay/public/${qr}`);
      expect(menu.status()).toBe(403);
      expect((await menu.json()).reason).toBe("access_closed");

      const order = await request.post(`/api/wexpay/public/${qr}/order`, {
        data: { items: [] },
      });
      expect(order.status()).toBe(403);
      expect((await order.json()).reason).toBe("access_closed");

      const checkout = await request.post(`/api/wexpay/public/${qr}/checkout`, {
        data: { orderId: "gate-closed-order" },
        headers: { "Idempotency-Key": `gate-closed-${Date.now()}` },
      });
      expect(checkout.status()).toBe(403);
      expect((await checkout.json()).reason).toBe("access_closed");

      const bill = await request.get(`/api/wexpay/public/${qr}/bill`);
      expect(bill.status()).toBe(403);
      expect((await bill.json()).reason).toBe("access_closed");
    } finally {
      await prisma.activationJourney.update({
        where: { id: journey!.id },
        data: previous,
      });
      await prisma.$disconnect();
    }

    const restored = await request.get(`/api/wexpay/public/${qr}`);
    expect(restored.status()).toBe(200);
  });
});
