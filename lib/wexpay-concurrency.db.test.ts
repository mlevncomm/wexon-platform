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
  createBranch,
  createModifierGroup,
  createModifierOption,
  createPayment,
  createProduct,
  createTable,
  createTablesBulk,
  setProductModifierGroups,
  settlePaymentFromProviderWebhook,
  updateBranch,
  updateModifierGroup,
  updateModifierOption,
  updatePayment,
  type WexPayMutationContext,
} from "@/lib/wexpay-service";
import { WexPayAccessError } from "@/lib/wexpay-tenant";
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
      feature_multi_location: true,
    },
    actor: { type: "admin_session", email: `lock-test-${suffix}@wexon.test`, role: "ADMIN" },
    ipAddress: "127.0.0.1",
  };
}

function staffCashierContext(organizationId: string): WexPayMutationContext {
  return {
    organizationId,
    canManage: false,
    entitlementMap: {
      table_limit: 50,
      branch_limit: 10,
      product_limit: 500,
      feature_multi_location: true,
    },
    actor: {
      type: "customer_session",
      userId: `staff-${suffix}`,
      email: `staff-lock-${suffix}@wexon.test`,
      role: "STAFF",
    },
    ipAddress: "127.0.0.1",
  };
}

type Fixture = {
  orgId: string;
  foreignOrgId: string;
  restaurantId: string;
  branchId: string;
  foreignBranchId: string;
  tableId: string;
  categoryId: string;
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
    restaurantId: restaurant.id,
    branchId: branch.id,
    foreignBranchId: foreignBranch.id,
    tableId: table.id,
    categoryId: category.id,
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

  it("denies second active branch when feature_multi_location is off", async () => {
    const ctx: WexPayMutationContext = {
      ...manageContext(fixture.orgId),
      entitlementMap: {
        branch_limit: 5,
        table_limit: 50,
        product_limit: 500,
        feature_multi_location: false,
      },
    };

    await assert.rejects(
      () =>
        createBranch(ctx, {
          restaurantId: fixture.restaurantId,
          name: `Denied ${suffix}`,
          slug: `denied-${suffix}`,
          address: null,
        }),
      (error: unknown) =>
        error instanceof WexPayValidationError && error.message.includes("feature_multi_location"),
    );
  });

  it("enforces product_limit under concurrent createProduct with lock", async () => {
    const current = await prisma.menuProduct.count({
      where: { branch: { restaurant: { organizationId: fixture.orgId } } },
    });
    const limit = current + 1;
    const ctx: WexPayMutationContext = {
      ...manageContext(fixture.orgId),
      entitlementMap: {
        branch_limit: 10,
        table_limit: 50,
        product_limit: limit,
        feature_multi_location: true,
      },
    };

    const attempts = Array.from({ length: 4 }, (_, index) =>
      createProduct(ctx, {
        branchId: fixture.branchId,
        categoryId: fixture.categoryId,
        name: `LockProd ${suffix}-${index}`,
        description: null,
        price: 10,
        imageUrl: null,
        isPopular: false,
      }).then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((row) => row.ok).length;
    const failures = results.filter((row) => !row.ok);
    assert.equal(successes, 1);
    assert.ok(failures.length >= 3);
    for (const failure of failures) {
      assert.ok(failure.error instanceof WexPayValidationError);
    }

    const after = await prisma.menuProduct.count({
      where: { branch: { restaurant: { organizationId: fixture.orgId } } },
    });
    assert.equal(after, limit);
  });

  it("payment create allowlist: manual PAID/PARTIAL only; rejects FAILED/REFUNDED; PayTR PENDING only", async () => {
    await resetTableSession(fixture.tableId);
    await openOrder(200);
    const ctx = manageContext(fixture.orgId);

    const paid = await createPayment(ctx, {
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      orderId: null,
      amount: 40,
      status: PaymentStatus.PAID,
      provider: "manual",
    });
    assert.equal(paid.payment.status, PaymentStatus.PAID);
    assert.equal(paid.externalCheckoutUrl, null);

    const partial = await createPayment(ctx, {
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      orderId: null,
      amount: 30,
      status: PaymentStatus.PARTIAL,
      provider: "manual",
    });
    assert.equal(partial.payment.status, PaymentStatus.PARTIAL);

    for (const status of [PaymentStatus.FAILED, PaymentStatus.REFUNDED, PaymentStatus.PENDING] as const) {
      await assert.rejects(
        () =>
          createPayment(ctx, {
            branchId: fixture.branchId,
            tableId: fixture.tableId,
            orderId: null,
            amount: 10,
            status,
            provider: "manual",
          }),
        (error: unknown) =>
          error instanceof WexPayValidationError && /Manuel ödeme|oluşturulabilir/i.test(error.message),
      );
    }

    await assert.rejects(
      () =>
        createPayment(ctx, {
          branchId: fixture.branchId,
          tableId: fixture.tableId,
          orderId: null,
          amount: 10,
          status: PaymentStatus.PAID,
          provider: "paytr",
        }),
      (error: unknown) =>
        error instanceof WexPayValidationError && /PayTR|Bekliyor/i.test(error.message),
    );
  });

  it("STAFF cannot refund, mutate PAID/REFUNDED, or cross-tenant update", async () => {
    await resetTableSession(fixture.tableId);
    await openOrder(100);
    const admin = manageContext(fixture.orgId);
    const staff = staffCashierContext(fixture.orgId);

    const created = await createPayment(admin, {
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      orderId: null,
      amount: 50,
      status: PaymentStatus.PARTIAL,
      provider: "manual",
    });
    const partialId = created.payment.id;

    await assert.rejects(
      () => updatePayment(staff, { paymentId: partialId, status: PaymentStatus.REFUNDED }),
      (error: unknown) => error instanceof WexPayAccessError && /iade/i.test(error.message),
    );

    await updatePayment(admin, { paymentId: partialId, status: PaymentStatus.PAID });

    await assert.rejects(
      () => updatePayment(staff, { paymentId: partialId, status: PaymentStatus.FAILED }),
      (error: unknown) => error instanceof WexPayAccessError && /değiştiremez/i.test(error.message),
    );

    const refunded = await prisma.payment.create({
      data: {
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        amount: 10,
        currency: "TRY",
        status: PaymentStatus.REFUNDED,
        provider: "manual",
        providerRef: `refunded-${suffix}`,
      },
    });
    await assert.rejects(
      () => updatePayment(staff, { paymentId: refunded.id, status: PaymentStatus.PAID }),
      (error: unknown) => error instanceof WexPayAccessError,
    );

    await assert.rejects(
      () =>
        updatePayment(staffCashierContext(fixture.foreignOrgId), {
          paymentId: partialId,
          status: PaymentStatus.FAILED,
        }),
      (error: unknown) => error instanceof Error,
    );
  });

  it("denies inactive→active branch reactivation when multi-location is off", async () => {
    const ctx: WexPayMutationContext = {
      ...manageContext(fixture.orgId),
      entitlementMap: {
        branch_limit: 5,
        table_limit: 50,
        product_limit: 500,
        feature_multi_location: false,
      },
    };

    const inactive = await prisma.branch.create({
      data: {
        restaurantId: fixture.restaurantId,
        name: `Inactive ${suffix}`,
        slug: `inactive-${suffix}`,
        isActive: false,
      },
    });

    // Already-active legacy branch name update must still succeed.
    await updateBranch(ctx, {
      branchId: fixture.branchId,
      name: `Active Renamed ${suffix}`,
      address: null,
      isActive: true,
    });
    const stillActive = await prisma.branch.findUniqueOrThrow({ where: { id: fixture.branchId } });
    assert.equal(stillActive.isActive, true);

    await assert.rejects(
      () =>
        updateBranch(ctx, {
          branchId: inactive.id,
          name: inactive.name,
          address: null,
          isActive: true,
        }),
      (error: unknown) =>
        error instanceof WexPayValidationError && error.message.includes("feature_multi_location"),
    );

    const unchanged = await prisma.branch.findUniqueOrThrow({ where: { id: inactive.id } });
    assert.equal(unchanged.isActive, false);
  });

  it("serializes concurrent create/reactivate and reactivate/reactivate under multi-location lock", async () => {
    const org = await prisma.organization.create({
      data: { name: `ML Race ${suffix}`, slug: `ml-race-${suffix}`, isActive: true },
    });
    const restaurant = await prisma.restaurant.create({
      data: { organizationId: org.id, name: "MLR", slug: `mlr-${suffix}`, isActive: true },
    });
    const active = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: "Active",
        slug: `ml-active-${suffix}`,
        isActive: true,
      },
    });
    const inactiveA = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: "Inactive A",
        slug: `ml-ia-${suffix}`,
        isActive: false,
      },
    });
    const inactiveB = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: "Inactive B",
        slug: `ml-ib-${suffix}`,
        isActive: false,
      },
    });

    const deniedCtx: WexPayMutationContext = {
      ...manageContext(org.id),
      entitlementMap: {
        branch_limit: 10,
        table_limit: 50,
        product_limit: 500,
        feature_multi_location: false,
      },
    };

    try {
      const createVsReactivate = await Promise.allSettled([
        createBranch(deniedCtx, {
          restaurantId: restaurant.id,
          name: `Race Create ${suffix}`,
          slug: `race-create-${suffix}`,
          address: null,
        }),
        updateBranch(deniedCtx, {
          branchId: inactiveA.id,
          name: inactiveA.name,
          address: null,
          isActive: true,
        }),
      ]);
      const createVsOk = createVsReactivate.filter((row) => row.status === "fulfilled").length;
      assert.equal(createVsOk, 0, "neither create nor reactivate may add a second active branch");

      const dualReactivate = await Promise.allSettled([
        updateBranch(deniedCtx, {
          branchId: inactiveA.id,
          name: inactiveA.name,
          address: null,
          isActive: true,
        }),
        updateBranch(deniedCtx, {
          branchId: inactiveB.id,
          name: inactiveB.name,
          address: null,
          isActive: true,
        }),
      ]);
      const reactivateOk = dualReactivate.filter((row) => row.status === "fulfilled").length;
      assert.equal(reactivateOk, 0);

      const activeCount = await prisma.branch.count({
        where: { restaurantId: restaurant.id, isActive: true },
      });
      assert.equal(activeCount, 1);
      assert.equal((await prisma.branch.findUniqueOrThrow({ where: { id: active.id } })).isActive, true);
    } finally {
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });
});
