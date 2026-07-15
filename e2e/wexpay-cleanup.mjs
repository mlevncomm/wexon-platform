/**
 * Marker-scoped WexPay E2E cleanup (isolated DB only).
 * Refuses shared remote / production. Never deleteMany({}) globals.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  assertIsolatedWexPayDatabase,
  classifyE2EDatabase,
  describeDatabaseSafely,
} from "../scripts/e2e-isolated-guards.mjs";

const FIXTURE_ORG_SLUG = "wexpay-real-test";
const FIXTURE_QR_CODES = ["WEXPAY-real-test-MASA-01", "WEXPAY-real-test-MASA-02"];
const MAX_ORDERS = 80;
const MAX_NOTIFICATIONS = 200;
const MAX_IDEMPOTENCY = 80;
const MAX_PAYMENTS = 40;

const runArtifactPath = resolve(process.cwd(), "e2e", ".wexpay-run.json");
const reportPath = resolve(process.cwd(), "e2e", ".cleanup-report.json");

/**
 * @typedef {{
 *   runId: string,
 *   token: string,
 *   note?: string,
 *   startedAt: string,

 *   orderIds?: string[],
 *   notificationIds?: string[],
 *   paymentIds?: string[],
 *   idempotencyKeys?: string[],
 *   tableIds?: string[],
 * }} WexPayRunArtifact
 */

