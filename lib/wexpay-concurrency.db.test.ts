/**
 * DB-backed concurrency + modifier integrity tests for WexPay.
 *
 * Guard MUST run before any Prisma query.
 * Run via: WEXON_ALLOW_LOCAL_DB_TESTS=1 npm run test:unit:db
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { OrderStatus, PaymentStatus, TableStatus } from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { calculateTableAccount } from "@/lib/wexpay-account";
import {
  createModifierGroup,
  createModifierOption,
  createPayment,
  createTable,
  createTablesBulk,
  setProductModifierGroups,
  settlePaymentFromProviderWebhook,
  updateModifierGroup,
  updateModifierOption,
  updatePayment,
  type WexPayMutationContext,
} from "@/lib/wexpay-service";
import { WexPayValidationError } from "@/lib/wexpay-validation";
import { runWexPayWebhookTransaction } from "@/lib/wexpay-webhook-events";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);

function isDatabaseUnavailable(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    name.startsWith("PrismaClient") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Can't reach database") ||
    message.includes("database")
  );
}

function manageContext(organizationId: string, tableLimit = 50): WexPayMutationContext {
  return {
    organizationId,
    canManage: true,
    entitlementMap: {
      table_limit: tableLimit,
      branch_limit: 10,
      product_limit: 500,
    },
    actor: { type: "admin_session", email: `lock-test-${suffix}@wexon.test`, role: "ADMIN" },
    ipAddress: "127.0.0.1",
  };
}

type Fixture = {
  orgId: string;
  foreignOrgId: string;
  branchId: string;
  foreignBranchId: string;
  tableId: string;
  productId: string;
};

let fixture: Fixture;

async function seedFixture(): Promise<Fixture> {
  const org = await prisma.organization.create({
    data: { name: `Lock Test ${suffix}`, slug: `lock-test-${suffix}`, isActive: true },
  });
  const foreign = await prisma.organization.create({
    data: { name: `Lock Foreign ${suffix}`, slug: `lock-foreign-${suffix}`, isActive: true },
  });
  const restaurant = await prisma.restaurant.create({
    data: { organizationId: org.id, name: "R", slug: `r-${suffix}`, isActive: true },
  });
  const foreignRestaurant = await prisma.restaurant.create({
    data: { organizationId: foreign.id, name: "FR", slug: `fr-${suffix}`, isActive: true },
  });
  const branch = await prisma.branch.create({
    data: { restaurantId: restaurant.id, name: "B", slug: `b-${suffix}`, isActive: true },
  });
  const foreignBranch = await prisma.branch.create({
    data: { restaurantId: foreignRestaurant.id, name: "FB", slug: `fb-${suffix}`, isActive: true },
  });
  const table = await prisma.restaurantTable.create({
    data: {
      branchId: branch.id,
      label: "Masa 1",
      seats: 4,
      qrCode: `LOCK-${suffix}-T1`,
      status: TableStatus.OCCUPIED,
      isActive: true,
    },
  });
  const category = await prisma.menuCategory.create({
    data: { branchId: branch.id, name: "Cat", sortOrder: 0, isActive: true },
  });
  const product = await prisma.menuProduct.create({
    data: {
      branchId: branch.id,
      categoryId: category.id,
      name: "Burger",
      price: 100,
      currency: "TRY",
      isActive: true,
      inStock: true,
    },
  });
  return {
    orgId: org.id,
    foreignOrgId: foreign.id,
    branchId: branch.id,
    foreignBranchId: foreignBranch.id,
    tableId: table.id,
    productId: product.id,
  };
}

async function cleanupFixture(f: Fixture) {
  await prisma.organization.deleteMany({ where: { id: { in: [f.orgId, f.foreignOrgId] } } });
}

async function resetTableSession(tableId: string) {
  await prisma.payment.deleteMany({ where: { tableId } });
  await prisma.customerOrder.deleteMany({ where: { tableId } });
  await prisma.restaurantTable.update({
    where: { id: tableId },
    data: { status: TableStatus.OCCUPIED, lastClosedAt: null },
  });
}

async function openOrder(amount = 100) {
  const order = await prisma.customerOrder.create({
    data: {
      orderNo: `LOCK-${suffix}-${randomUUID().slice(0, 6)}`,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      status: OrderStatus.SERVED,
      subtotal: amount,
      items: {
        create: [
          {
            productId: fixture.productId,
            productName: "Burger",
            quantity: 1,
            unitPrice: amount,
            totalPrice: amount,
          },
        ],
      },
    },
  });
  return order;
}

async function accountSnapshot(tableId: string) {
  const table = await prisma.restaurantTable.findUniqueOrThrow({
    where: { id: tableId },
    include: {
      orders: { select: { status: true, subtotal: true, createdAt: true, receiptRequested: true } },
      payments: { select: { status: true, amount: true, receiptRequested: true, createdAt: true } },
      receiptRequests: { select: { status: true, createdAt: true } },
    },
  });
  return calculateTableAccount({
    orders: table.orders,
    payments: table.payments,
    receiptRequests: table.receiptRequests,
  });
}

describe("wexpay payment concurrency + modifiers (db)", () => {
  before(async () => {
    try {
      fixture = await seedFixture();
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        throw new Error(`Isolated DB required for concurrency tests: ${String(error)}`);
      }
      throw error;
    }
  });

  after(async () => {
    if (fixture) await cleanupFixture(fixture);
  });

  it("allows only one of two concurrent 100 TRY manual payments on a 100 balance", async () => {
    await resetTableSession(fixture.tableId);
    await openOrder(100);
    const ctx = manageContext(fixture.orgId);

    const results = await Promise.allSettled([
      createPayment(ctx, {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        orderId: null,
        amount: 100,
        status: PaymentStatus.PAID,
        provider: "manual",
      }),
      createPayment(ctx, {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        orderId: null,
        amount: 100,
        status: PaymentStatus.PAID,
        provider: "manual",
      }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0] && rejected[0].status === "rejected");
    assert.ok(rejected[0].reason instanceof WexPayValidationError);

    const account = await accountSnapshot(fixture.tableId);
    assert.equal(account.paidAmount, 100);
    assert.equal(account.remainingAmount, 0);
  });

  it("manual payment cannot silently exceed an in-flight PENDING reserve", async () => {
    await resetTableSession(fixture.tableId);
    await openOrder(100);
    await prisma.payment.create({
      data: {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        amount: 100,
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef: `pend-${suffix}`,
      },
    });

    await assert.rejects(
      () =>
        createPayment(manageContext(fixture.orgId), {
          branchId: fixture.branchId,
          tableId: fixture.tableId,
          orderId: null,
          amount: 100,
          status: PaymentStatus.PAID,
          provider: "manual",
        }),
      WexPayValidationError,
    );

    const account = await accountSnapshot(fixture.tableId);
    assert.equal(account.remainingAmount, 0);
    assert.equal(account.hasPendingPayments, true);
    assert.equal(account.paidAmount, 0);
  });

  it("concurrent settle of overlapping PENDING amounts rejects overpayment", async () => {
    await resetTableSession(fixture.tableId);
    await openOrder(100);
    const a = await prisma.payment.create({
      data: {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        amount: 100,
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef: `settle-a-${suffix}`,
      },
    });
    const b = await prisma.payment.create({
      data: {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        amount: 100,
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef: `settle-b-${suffix}`,
      },
    });

    const results = await Promise.allSettled([
      runWexPayWebhookTransaction((tx) =>
        settlePaymentFromProviderWebhook(
          {
            paymentId: a.id,
            organizationId: fixture.orgId,
            status: PaymentStatus.PAID,
            provider: "paytr",
            providerRef: a.providerRef!,
            webhookEventId: `evt-a-${suffix}`,
          },
          tx,
        ),
      ),
      runWexPayWebhookTransaction((tx) =>
        settlePaymentFromProviderWebhook(
          {
            paymentId: b.id,
            organizationId: fixture.orgId,
            status: PaymentStatus.PAID,
            provider: "paytr",
            providerRef: b.providerRef!,
            webhookEventId: `evt-b-${suffix}`,
          },
          tx,
        ),
      ),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(rejected.length, 1);

    const account = await accountSnapshot(fixture.tableId);
    assert.ok(account.paidAmount <= 100 + 0.001);
  });

  it("webhook settle is idempotent on terminal payments", async () => {
    await resetTableSession(fixture.tableId);
    await openOrder(100);
    const payment = await prisma.payment.create({
      data: {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        amount: 100,
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef: `idem-${suffix}`,
      },
    });

    const first = await runWexPayWebhookTransaction((tx) =>
      settlePaymentFromProviderWebhook(
        {
          paymentId: payment.id,
          organizationId: fixture.orgId,
          status: PaymentStatus.PAID,
          provider: "paytr",
          providerRef: payment.providerRef!,
          webhookEventId: `evt-idem-1-${suffix}`,
        },
        tx,
      ),
    );
    assert.equal(first.skipped, false);

    const second = await runWexPayWebhookTransaction((tx) =>
      settlePaymentFromProviderWebhook(
        {
          paymentId: payment.id,
          organizationId: fixture.orgId,
          status: PaymentStatus.PAID,
          provider: "paytr",
          providerRef: payment.providerRef!,
          webhookEventId: `evt-idem-2-${suffix}`,
        },
        tx,
      ),
    );
    assert.equal(second.skipped, true);

    const account = await accountSnapshot(fixture.tableId);
    assert.equal(account.paidAmount, 100);
  });

  it("FAILED external intent releases PENDING reserve for reuse", async () => {
    await resetTableSession(fixture.tableId);
    await openOrder(100);
    const payment = await prisma.payment.create({
      data: {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        amount: 100,
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef: `fail-${suffix}`,
      },
    });

    await updatePayment(manageContext(fixture.orgId), {
      paymentId: payment.id,
      status: PaymentStatus.FAILED,
    });

    const afterFail = await accountSnapshot(fixture.tableId);
    assert.equal(afterFail.remainingAmount, 100);
    assert.equal(afterFail.hasPendingPayments, false);

    await createPayment(manageContext(fixture.orgId), {
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      orderId: null,
      amount: 100,
      status: PaymentStatus.PAID,
      provider: "manual",
    });

    const afterReuse = await accountSnapshot(fixture.tableId);
    assert.equal(afterReuse.paidAmount, 100);
    assert.equal(afterReuse.remainingAmount, 0);
  });

  it("rejects foreign-tenant payment and table access", async () => {
    await resetTableSession(fixture.tableId);
    await openOrder(50);
    const payment = await prisma.payment.create({
      data: {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        amount: 50,
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef: `xorg-${suffix}`,
      },
    });

    await assert.rejects(
      () =>
        updatePayment(manageContext(fixture.foreignOrgId), {
          paymentId: payment.id,
          status: PaymentStatus.FAILED,
        }),
      (error: unknown) => error instanceof Error,
    );

    await assert.rejects(
      () =>
        createPayment(manageContext(fixture.foreignOrgId), {
          branchId: fixture.branchId,
          tableId: fixture.tableId,
          orderId: null,
          amount: 10,
          status: PaymentStatus.PAID,
          provider: "manual",
        }),
      (error: unknown) => error instanceof Error,
    );
  });

  it("concurrent single + bulk table create cannot exceed table_limit", async () => {
    const limitOrg = await prisma.organization.create({
      data: { name: `Limit Org ${suffix}`, slug: `limit-org-${suffix}`, isActive: true },
    });
    const restaurant = await prisma.restaurant.create({
      data: { organizationId: limitOrg.id, name: "LR", slug: `lr-${suffix}`, isActive: true },
    });
    const branch = await prisma.branch.create({
      data: { restaurantId: restaurant.id, name: "LB", slug: `lb-${suffix}`, isActive: true },
    });
    await prisma.restaurantTable.create({
      data: {
        branchId: branch.id,
        label: "Seed",
        seats: 2,
        qrCode: `LIMIT-SEED-${suffix}`,
        status: TableStatus.EMPTY,
        isActive: true,
      },
    });

    try {
      const ctx = manageContext(limitOrg.id, 3);
      const results = await Promise.allSettled([
        createTablesBulk(ctx, {
          branchId: branch.id,
          prefix: `BulkA${suffix.slice(0, 4)}`,
          count: 2,
          seats: 2,
          startNumber: 10,
        }),
        createTable(ctx, {
          branchId: branch.id,
          label: `Solo ${suffix}`,
          seats: 2,
        }),
        createTablesBulk(ctx, {
          branchId: branch.id,
          prefix: `BulkB${suffix.slice(0, 4)}`,
          count: 2,
          seats: 2,
          startNumber: 20,
        }),
      ]);

      const ok = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      assert.ok(ok.length >= 1);
      assert.ok(rejected.length >= 1);

      const after = await prisma.restaurantTable.count({
        where: { branch: { restaurant: { organizationId: limitOrg.id } } },
      });
      assert.ok(after <= 3);
    } finally {
      await prisma.organization.delete({ where: { id: limitOrg.id } });
    }
  });

  it("bulk unique conflict rolls back with zero partial rows", async () => {
    const prefix = `Dup${suffix.slice(0, 4)}`;
    await createTable(manageContext(fixture.orgId, 50), {
      branchId: fixture.branchId,
      label: `${prefix} 01`,
      seats: 2,
    });
    const before = await prisma.restaurantTable.count({
      where: { branchId: fixture.branchId, label: { startsWith: prefix } },
    });

    await assert.rejects(
      () =>
        createTablesBulk(manageContext(fixture.orgId, 50), {
          branchId: fixture.branchId,
          prefix,
          count: 2,
          seats: 2,
          startNumber: 1,
        }),
      WexPayValidationError,
    );

    const after = await prisma.restaurantTable.count({
      where: { branchId: fixture.branchId, label: { startsWith: prefix } },
    });
    assert.equal(after, before);
  });

  it("modifier group/option CRUD + link/unlink with rollback on foreign tenant", async () => {
    const ctx = manageContext(fixture.orgId);
    const group = await createModifierGroup(ctx, {
      branchId: fixture.branchId,
      name: `Boyut ${suffix}`,
      selectionType: "SINGLE",
      minSelect: 1,
      maxSelect: 1,
    });
    const option = await createModifierOption(ctx, {
      groupId: group.id,
      name: "Büyük",
      priceDelta: 15,
    });
    await updateModifierOption(ctx, {
      optionId: option.id,
      name: "Büyük+",
      priceDelta: 20,
      isActive: true,
    });
    await setProductModifierGroups(ctx, {
      productId: fixture.productId,
      groupIds: [group.id],
    });

    const linked = await prisma.menuProductModifierGroup.findMany({
      where: { productId: fixture.productId, groupId: group.id },
    });
    assert.equal(linked.length, 1);

    await setProductModifierGroups(ctx, { productId: fixture.productId, groupIds: [] });
    const unlinked = await prisma.menuProductModifierGroup.findMany({
      where: { productId: fixture.productId, groupId: group.id },
    });
    assert.equal(unlinked.length, 0);

    await updateModifierGroup(ctx, {
      groupId: group.id,
      name: `Boyut ${suffix}`,
      selectionType: "SINGLE",
      minSelect: 1,
      maxSelect: 1,
      isActive: false,
    });

    await assert.rejects(
      () =>
        createModifierGroup(manageContext(fixture.foreignOrgId), {
          branchId: fixture.branchId,
          name: `Hack ${suffix}`,
          selectionType: "SINGLE",
          minSelect: 0,
          maxSelect: 1,
        }),
      (error: unknown) => error instanceof Error,
    );

    await assert.rejects(
      () =>
        createModifierOption(manageContext(fixture.foreignOrgId), {
          groupId: group.id,
          name: "Hack",
          priceDelta: 1,
        }),
      (error: unknown) => error instanceof Error,
    );

    // Error path: invalid foreign product link must not leave half-written links.
    await setProductModifierGroups(ctx, { productId: fixture.productId, groupIds: [group.id] });
    await assert.rejects(
      () =>
        setProductModifierGroups(ctx, {
          productId: fixture.productId,
          groupIds: [group.id, "missing-group-id"],
        }),
      (error: unknown) => error instanceof Error,
    );
    const stillLinked = await prisma.menuProductModifierGroup.findMany({
      where: { productId: fixture.productId },
    });
    assert.equal(stillLinked.length, 1);
    assert.equal(stillLinked[0]?.groupId, group.id);
  });

  it("creates unique QR codes for bulk tables and never writes foreign org", async () => {
    const created = await createTablesBulk(manageContext(fixture.orgId, 50), {
      branchId: fixture.branchId,
      prefix: `QR${suffix.slice(0, 4)}`,
      count: 3,
      seats: 2,
      startNumber: 100,
    });
    const qrCodes = created.map((t) => t.qrCode);
    assert.equal(new Set(qrCodes).size, qrCodes.length);
    for (const table of created) {
      assert.equal(table.branchId, fixture.branchId);
    }

    await assert.rejects(
      () =>
        createTablesBulk(manageContext(fixture.orgId, 50), {
          branchId: fixture.foreignBranchId,
          prefix: "X",
          count: 1,
          seats: 2,
          startNumber: 1,
        }),
      (error: unknown) => error instanceof Error,
    );
  });
});
