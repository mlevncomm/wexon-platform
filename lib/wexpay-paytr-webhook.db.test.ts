import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, describe, it } from "node:test";
import { OrderStatus, PaymentStatus, WexPayProviderCredentialMode } from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { buildPaytrCallbackHash } from "@/lib/wexpay-paytr-adapter";
import { upsertWexPayProviderCredential } from "@/lib/wexpay-provider-credentials";
import { processPaytrWebhookRequest } from "@/lib/wexpay-paytr-webhook";

/**
 * DB-backed PayTR webhook mutations. Guard MUST run before any Prisma query.
 * Run via: WEXON_ALLOW_LOCAL_DB_TESTS=1 npm run test:unit:db
 */
assertLocalDbTestGuard(process.env);

const TEST_MERCHANT = {
  merchantId: "integration-merchant-id",
  merchantKey: "integration-merchant-key",
  merchantSalt: "integration-merchant-salt",
};

function isDatabaseUnavailable(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    name.startsWith("PrismaClient") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED") ||
    message.includes("database")
  );
}

function buildPaytrWebhookBody(input: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}) {
  return new URLSearchParams({
    merchant_oid: input.merchantOid,
    status: input.status,
    total_amount: input.totalAmount,
    hash: input.hash,
  }).toString();
}

function signedBody(input: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  merchantKey?: string;
  merchantSalt?: string;
}) {
  const merchantKey = input.merchantKey ?? TEST_MERCHANT.merchantKey;
  const merchantSalt = input.merchantSalt ?? TEST_MERCHANT.merchantSalt;
  const hash = buildPaytrCallbackHash({
    merchantOid: input.merchantOid,
    status: input.status,
    totalAmount: input.totalAmount,
    hash: "",
    merchantKey,
    merchantSalt,
  });
  return buildPaytrWebhookBody({
    merchantOid: input.merchantOid,
    status: input.status,
    totalAmount: input.totalAmount,
    hash,
  });
}

function webhookRequest(rawBody: string) {
  return new Request("http://localhost/api/wexpay/webhooks/paytr", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: rawBody,
  });
}

async function findSeedTable() {
  return prisma.restaurantTable.findFirst({
    where: {
      qrCode: "WEXPAY-real-test-MASA-01",
      branch: { restaurant: { organization: { slug: "wexpay-real-test" } } },
    },
    include: { branch: { include: { restaurant: true } } },
  });
}