export function createRunArtifact(runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`) {
  const token = `E2E[WXP].${runId}`;
  /** @type {WexPayRunArtifact} */
  const artifact = {
    runId,
    token,
    note: `${token} isolated WexPay E2E run`,
    startedAt: new Date().toISOString(),
    orderIds: [],
    notificationIds: [],
    paymentIds: [],
    idempotencyKeys: [],
    tableIds: [],
  };
  writeFileSync(runArtifactPath, JSON.stringify(artifact, null, 2), "utf8");
  return artifact;
}

export function loadRunArtifact() {
  if (!existsSync(runArtifactPath)) return null;
  return JSON.parse(readFileSync(runArtifactPath, "utf8"));
}

export function saveRunArtifact(artifact) {
  writeFileSync(runArtifactPath, JSON.stringify(artifact, null, 2), "utf8");
}

function createPrisma() {
  const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL or DIRECT_URL required");
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool, url };
}

/**
 * @param {{ artifact?: WexPayRunArtifact | null, dryRun?: boolean }} [options]
 */
export async function cleanupWexPayE2ERun(options = {}) {
  assertIsolatedWexPayDatabase("wexpay E2E cleanup");
  const classification = classifyE2EDatabase();
  if (classification !== "isolated") {
    throw new Error(`Cleanup refused: classification=${classification}`);
  }

  const artifact = options.artifact ?? loadRunArtifact();
  if (!artifact?.token) {
    throw new Error("Cleanup refused: missing run marker artifact (e2e/.wexpay-run.json).");
  }

  const { prisma, pool, url } = createPrisma();
  const desc = describeDatabaseSafely(url);
  /** @type {Record<string, number>} */
  const counts = {
    orderItems: 0,
    notifications: 0,
    receipts: 0,
    payments: 0,
    orders: 0,
    idempotency: 0,
    tablesReset: 0,
  };

  try {
    const fixtureOrg = await prisma.organization.findFirst({
      where: { slug: FIXTURE_ORG_SLUG, isDemo: false },
      select: { id: true },
    });
    if (!fixtureOrg) {
      throw new Error(`Cleanup refused: fixture org ${FIXTURE_ORG_SLUG} not found.`);
    }

    const fixtureTables = await prisma.restaurantTable.findMany({
      where: {
        qrCode: { in: FIXTURE_QR_CODES },
        branch: { restaurant: { organizationId: fixtureOrg.id } },
      },
      select: { id: true, qrCode: true, status: true },
    });
    if (fixtureTables.length === 0) {
      throw new Error("Cleanup refused: fixture tables not found.");
    }
    const fixtureTableIds = new Set(fixtureTables.map((t) => t.id));
    for (const id of artifact.tableIds || []) fixtureTableIds.add(id);

    const notedOrders = await prisma.customerOrder.findMany({
      where: {
        tableId: { in: [...fixtureTableIds] },
        OR: [
          { note: { contains: artifact.token } },
          ...(artifact.orderIds?.length ? [{ id: { in: artifact.orderIds } }] : []),
        ],
      },
      select: { id: true, tableId: true },
      take: MAX_ORDERS + 1,
    });

    if (notedOrders.length > MAX_ORDERS) {
      throw new Error(`Cleanup abort: matched ${notedOrders.length} orders (cap ${MAX_ORDERS}).`);
    }

    const orderIds = [...new Set(notedOrders.map((o) => o.id))];

    const notifications = await prisma.businessNotification.findMany({
      where: {
        OR: [
          { message: { contains: artifact.token } },
          { title: { contains: artifact.token } },
          ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
          ...(artifact.notificationIds?.length ? [{ id: { in: artifact.notificationIds } }] : []),
        ],
        branch: { restaurant: { organizationId: fixtureOrg.id } },
      },
      select: { id: true },
      take: MAX_NOTIFICATIONS + 1,
    });
    if (notifications.length > MAX_NOTIFICATIONS) {
      throw new Error(`Cleanup abort: matched ${notifications.length} notifications (cap ${MAX_NOTIFICATIONS}).`);
    }
    const notificationIds = notifications.map((n) => n.id);

    const payments = await prisma.payment.findMany({
      where: {
        tableId: { in: [...fixtureTableIds] },
        OR: [
          ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
          ...(artifact.paymentIds?.length ? [{ id: { in: artifact.paymentIds } }] : []),
        ],
      },
      select: { id: true },
      take: MAX_PAYMENTS + 1,
    });
    if (payments.length > MAX_PAYMENTS) {
      throw new Error(`Cleanup abort: matched ${payments.length} payments (cap ${MAX_PAYMENTS}).`);
    }
    const paymentIds = payments.map((p) => p.id);

    const idempotency = await prisma.publicIdempotencyRecord.findMany({
      where: {
        OR: [
          ...(artifact.idempotencyKeys?.length
            ? [{ scopeKey: { in: artifact.idempotencyKeys } }]
            : []),
          { scopeKey: { contains: artifact.token } },
          { scopeKey: { contains: artifact.runId } },
        ],
      },
      select: { id: true },
      take: MAX_IDEMPOTENCY + 1,
    });
    if (idempotency.length > MAX_IDEMPOTENCY) {
      throw new Error(`Cleanup abort: matched ${idempotency.length} idempotency rows (cap ${MAX_IDEMPOTENCY}).`);
    }

    const report = {
      classification,
      host: desc?.host,
      database: desc?.database,
      token: artifact.token,
      planned: {
        orders: orderIds.length,
        notifications: notificationIds.length,
        payments: paymentIds.length,
        idempotency: idempotency.length,
        tables: fixtureTables.length,
      },
      dryRun: Boolean(options.dryRun),
      deleted: counts,
    };

    if (options.dryRun) {
      writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
      return report;
    }

    // FK-safe order: notifications → receipts → payments → order items → orders → idempotency → table reset
    if (notificationIds.length) {
      const r = await prisma.businessNotification.deleteMany({ where: { id: { in: notificationIds } } });
      counts.notifications = r.count;
    }

    if (orderIds.length || paymentIds.length) {
      const r = await prisma.receiptRequest.deleteMany({
        where: {
          OR: [
            ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
            ...(paymentIds.length ? [{ paymentId: { in: paymentIds } }] : []),
            { tableId: { in: [...fixtureTableIds] }, note: { contains: artifact.token } },
          ],
        },
      });
      counts.receipts = r.count;
    }

    if (paymentIds.length) {
      const r = await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
      counts.payments = r.count;
    }

    if (orderIds.length) {
      const items = await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      counts.orderItems = items.count;
      const orders = await prisma.customerOrder.deleteMany({ where: { id: { in: orderIds } } });
      counts.orders = orders.count;
    }

    if (idempotency.length) {
      const r = await prisma.publicIdempotencyRecord.deleteMany({
        where: { id: { in: idempotency.map((row) => row.id) } },
      });
      counts.idempotency = r.count;
    }

    for (const table of fixtureTables) {
      await prisma.restaurantTable.update({
        where: { id: table.id },
        data: { status: "EMPTY", lastClosedAt: new Date() },
      });
      counts.tablesReset += 1;
    }

    report.deleted = counts;
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    return report;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
