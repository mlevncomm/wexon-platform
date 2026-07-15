import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";
import {
  cleanupAfterSuite,
  ensureRunArtifact,
  skipUnlessIsolatedMutation,
  trackIdempotencyKey,
  trackOrderId,
} from "./wexpay-mutation-helpers";

/**
 * Isolated-only modifier validation / snapshot / pricing regression suite.
 * Creates orders via public + cashier APIs. No production mutation.
 */
test.describe.serial("wexpay modifiers (isolated)", () => {
  const fixtures = loadFixtures();
  const artifact = ensureRunArtifact();

  test.afterAll(() => {
    cleanupAfterSuite();
  });

  function createPrisma() {
    const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
  }

  test("menu exposes modifier groups; required validates; snapshot survives catalog edit", async ({
    request,
    page,
  }) => {
    skipUnlessIsolatedMutation();

    const qr = fixtures.qrCode!;
    const menuRes = await request.get(`/api/wexpay/public/${encodeURIComponent(qr)}`);
    expect(menuRes.status()).toBe(200);
    const menu = await menuRes.json();
    expect(JSON.stringify(menu)).not.toMatch(/organizationId|riskReasons|branchId|DATABASE_URL/i);

    const products = menu.menu.flatMap(
      (category: { products: Array<Record<string, unknown>> }) => category.products,
    ) as Array<Record<string, unknown>>;
    const mercimek = products.find((product) => String(product.name).includes("Mercimek"));
    const izgara = products.find((product) => String(product.name).includes("Izgara"));
    expect(mercimek).toBeTruthy();
    expect(izgara).toBeTruthy();

    const mercimekGroups = (mercimek!.modifierGroups ?? []) as Array<{
      id: string;
      name: string;
      selectionType: string;
      minSelect: number;
      maxSelect: number;
      options: Array<{ id: string; name: string; priceDelta: number }>;
    }>;
    expect(mercimekGroups.length).toBeGreaterThan(0);
    expect(mercimekGroups[0]?.selectionType).toBe("SINGLE");
    expect(mercimekGroups[0]?.minSelect).toBe(1);

    const sizeStd = mercimekGroups[0]?.options.find((option) => option.name === "Standart");
    const sizeLarge = mercimekGroups[0]?.options.find((option) => option.name === "Büyük");
    expect(sizeStd && sizeLarge).toBeTruthy();
    expect(sizeLarge!.priceDelta).toBe(25);

    const requiredFail = await request.post(`/api/wexpay/public/${encodeURIComponent(qr)}/order`, {
      data: { items: [{ productId: mercimek!.id, quantity: 1 }], note: artifact.note },
    });
    expect(requiredFail.status()).toBeGreaterThanOrEqual(400);
    expect(requiredFail.status()).toBeLessThan(500);
    const failBody = await requiredFail.json();
    expect(String(failBody.error ?? "")).toMatch(/Boyut|seçim/i);
    expect(JSON.stringify(failBody)).not.toMatch(/Prisma|organizationId|postgresql/i);

    const idemKey = `mod-guest-${artifact.runId}`;
    trackIdempotencyKey(`qr-order:${idemKey}`);
    const basePrice = Number(mercimek!.price);
    const orderRes = await request.post(`/api/wexpay/public/${encodeURIComponent(qr)}/order`, {
      headers: { "Idempotency-Key": idemKey },
      data: {
        items: [
          {
            productId: mercimek!.id,
            quantity: 1,
            modifierOptionIds: [sizeLarge!.id],
          },
        ],
        note: artifact.note,
      },
    });
    expect(orderRes.status()).toBe(201);
    const orderBody = await orderRes.json();
    trackOrderId(orderBody.orderId);
    expect(orderBody.subtotal).toBe(basePrice + 25);

    const replay = await request.post(`/api/wexpay/public/${encodeURIComponent(qr)}/order`, {
      headers: { "Idempotency-Key": idemKey },
      data: {
        items: [{ productId: mercimek!.id, quantity: 1, modifierOptionIds: [sizeLarge!.id] }],
        note: artifact.note,
      },
    });
    expect(replay.status()).toBe(201);
    const replayBody = await replay.json();
    expect(replayBody.orderId).toBe(orderBody.orderId);

    const { prisma, pool } = createPrisma();
    try {
      const order = await prisma.customerOrder.findUnique({
        where: { id: orderBody.orderId },
        include: {
          items: { include: { modifiers: true } },
        },
      });
      expect(order).toBeTruthy();
      expect(Number(order!.subtotal)).toBe(basePrice + 25);
      const line = order!.items[0];
      expect(line).toBeTruthy();
      expect(Number(line!.unitPrice)).toBe(basePrice);
      expect(Number(line!.totalPrice)).toBe(basePrice + 25);
      expect(line!.modifiers).toHaveLength(1);
      expect(line!.modifiers[0]?.optionName).toBe("Büyük");
      expect(Number(line!.modifiers[0]?.priceDelta)).toBe(25);

      // Mutate catalog — historical snapshot must not change.
      await prisma.menuModifierOption.update({
        where: { id: sizeLarge!.id },
        data: { name: "XXL-TEMP", priceDelta: "99.00" },
      });

      const after = await prisma.customerOrder.findUnique({
        where: { id: orderBody.orderId },
        include: { items: { include: { modifiers: true } } },
      });
      expect(Number(after!.subtotal)).toBe(basePrice + 25);
      expect(after!.items[0]!.modifiers[0]?.optionName).toBe("Büyük");
      expect(Number(after!.items[0]!.modifiers[0]?.priceDelta)).toBe(25);

      await prisma.menuModifierOption.update({
        where: { id: sizeLarge!.id },
        data: { name: "Büyük", priceDelta: "25.00" },
      });

      // Cross-branch option rejection: create disposable branch option.
      const table = await prisma.restaurantTable.findFirst({ where: { qrCode: qr } });
      expect(table).toBeTruthy();
      const foreignBranch = await prisma.branch.create({
        data: {
          restaurantId: (
            await prisma.branch.findUniqueOrThrow({ where: { id: table!.branchId } })
          ).restaurantId,
          name: `E2E Foreign ${artifact.runId}`,
          slug: `e2e-foreign-${artifact.runId}`.slice(0, 60),
          isActive: true,
        },
      });
      const foreignGroup = await prisma.menuModifierGroup.create({
        data: {
          branchId: foreignBranch.id,
          name: "Foreign Size",
          selectionType: "SINGLE",
          minSelect: 1,
          maxSelect: 1,
          isActive: true,
        },
      });
      const foreignOption = await prisma.menuModifierOption.create({
        data: {
          groupId: foreignGroup.id,
          name: "Foreign",
          priceDelta: "1.00",
          isActive: true,
        },
      });

      const cross = await request.post(`/api/wexpay/public/${encodeURIComponent(qr)}/order`, {
        data: {
          items: [{ productId: mercimek!.id, quantity: 1, modifierOptionIds: [foreignOption.id] }],
          note: artifact.note,
        },
      });
      expect(cross.status()).toBeGreaterThanOrEqual(400);

      await prisma.menuModifierOption.delete({ where: { id: foreignOption.id } });
      await prisma.menuModifierGroup.delete({ where: { id: foreignGroup.id } });
      await prisma.branch.delete({ where: { id: foreignBranch.id } });
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }

    // Cashier createOrder path (shared resolveOrderItems) via production API.
    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    const tableRes = await page.request.get(`/api/wexpay/public/${encodeURIComponent(qr)}`);
    const tableBody = await tableRes.json();
    const izgaraGroups = (izgara!.modifierGroups ?? []) as Array<{
      options: Array<{ id: string; name: string; priceDelta: number }>;
    }>;
    const cheese = izgaraGroups.flatMap((group) => group.options).find((option) => option.name === "Peynir");
    expect(cheese).toBeTruthy();

    const cashierOrder = await page.request.post("/api/wexpay/orders", {
      data: {
        branchId: tableBody.branch.id,
        tableId: tableBody.table.id,
        note: `${artifact.note} cashier-wave`,
        items: [
          {
            productId: izgara!.id,
            quantity: 1,
            modifierOptionIds: [cheese!.id],
          },
        ],
      },
    });
    expect(cashierOrder.status()).toBe(201);
    const cashierBody = await cashierOrder.json();
    trackOrderId(cashierBody.id);
    expect(cashierBody.subtotal).toBe(Number(izgara!.price) + Number(cheese!.priceDelta));
  });
});
