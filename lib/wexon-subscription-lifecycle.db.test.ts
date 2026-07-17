/**
 * DB-backed integration tests for subscription → access synchronization.
 *
 * These exercise the REAL Prisma client and a real transaction, so they require
 * an ISOLATED local Postgres (never shared Supabase / production). They are NOT
 * part of `npm run test:unit`; run explicitly with `npm run test:unit:db`.
 *
 * Guarded to refuse obviously non-local / production targets and to clean up
 * every row it creates.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { prisma } from "./prisma";
import { evaluateProductAccess } from "./wexon-core-access";
import { syncSubscriptionAccessState, SubscriptionAccessSyncError } from "./wexon-subscription-lifecycle";

const connection = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
const looksProduction =
  process.env.VERCEL_ENV === "production" || connection.includes("supabase.com") || connection.includes("pooler.supabase");

const suffix = randomUUID().slice(0, 8);
const productKey = `test-wexpay-${suffix}`;
const ids: { org?: string; product?: string; plan?: string; license?: string; subscription?: string; installation?: string } = {};

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

async function resetBaseline() {
  await prisma.subscription.update({
    where: { id: ids.subscription! },
    data: { status: "ACTIVE", cancelAt: null, currentPeriodEnd: FUTURE },
  });
  await prisma.license.update({ where: { id: ids.license! }, data: { status: "ACTIVE" } });
  await prisma.appInstallation.update({ where: { id: ids.installation! }, data: { status: "ACTIVE" } });
}

async function currentSub() {
  return prisma.subscription.findUniqueOrThrow({ where: { id: ids.subscription! } });
}

describe("subscription access sync (DB-backed)", () => {
  before(async () => {
    if (looksProduction) {
      throw new Error("Refusing to run DB integration tests against a production / shared Supabase target.");
    }

    const product = await prisma.product.create({
      data: { key: productKey, name: `Test WexPay ${suffix}`, status: "ACTIVE", isActive: true },
    });
    ids.product = product.id;

    const plan = await prisma.plan.create({
      data: { productId: product.id, key: `test-plan-${suffix}`, name: "Test Plan", billingInterval: "MONTHLY" },
    });
    ids.plan = plan.id;
    await prisma.entitlement.create({
      data: { planId: plan.id, key: "staff_limit", valueType: "INTEGER", valueInt: 10 },
    });

    const org = await prisma.organization.create({
      data: { name: `Test Org ${suffix}`, slug: `test-org-${suffix}`, isActive: true, isDemo: false },
    });
    ids.org = org.id;

    const license = await prisma.license.create({
      data: { organizationId: org.id, productId: product.id, planId: plan.id, status: "ACTIVE", licenseType: "MONTHLY", endsAt: FUTURE },
    });
    ids.license = license.id;

    const installation = await prisma.appInstallation.create({
      data: { organizationId: org.id, productId: product.id, licenseId: license.id, status: "ACTIVE" },
    });
    ids.installation = installation.id;

    const subscription = await prisma.subscription.create({
      data: { organizationId: org.id, licenseId: license.id, planId: plan.id, status: "ACTIVE", interval: "MONTHLY", currentPeriodEnd: FUTURE },
    });
    ids.subscription = subscription.id;
  });

  after(async () => {
    if (ids.subscription) await prisma.subscription.deleteMany({ where: { id: ids.subscription } });
    if (ids.installation) await prisma.appInstallation.deleteMany({ where: { id: ids.installation } });
    if (ids.license) await prisma.license.deleteMany({ where: { id: ids.license } });
    if (ids.plan) await prisma.entitlement.deleteMany({ where: { planId: ids.plan } });
    if (ids.plan) await prisma.plan.deleteMany({ where: { id: ids.plan } });
    if (ids.product) await prisma.product.deleteMany({ where: { id: ids.product } });
    if (ids.org) await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.$disconnect();
  });

  it("14 (bug #1): terminal subscription denies even when License + installation are still ACTIVE", async () => {
    await resetBaseline();

    // CANCELLED effective now, but License/installation left ACTIVE (no sync run).
    await prisma.subscription.update({ where: { id: ids.subscription! }, data: { status: "CANCELLED", cancelAt: new Date() } });
    let access = await evaluateProductAccess({ organizationId: ids.org!, productKey });
    assert.equal(access.allowed, false);
    assert.equal(access.reason, "subscription_cancelled");

    // EXPIRED + future cancelAt must still deny (EXPIRED wins).
    await prisma.subscription.update({ where: { id: ids.subscription! }, data: { status: "EXPIRED", cancelAt: FUTURE } });
    access = await evaluateProductAccess({ organizationId: ids.org!, productKey });
    assert.equal(access.allowed, false);
    assert.equal(access.reason, "subscription_expired");
  });

  it("L: admin CANCELLED closes License + installation atomically; access denied", async () => {
    await resetBaseline();

    await prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({ where: { id: ids.subscription! }, data: { status: "CANCELLED", cancelAt: new Date() } });
      await syncSubscriptionAccessState(tx, {
        subscription: {
          id: updated.id,
          organizationId: updated.organizationId,
          licenseId: updated.licenseId,
          status: updated.status,
          cancelAt: updated.cancelAt,
          currentPeriodEnd: updated.currentPeriodEnd,
        },
        previousStatus: "ACTIVE",
      });
    });

    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.license! } });
    const installation = await prisma.appInstallation.findUniqueOrThrow({ where: { id: ids.installation! } });
    assert.equal(license.status, "CANCELLED");
    assert.equal(installation.status, "DISABLED");
    const access = await evaluateProductAccess({ organizationId: ids.org!, productKey });
    assert.equal(access.allowed, false);
  });

  it("15: reactivation (CANCELLED → ACTIVE) restores License/installation and clears cancelAt", async () => {
    // Start from the closed/terminal state produced above.
    await prisma.subscription.update({ where: { id: ids.subscription! }, data: { status: "CANCELLED", cancelAt: new Date() } });
    await prisma.license.update({ where: { id: ids.license! }, data: { status: "CANCELLED" } });
    await prisma.appInstallation.update({ where: { id: ids.installation! }, data: { status: "DISABLED" } });

    await prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({ where: { id: ids.subscription! }, data: { status: "ACTIVE", cancelAt: null } });
      await syncSubscriptionAccessState(tx, {
        subscription: {
          id: updated.id,
          organizationId: updated.organizationId,
          licenseId: updated.licenseId,
          status: updated.status,
          cancelAt: updated.cancelAt,
          currentPeriodEnd: updated.currentPeriodEnd,
        },
        previousStatus: "CANCELLED",
      });
    });

    const sub = await currentSub();
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.license! } });
    const installation = await prisma.appInstallation.findUniqueOrThrow({ where: { id: ids.installation! } });
    assert.equal(sub.cancelAt, null);
    assert.equal(license.status, "ACTIVE");
    assert.equal(installation.status, "ACTIVE");
    const access = await evaluateProductAccess({ organizationId: ids.org!, productKey });
    assert.equal(access.allowed, true);
  });

  it("8/atomicity: terminal → PAST_DUE rolls back the whole transaction", async () => {
    // Put subscription/license/installation into a terminal-closed state.
    await prisma.subscription.update({ where: { id: ids.subscription! }, data: { status: "CANCELLED", cancelAt: new Date() } });
    await prisma.license.update({ where: { id: ids.license! }, data: { status: "CANCELLED" } });
    await prisma.appInstallation.update({ where: { id: ids.installation! }, data: { status: "DISABLED" } });

    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          const updated = await tx.subscription.update({ where: { id: ids.subscription! }, data: { status: "PAST_DUE", cancelAt: null } });
          await syncSubscriptionAccessState(tx, {
            subscription: {
              id: updated.id,
              organizationId: updated.organizationId,
              licenseId: updated.licenseId,
              status: updated.status,
              cancelAt: updated.cancelAt,
              currentPeriodEnd: updated.currentPeriodEnd,
            },
            previousStatus: "CANCELLED",
          });
        }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "unsafe_transition",
    );

    // The subscription update must have rolled back with the failed sync.
    const sub = await currentSub();
    assert.equal(sub.status, "CANCELLED");
  });

  it("11: license/organization mismatch throws and rolls back", async () => {
    await resetBaseline();

    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          await tx.subscription.update({ where: { id: ids.subscription! }, data: { status: "CANCELLED", cancelAt: new Date() } });
          await syncSubscriptionAccessState(tx, {
            subscription: {
              id: ids.subscription!,
              organizationId: `mismatch-${suffix}`, // does not own the license
              licenseId: ids.license!,
              status: "CANCELLED",
              cancelAt: new Date(),
              currentPeriodEnd: FUTURE,
            },
            previousStatus: "ACTIVE",
          });
        }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "tenant_mismatch",
    );

    const sub = await currentSub();
    const license = await prisma.license.findUniqueOrThrow({ where: { id: ids.license! } });
    assert.equal(sub.status, "ACTIVE");
    assert.equal(license.status, "ACTIVE");
  });
});