/** Chargeable order so settle-to-PAID passes table balance integrity checks. */
async function ensureChargeableOrder(table: {
  id: string;
  branchId: string;
}, amount: number) {
  const product = await prisma.menuProduct.findFirst({
    where: { branchId: table.branchId, isActive: true },
  });
  if (!product) {
    throw new Error("seed menu product missing for webhook balance fixture");
  }
  return prisma.customerOrder.create({
    data: {
      orderNo: `WXP-WH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      branchId: table.branchId,
      tableId: table.id,
      status: OrderStatus.SERVED,
      subtotal: amount,
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: amount,
            totalPrice: amount,
          },
        ],
      },
    },
  });
}

async function ensureTestPaytrCredential(organizationId: string) {
  if (!process.env.WEXPAY_CREDENTIAL_ENCRYPTION_KEY?.trim()) {
    return false;
  }
  await upsertWexPayProviderCredential(
    { organizationId, ipAddress: "127.0.0.1" },
    {
      provider: "paytr",
      displayName: "Integration Test PayTR",
      mode: WexPayProviderCredentialMode.TEST,
      config: {
        merchantId: TEST_MERCHANT.merchantId,
        merchantKey: TEST_MERCHANT.merchantKey,
        merchantSalt: TEST_MERCHANT.merchantSalt,
      },
      primarySecret: TEST_MERCHANT.merchantKey,
      isActive: true,
    },
  );
  return true;
}

after(async () => {
  await prisma.wexPayProviderCredential.deleteMany({
    where: { displayName: "Integration Test PayTR" },
  });
});

describe("processPaytrWebhookRequest", () => {
  it("returns 400 for invalid payload without DB mutation", async () => {
    const request = webhookRequest("merchant_oid=only");
    const result = await processPaytrWebhookRequest(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.body, "invalid_payload");
    }
  });

  it("returns 404 when payment is not found for valid-shaped callback", async (t) => {
    try {
      const body = signedBody({
        merchantOid: `missing-oid-${Date.now()}`,
        status: "success",
        totalAmount: "100",
      });
      const result = await processPaytrWebhookRequest(webhookRequest(body));
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 404);
        assert.equal(result.body, "payment_not_found");
      }
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        t.skip(`database unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      throw error;
    }
  });

  it("returns 401 for invalid signature without mutating payment", async (t) => {
    try {
      const table = await findSeedTable();
      if (!table?.branch.restaurant.organizationId) {
        t.skip("seed table missing — run prisma:seed:real");
        return;
      }

      const providerRef = `WXP-TEST-INVALID-SIG-${Date.now()}`;
      const payment = await prisma.payment.create({
        data: {
          branchId: table.branchId,
          tableId: table.id,
          amount: "120.00",
          currency: "TRY",
          status: PaymentStatus.PENDING,
          provider: "paytr",
          providerRef,
        },
      });

      try {
        const body = buildPaytrWebhookBody({
          merchantOid: providerRef,
          status: "success",
          totalAmount: "12000",
          hash: "invalid-signature",
        });
        const result = await processPaytrWebhookRequest(webhookRequest(body));
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.status, 401);

        const unchanged = await prisma.payment.findUnique({ where: { id: payment.id } });
        assert.equal(unchanged?.status, PaymentStatus.PENDING);
      } finally {
        await prisma.payment.delete({ where: { id: payment.id } });
        await prisma.wexPayWebhookEvent.deleteMany({ where: { providerEventId: { contains: providerRef } } });
      }
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        t.skip(`database unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      throw error;
    }
  });

  it("returns 400 for amount mismatch with valid signature", async (t) => {
    try {
      const table = await findSeedTable();
      if (!table?.branch.restaurant.organizationId) {
        t.skip("seed table missing — run prisma:seed:real");
        return;
      }
      const organizationId = table.branch.restaurant.organizationId;
      const credsReady = await ensureTestPaytrCredential(organizationId);
      if (!credsReady) {
        t.skip("WEXPAY_CREDENTIAL_ENCRYPTION_KEY required for signed webhook tests");
        return;
      }

      const providerRef = `WXP-TEST-AMOUNT-${Date.now()}`;
      const payment = await prisma.payment.create({
        data: {
          branchId: table.branchId,
          tableId: table.id,
          amount: "120.00",
          currency: "TRY",
          status: PaymentStatus.PENDING,
          provider: "paytr",
          providerRef,
        },
      });

      try {
        const body = signedBody({
          merchantOid: providerRef,
          status: "success",
          totalAmount: "11999",
        });
        const result = await processPaytrWebhookRequest(webhookRequest(body));
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.status, 400);

        const unchanged = await prisma.payment.findUnique({ where: { id: payment.id } });
        assert.equal(unchanged?.status, PaymentStatus.PENDING);
      } finally {
        await prisma.payment.delete({ where: { id: payment.id } });
        await prisma.wexPayWebhookEvent.deleteMany({ where: { providerEventId: { contains: providerRef } } });
      }
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        t.skip(`database unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      throw error;
    }
  });

  it("marks payment PAID on valid success callback", async (t) => {
    try {
      const table = await findSeedTable();
      if (!table?.branch.restaurant.organizationId) {
        t.skip("seed table missing — run prisma:seed:real");
        return;
      }
      const organizationId = table.branch.restaurant.organizationId;
      const credsReady = await ensureTestPaytrCredential(organizationId);
      if (!credsReady) {
        t.skip("WEXPAY_CREDENTIAL_ENCRYPTION_KEY required for signed webhook tests");
        return;
      }

      const providerRef = `WXP-TEST-SUCCESS-${Date.now()}`;
      const order = await ensureChargeableOrder(table, 120);
      const payment = await prisma.payment.create({
        data: {
          branchId: table.branchId,
          tableId: table.id,
          orderId: order.id,
          amount: "120.00",
          currency: "TRY",
          status: PaymentStatus.PENDING,
          provider: "paytr",
          providerRef,
        },
      });

      try {
        const body = signedBody({
          merchantOid: providerRef,
          status: "success",
          totalAmount: "12000",
        });
        const result = await processPaytrWebhookRequest(webhookRequest(body));
        assert.equal(result.ok, true);

        const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
        assert.equal(updated?.status, PaymentStatus.PAID);
        assert.ok(updated?.paidAt);
      } finally {
        await prisma.payment.delete({ where: { id: payment.id } }).catch(() => undefined);
        await prisma.customerOrder.delete({ where: { id: order.id } }).catch(() => undefined);
        await prisma.wexPayWebhookEvent.deleteMany({ where: { providerEventId: { contains: providerRef } } });
      }
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        t.skip(`database unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      throw error;
    }
  });

  it("marks payment FAILED on valid failed callback", async (t) => {
    try {
      const table = await findSeedTable();
      if (!table?.branch.restaurant.organizationId) {
        t.skip("seed table missing — run prisma:seed:real");
        return;
      }
      const organizationId = table.branch.restaurant.organizationId;
      const credsReady = await ensureTestPaytrCredential(organizationId);
      if (!credsReady) {
        t.skip("WEXPAY_CREDENTIAL_ENCRYPTION_KEY required for signed webhook tests");
        return;
      }

      const providerRef = `WXP-TEST-FAILED-${Date.now()}`;
      const payment = await prisma.payment.create({
        data: {
          branchId: table.branchId,
          tableId: table.id,
          amount: "120.00",
          currency: "TRY",
          status: PaymentStatus.PENDING,
          provider: "paytr",
          providerRef,
        },
      });

      try {
        const body = signedBody({
          merchantOid: providerRef,
          status: "failed",
          totalAmount: "12000",
        });
        const result = await processPaytrWebhookRequest(webhookRequest(body));
        assert.equal(result.ok, true);

        const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
        assert.equal(updated?.status, PaymentStatus.FAILED);
      } finally {
        await prisma.payment.delete({ where: { id: payment.id } });
        await prisma.wexPayWebhookEvent.deleteMany({ where: { providerEventId: { contains: providerRef } } });
      }
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        t.skip(`database unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      throw error;
    }
  });

  it("ignores duplicate callback without second mutation", async (t) => {
    try {
      const table = await findSeedTable();
      if (!table?.branch.restaurant.organizationId) {
        t.skip("seed table missing — run prisma:seed:real");
        return;
      }
      const organizationId = table.branch.restaurant.organizationId;
      const credsReady = await ensureTestPaytrCredential(organizationId);
      if (!credsReady) {
        t.skip("WEXPAY_CREDENTIAL_ENCRYPTION_KEY required for signed webhook tests");
        return;
      }

      const providerRef = `WXP-TEST-DUP-${Date.now()}`;
      const order = await ensureChargeableOrder(table, 120);
      const payment = await prisma.payment.create({
        data: {
          branchId: table.branchId,
          tableId: table.id,
          orderId: order.id,
          amount: "120.00",
          currency: "TRY",
          status: PaymentStatus.PENDING,
          provider: "paytr",
          providerRef,
        },
      });

      try {
        const body = signedBody({
          merchantOid: providerRef,
          status: "success",
          totalAmount: "12000",
        });
        const first = await processPaytrWebhookRequest(webhookRequest(body));
        assert.equal(first.ok, true);
        const second = await processPaytrWebhookRequest(webhookRequest(body));
        assert.equal(second.ok, true);
        if (second.ok) assert.equal(second.duplicate, true);

        const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
        assert.equal(updated?.status, PaymentStatus.PAID);
      } finally {
        await prisma.payment.delete({ where: { id: payment.id } }).catch(() => undefined);
        await prisma.customerOrder.delete({ where: { id: order.id } }).catch(() => undefined);
        await prisma.wexPayWebhookEvent.deleteMany({ where: { providerEventId: { contains: providerRef } } });
      }
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        t.skip(`database unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      throw error;
    }
  });

  it("ignores callback when payment already terminal", async (t) => {
    try {
      const table = await findSeedTable();
      if (!table?.branch.restaurant.organizationId) {
        t.skip("seed table missing — run prisma:seed:real");
        return;
      }
      const organizationId = table.branch.restaurant.organizationId;
      const credsReady = await ensureTestPaytrCredential(organizationId);
      if (!credsReady) {
        t.skip("WEXPAY_CREDENTIAL_ENCRYPTION_KEY required for signed webhook tests");
        return;
      }

      const providerRef = `WXP-TEST-TERMINAL-${Date.now()}`;
      const payment = await prisma.payment.create({
        data: {
          branchId: table.branchId,
          tableId: table.id,
          amount: "120.00",
          currency: "TRY",
          status: PaymentStatus.PAID,
          provider: "paytr",
          providerRef,
          paidAt: new Date(),
        },
      });

      try {
        const body = signedBody({
          merchantOid: providerRef,
          status: "success",
          totalAmount: "12000",
        });
        const result = await processPaytrWebhookRequest(webhookRequest(body));
        assert.equal(result.ok, true);
        if (result.ok) assert.equal(result.skipped, true);

        const unchanged = await prisma.payment.findUnique({ where: { id: payment.id } });
        assert.equal(unchanged?.status, PaymentStatus.PAID);
      } finally {
        await prisma.payment.delete({ where: { id: payment.id } });
        await prisma.wexPayWebhookEvent.deleteMany({ where: { providerEventId: { contains: providerRef } } });
      }
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        t.skip(`database unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      throw error;
    }
  });

  it("does not use another tenant's valid PayTR credential", async () => {
    const table = await findSeedTable();
    assert.ok(table?.branch.restaurant.organizationId, "seed table missing — run prisma:seed:real");
    const organizationId = table.branch.restaurant.organizationId;
    const foreignOrganization = await prisma.organization.create({
      data: {
        name: `Webhook Foreign ${Date.now()}`,
        slug: `webhook-foreign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        isActive: true,
        isDemo: false,
      },
    });
    const providerRef = `WXP-TEST-TENANT-${Date.now()}`;
    const payment = await prisma.payment.create({
      data: {
        branchId: table.branchId,
        tableId: table.id,
        amount: "120.00",
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef,
      },
    });

    try {
      await prisma.wexPayProviderCredential.deleteMany({
        where: {
          organizationId,
          provider: "paytr",
          mode: WexPayProviderCredentialMode.TEST,
        },
      });
      await ensureTestPaytrCredential(foreignOrganization.id);

      const body = signedBody({
        merchantOid: providerRef,
        status: "success",
        totalAmount: "12000",
      });
      const result = await processPaytrWebhookRequest(webhookRequest(body));
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 401);
        assert.equal(result.body, "invalid_signature");
      }
      const unchanged = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      assert.equal(unchanged.status, PaymentStatus.PENDING);
    } finally {
      await prisma.payment.delete({ where: { id: payment.id } }).catch(() => undefined);
      await prisma.wexPayWebhookEvent.deleteMany({
        where: { providerEventId: { contains: providerRef } },
      });
      await prisma.wexPayProviderCredential.deleteMany({
        where: { organizationId: foreignOrganization.id },
      });
      await prisma.organization.delete({ where: { id: foreignOrganization.id } });
    }
  });

  it("parses raw urlencoded body (not JSON)", async () => {
    const raw = signedBody({
      merchantOid: `raw-body-${Date.now()}`,
      status: "success",
      totalAmount: "100",
    });
    assert.ok(!raw.trim().startsWith("{"));
    const request = webhookRequest(raw);
    const text = await request.text();
    assert.ok(text.includes("merchant_oid="));
    assert.ok(text.includes("hash="));
  });
});

describe("PayTR callback HMAC (local)", () => {
  it("builds deterministic callback hash", () => {
    const hash = buildPaytrCallbackHash({
      merchantOid: "OID1",
      status: "success",
      totalAmount: "12000",
      hash: "",
      merchantKey: "key",
      merchantSalt: "salt",
    });
    const expected = createHmac("sha256", "key").update("OID1saltsuccess12000").digest("base64");
    assert.equal(hash, expected);
  });
});
