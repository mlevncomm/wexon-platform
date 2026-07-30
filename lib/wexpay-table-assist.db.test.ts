/**
 * DB-backed TableAssistRequest domain tests (PR-A / PLAN §9.1).
 * Guard MUST run before any Prisma query.
 * Run via: WEXON_ALLOW_LOCAL_DB_TESTS=1 npm run test:unit:db
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import {
  OrderStatus,
  PaymentStatus,
  TableAssistKind,
  TableAssistStatus,
  TableStatus,
} from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  acknowledgeTableAssistRequest as acknowledgeAssistDomain,
  assertPublicPaymentRequestPreconditions,
  createStructuredTableAssistRequest,
  maybeResolveTableAssistRequestOnPayment,
  releaseTableAssistRequest as releaseAssistDomain,
  type AssistMutationContext,
} from "@/lib/wexpay-table-assist";
import {
  acknowledgeTableAssistRequest,
  createPayment,
  createPublicTableAssistNotification,
  releaseTableAssistRequest,
  type WexPayMutationContext,
} from "@/lib/wexpay-service";
import { requireWexPayApiContext } from "@/lib/wexpay-api-guard";
import { hashApiKey } from "@/lib/wexon-api-key-hash";
import { WexPayAccessError } from "@/lib/wexpay-tenant";
import { WexPayValidationError } from "@/lib/wexpay-validation";
import { isPaymentRequestV2Enabled } from "@/lib/wexpay-payment-request-flags";
import { canAccessWexPay, canOperateCashierWexPay } from "@/lib/wexpay-auth";

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

let ownerUserId = "";
let staffUserId = "";
let otherStaffUserId = "";

type Fixture = {
  orgId: string;
  restaurantId: string;
  branchId: string;
  tableId: string;
  productId: string;
};

let fixture: Fixture;

function manageContext(organizationId: string): WexPayMutationContext {
  return {
    organizationId,
    canManage: true,
    entitlementMap: {
      table_limit: 50,
      branch_limit: 10,
      product_limit: 500,
      feature_multi_location: true,
    },
    actor: {
      type: "customer_session",
      userId: ownerUserId,
      email: `assist-owner-${suffix}@wexon.test`,
      role: "OWNER",
    },
    ipAddress: "127.0.0.1",
  };
}

function staffAssistContext(organizationId: string, userId: string): AssistMutationContext {
  return {
    organizationId,
    canManage: false,
    actorUserId: userId,
    ipAddress: "127.0.0.1",
  };
}

function staffCashierMutationContext(organizationId: string, userId: string): WexPayMutationContext {
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
      userId,
      email: `assist-staff-${suffix}@wexon.test`,
      role: "STAFF",
    },
    ipAddress: "127.0.0.1",
  };
}

function viewerMutationContext(organizationId: string, userId: string): WexPayMutationContext {
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
      userId,
      email: `assist-viewer-${suffix}@wexon.test`,
      role: "VIEWER",
    },
    ipAddress: "127.0.0.1",
  };
}

function billingMutationContext(organizationId: string, userId: string): WexPayMutationContext {
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
      userId,
      email: `assist-billing-${suffix}@wexon.test`,
      role: "BILLING",
    },
    ipAddress: "127.0.0.1",
  };
}

async function seedFixture(): Promise<Fixture> {
  const owner = await prisma.user.create({
    data: {
      email: `assist-owner-${suffix}@wexon.test`,
      name: "Assist Owner",
      isActive: true,
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: `assist-staff-${suffix}@wexon.test`,
      name: "Assist Staff",
      isActive: true,
    },
  });
  const otherStaff = await prisma.user.create({
    data: {
      email: `assist-staff2-${suffix}@wexon.test`,
      name: "Other Staff",
      isActive: true,
    },
  });
  ownerUserId = owner.id;
  staffUserId = staff.id;
  otherStaffUserId = otherStaff.id;

  const org = await prisma.organization.create({
    data: {
      name: `Assist Test ${suffix}`,
      slug: `assist-test-${suffix}`,
      isActive: true,
      paymentRequestV2Enabled: true,
    },
  });
  await prisma.membership.createMany({
    data: [
      {
        organizationId: org.id,
        userId: owner.id,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: staff.id,
        role: "STAFF",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: otherStaff.id,
        role: "STAFF",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    ],
  });
  const restaurant = await prisma.restaurant.create({
    data: { organizationId: org.id, name: "R", slug: `ar-${suffix}`, isActive: true },
  });
  const branch = await prisma.branch.create({
    data: { restaurantId: restaurant.id, name: "B", slug: `ab-${suffix}`, isActive: true },
  });
  const table = await prisma.restaurantTable.create({
    data: {
      branchId: branch.id,
      label: "Masa A",
      seats: 4,
      qrCode: `ASSIST-${suffix}-T1`,
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
    restaurantId: restaurant.id,
    branchId: branch.id,
    tableId: table.id,
    productId: product.id,
  };
}

async function cleanupFixture(f: Fixture) {
  await prisma.organization.deleteMany({ where: { id: f.orgId } });
  await prisma.user.deleteMany({
    where: { id: { in: [ownerUserId, staffUserId, otherStaffUserId] } },
  });
}

async function resetTable() {
  await prisma.tableAssistRequest.deleteMany({ where: { tableId: fixture.tableId } });
  await prisma.payment.deleteMany({ where: { tableId: fixture.tableId } });
  await prisma.customerOrder.deleteMany({ where: { tableId: fixture.tableId } });
  await prisma.businessNotification.deleteMany({ where: { branchId: fixture.branchId } });
  await prisma.restaurantTable.update({
    where: { id: fixture.tableId },
    data: { status: TableStatus.OCCUPIED, lastClosedAt: null },
  });
}

async function openOrder(amount = 100) {
  return prisma.customerOrder.create({
    data: {
      orderNo: `ASSIST-${suffix}-${randomUUID().slice(0, 6)}`,
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
}

describe("table assist request domain", () => {
  before(async () => {
    try {
      fixture = await seedFixture();
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        console.warn("[skip] database unavailable for table-assist db tests");
        fixture = null as unknown as Fixture;
        return;
      }
      throw error;
    }
  });

  after(async () => {
    if (!fixture) return;
    await cleanupFixture(fixture);
  });

  it("expires stale OPEN request before creating a new payment request", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);

    const stale = await prisma.tableAssistRequest.create({
      data: {
        organizationId: fixture.orgId,
        branchId: fixture.branchId,
        tableId: fixture.tableId,
        kind: TableAssistKind.PAYMENT_REQUEST,
        paymentMethod: "CASH",
        mode: "full_bill",
        status: TableAssistStatus.OPEN,
        requestedAmount: 100,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const created = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "PHYSICAL_POS",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });

    assert.equal(created.alreadyOpen, false);
    assert.notEqual(created.requestId, stale.id);

    const staleRow = await prisma.tableAssistRequest.findUniqueOrThrow({ where: { id: stale.id } });
    assert.equal(staleRow.status, TableAssistStatus.CANCELLED);

    const fresh = await prisma.tableAssistRequest.findUniqueOrThrow({
      where: { id: created.requestId },
    });
    assert.equal(fresh.status, TableAssistStatus.OPEN);
    assert.equal(fresh.paymentMethod, "PHYSICAL_POS");
  });

  it("returns alreadyOpen with existing paymentMethod on dual request", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);

    const first = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "CASH",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });
    assert.equal(first.alreadyOpen, false);

    const second = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "PHYSICAL_POS",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });
    assert.equal(second.alreadyOpen, true);
    assert.equal(second.requestId, first.requestId);
    assert.equal(second.existing?.paymentMethod, "CASH");
  });

  it("acknowledge: first wins, second gets conflict display name", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);
    const created = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "CASH",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });

    const first = await acknowledgeAssistDomain(
      staffAssistContext(fixture.orgId, staffUserId),
      { requestId: created.requestId },
    );
    assert.equal(first.acknowledged, true);

    const second = await acknowledgeAssistDomain(
      staffAssistContext(fixture.orgId, otherStaffUserId),
      { requestId: created.requestId },
    );
    assert.equal(second.acknowledged, false);
    if (!second.acknowledged) {
      assert.equal(second.conflict.acknowledgedByDisplayName, "Assist Staff");
    }

    const row = await prisma.tableAssistRequest.findUniqueOrThrow({
      where: { id: created.requestId },
    });
    assert.equal(row.status, TableAssistStatus.ACKNOWLEDGED);
    assert.ok(row.expiresAt.getTime() > Date.now() + 8 * 60 * 1000);
  });

  it("release: only owner or manager; extends expiresAt", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);
    const created = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "CASH",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });
    await acknowledgeAssistDomain(staffAssistContext(fixture.orgId, staffUserId), {
      requestId: created.requestId,
    });

    await assert.rejects(
      () =>
        releaseAssistDomain(staffAssistContext(fixture.orgId, otherStaffUserId), {
          requestId: created.requestId,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );

    const released = await releaseAssistDomain(
      staffAssistContext(fixture.orgId, staffUserId),
      { requestId: created.requestId },
    );
    assert.equal(released.released, true);

    const row = await prisma.tableAssistRequest.findUniqueOrThrow({
      where: { id: created.requestId },
    });
    assert.equal(row.status, TableAssistStatus.OPEN);
    assert.equal(row.acknowledgedByUserId, null);
    assert.ok(row.releasedAt);
    assert.ok(row.expiresAt.getTime() > Date.now() + 8 * 60 * 1000);
  });

  it("resolve only when PAID and remainingAmount is 0", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);
    const created = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "CASH",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });

    await prisma.$transaction(async (tx) => {
      await maybeResolveTableAssistRequestOnPayment(tx, {
        tableId: fixture.tableId,
        payment: { id: "pending-probe", status: PaymentStatus.PENDING },
        organizationId: fixture.orgId,
      });
    });
    let row = await prisma.tableAssistRequest.findUniqueOrThrow({ where: { id: created.requestId } });
    assert.equal(row.status, TableAssistStatus.OPEN);

    const partial = await createPayment(manageContext(fixture.orgId), {
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      orderId: null,
      amount: 40,
      status: PaymentStatus.PAID,
      provider: "manual",
    });
    row = await prisma.tableAssistRequest.findUniqueOrThrow({ where: { id: created.requestId } });
    assert.equal(row.status, TableAssistStatus.OPEN);
    assert.ok(partial.payment);

    await createPayment(manageContext(fixture.orgId), {
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      orderId: null,
      amount: 60,
      status: PaymentStatus.PAID,
      provider: "manual",
    });
    row = await prisma.tableAssistRequest.findUniqueOrThrow({ where: { id: created.requestId } });
    assert.equal(row.status, TableAssistStatus.RESOLVED);
    assert.ok(row.resolvedPaymentId);
  });

  it("§8.1 gates: no remaining / closed table / no recent order", async () => {
    if (!fixture) return;
    await resetTable();

    await assert.rejects(
      () =>
        assertPublicPaymentRequestPreconditions({
          organizationId: fixture.orgId,
          branchId: fixture.branchId,
          tableId: fixture.tableId,
        }),
      (error: unknown) =>
        error instanceof WexPayValidationError &&
        error.message.includes("ödenecek açık bir hesap"),
    );

    await openOrder(100);
    await prisma.restaurantTable.update({
      where: { id: fixture.tableId },
      data: { status: TableStatus.CLOSED },
    });
    await assert.rejects(
      () =>
        assertPublicPaymentRequestPreconditions({
          organizationId: fixture.orgId,
          branchId: fixture.branchId,
          tableId: fixture.tableId,
        }),
      (error: unknown) =>
        error instanceof WexPayValidationError && error.message.includes("uygun değil"),
    );

    await prisma.restaurantTable.update({
      where: { id: fixture.tableId },
      data: { status: TableStatus.OCCUPIED },
    });
    await prisma.customerOrder.updateMany({
      where: { tableId: fixture.tableId },
      data: { createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000) },
    });
    await assert.rejects(
      () =>
        assertPublicPaymentRequestPreconditions({
          organizationId: fixture.orgId,
          branchId: fixture.branchId,
          tableId: fixture.tableId,
        }),
      (error: unknown) =>
        error instanceof WexPayValidationError && error.message.includes("yakın zamanda sipariş"),
    );
  });

  it("service: STAFF cashier can acknowledge and release own request", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);
    const created = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "CASH",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });

    const staffCtx = staffCashierMutationContext(fixture.orgId, staffUserId);
    assert.equal(canAccessWexPay("STAFF"), true);
    assert.equal(canOperateCashierWexPay("STAFF"), true);

    const ack = await acknowledgeTableAssistRequest(staffCtx, { requestId: created.requestId });
    assert.equal(ack.acknowledged, true);

    const released = await releaseTableAssistRequest(staffCtx, { requestId: created.requestId });
    assert.equal(released.released, true);
  });

  it("service: other STAFF cannot release; manager can release", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);
    const created = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "PHYSICAL_POS",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });

    await acknowledgeTableAssistRequest(staffCashierMutationContext(fixture.orgId, staffUserId), {
      requestId: created.requestId,
    });

    await assert.rejects(
      () =>
        releaseTableAssistRequest(staffCashierMutationContext(fixture.orgId, otherStaffUserId), {
          requestId: created.requestId,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );

    const managerRelease = await releaseTableAssistRequest(manageContext(fixture.orgId), {
      requestId: created.requestId,
    });
    assert.equal(managerRelease.released, true);
  });

  it("service: VIEWER and BILLING cannot mutate assist requests", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);
    const created = await createStructuredTableAssistRequest({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      paymentMethod: "CASH",
      mode: "full_bill",
      ipAddress: "127.0.0.1",
    });

    assert.equal(canAccessWexPay("VIEWER"), true);
    assert.equal(canOperateCashierWexPay("VIEWER"), false);
    assert.equal(canAccessWexPay("BILLING"), false);
    assert.equal(canOperateCashierWexPay("BILLING"), false);

    await assert.rejects(
      () =>
        acknowledgeTableAssistRequest(viewerMutationContext(fixture.orgId, otherStaffUserId), {
          requestId: created.requestId,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
    await assert.rejects(
      () =>
        acknowledgeTableAssistRequest(billingMutationContext(fixture.orgId, otherStaffUserId), {
          requestId: created.requestId,
        }),
      (error: unknown) => error instanceof WexPayAccessError,
    );
  });

  it("api guard: read-only API key cannot call wexpay:write assist mutations", async () => {
    if (!fixture) return;

    const product = await prisma.product.findFirst({ where: { key: "wexpay", isActive: true } });
    assert.ok(product, "wexpay product must exist in local seed");
    const plan = await prisma.plan.findFirst({
      where: {
        productId: product.id,
        isActive: true,
        OR: [{ tierKey: "essential" }, { key: "wexpay_essential" }],
      },
      orderBy: { sortOrder: "asc" },
    });
    assert.ok(plan, "essential plan must exist");

    const license = await prisma.license.create({
      data: {
        organizationId: fixture.orgId,
        productId: product.id,
        planId: plan.id,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.appInstallation.create({
      data: {
        organizationId: fixture.orgId,
        productId: product.id,
        licenseId: license.id,
        status: "ACTIVE",
      },
    });

    const rawKey = `wx_test_read_${suffix}_${randomUUID().slice(0, 8)}`;
    await prisma.apiKey.create({
      data: {
        organizationId: fixture.orgId,
        productId: product.id,
        userId: ownerUserId,
        name: `assist-read-${suffix}`,
        prefix: rawKey.slice(0, 12),
        hashedKey: hashApiKey(rawKey),
        scopes: ["wexpay:read"],
      },
    });

    const request = new Request("http://localhost/api/wexpay/assist-requests/x/acknowledge", {
      method: "POST",
      headers: { "x-api-key": rawKey },
    });
    const denied = await requireWexPayApiContext(request, { requiredScope: "wexpay:write" });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.response.status, 403);
      const body = (await denied.response.json()) as { reason?: string };
      assert.equal(body.reason, "scope");
    }
  });

  it("legacy path: unset v2 flag keeps BusinessNotification-only create", async () => {
    if (!fixture) return;
    await resetTable();
    await openOrder(100);

    assert.equal(
      isPaymentRequestV2Enabled({
        organizationPaymentRequestV2Enabled: true,
        env: {},
      }),
      false,
    );

    const before = await prisma.tableAssistRequest.count({ where: { tableId: fixture.tableId } });
    const legacy = await createPublicTableAssistNotification({
      organizationId: fixture.orgId,
      branchId: fixture.branchId,
      tableId: fixture.tableId,
      kind: "payment_request",
      reason: "full_bill",
      note: null,
      ipAddress: "127.0.0.1",
      // structured omitted / false → legacy
    });
    assert.ok(legacy.id);
    assert.equal(legacy.alreadyOpen, false);

    const after = await prisma.tableAssistRequest.count({ where: { tableId: fixture.tableId } });
    assert.equal(after, before);

    const notification = await prisma.businessNotification.findUnique({ where: { id: legacy.id } });
    assert.ok(notification);
  });
});
