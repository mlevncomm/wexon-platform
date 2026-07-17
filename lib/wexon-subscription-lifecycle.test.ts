import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSubscriptionLifecycle } from "./wexon-core-access";
import { syncSubscriptionTerminalAccess } from "./wexon-subscription-lifecycle";

const NOW = new Date("2026-07-17T12:00:00.000Z");
const FUTURE = new Date("2026-08-17T12:00:00.000Z");
const PAST = new Date("2026-06-17T12:00:00.000Z");

describe("evaluateSubscriptionLifecycle", () => {
  it("A: manual license without subscription keeps access", () => {
    assert.deepEqual(evaluateSubscriptionLifecycle(null, NOW), { ok: true });
  });

  it("B: ACTIVE subscription (no cancelAt, open period) keeps access", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: null, currentPeriodEnd: FUTURE }, NOW),
      { ok: true },
    );
  });

  it("C: future-dated cancelAt keeps access until that date", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: FUTURE, currentPeriodEnd: FUTURE }, NOW),
      { ok: true },
    );
    // CANCELLED status but effective in the future must still keep access.
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "CANCELLED", cancelAt: FUTURE, currentPeriodEnd: null }, NOW),
      { ok: true },
    );
  });

  it("D: cancelAt now/past denies access", () => {
    assert.deepEqual(evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: NOW, currentPeriodEnd: FUTURE }, NOW), {
      ok: false,
      reason: "subscription_cancelled",
    });
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: PAST, currentPeriodEnd: FUTURE }, NOW),
      { ok: false, reason: "subscription_cancelled" },
    );
  });

  it("E: terminal CANCELLED subscription denies access", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "CANCELLED", cancelAt: NOW, currentPeriodEnd: FUTURE }, NOW),
      { ok: false, reason: "subscription_cancelled" },
    );
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "CANCELLED", cancelAt: null, currentPeriodEnd: FUTURE }, NOW),
      { ok: false, reason: "subscription_cancelled" },
    );
  });

  it("F: EXPIRED subscription denies access", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "EXPIRED", cancelAt: null, currentPeriodEnd: FUTURE }, NOW),
      { ok: false, reason: "subscription_expired" },
    );
    // Effective cancelAt on an EXPIRED row reports the expired reason.
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "EXPIRED", cancelAt: PAST, currentPeriodEnd: null }, NOW),
      { ok: false, reason: "subscription_expired" },
    );
  });

  it("G: ended billing period denies access for ACTIVE/TRIALING", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: null, currentPeriodEnd: PAST }, NOW),
      { ok: false, reason: "subscription_period_ended" },
    );
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "TRIALING", cancelAt: null, currentPeriodEnd: PAST }, NOW),
      { ok: false, reason: "subscription_period_ended" },
    );
  });

  it("H: PAST_DUE preserves existing policy (access retained, no invented grace)", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "PAST_DUE", cancelAt: null, currentPeriodEnd: PAST }, NOW),
      { ok: true },
    );
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "PAST_DUE", cancelAt: null, currentPeriodEnd: FUTURE }, NOW),
      { ok: true },
    );
  });
});

// --- Transactional access sync helper --------------------------------------

type LicenseRow = { id: string; organizationId: string; productId: string; status: string };
type InstallationRow = { organizationId: string; productId: string; status: string };

function makeMockDb(licenses: LicenseRow[], installations: InstallationRow[]) {
  return {
    licenses,
    installations,
    license: {
      findUnique: async ({ where: { id } }: { where: { id: string } }) =>
        licenses.find((row) => row.id === id) ?? null,
      update: async ({ where: { id }, data }: { where: { id: string }; data: { status: string } }) => {
        const row = licenses.find((item) => item.id === id);
        if (!row) throw new Error("license not found");
        row.status = data.status;
        return row;
      },
    },
    appInstallation: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { organizationId: string; productId: string; status: string };
        data: { status: string };
      }) => {
        const matches = installations.filter(
          (row) =>
            row.organizationId === where.organizationId &&
            row.productId === where.productId &&
            row.status === where.status,
        );
        for (const row of matches) row.status = data.status;
        return { count: matches.length };
      },
    },
  };
}

describe("syncSubscriptionTerminalAccess", () => {
  it("L: admin instant CANCELLED atomically closes License + this installation", async () => {
    const db = makeMockDb(
      [{ id: "lic-1", organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
      [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
    );

    const result = await syncSubscriptionTerminalAccess(db as never, {
      subscription: { id: "sub-1", organizationId: "org-1", licenseId: "lic-1", status: "CANCELLED", cancelAt: NOW, currentPeriodEnd: FUTURE },
      now: NOW,
    });

    assert.equal(result.applied, true);
    assert.equal(result.reason, "subscription_cancelled");
    assert.equal(result.licenseStatusChanged, true);
    assert.equal(result.installationDisabled, true);
    assert.equal(db.licenses[0].status, "CANCELLED");
    assert.equal(db.installations[0].status, "DISABLED");
  });

  it("F-sync: EXPIRED maps License to EXPIRED", async () => {
    const db = makeMockDb(
      [{ id: "lic-1", organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
      [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
    );

    const result = await syncSubscriptionTerminalAccess(db as never, {
      subscription: { id: "sub-1", organizationId: "org-1", licenseId: "lic-1", status: "EXPIRED", cancelAt: null, currentPeriodEnd: PAST },
      now: NOW,
    });

    assert.equal(result.reason, "subscription_expired");
    assert.equal(db.licenses[0].status, "EXPIRED");
    assert.equal(db.installations[0].status, "DISABLED");
  });

  it("M: future-dated cancellation does NOT close License/installation", async () => {
    const db = makeMockDb(
      [{ id: "lic-1", organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
      [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
    );

    const result = await syncSubscriptionTerminalAccess(db as never, {
      subscription: { id: "sub-1", organizationId: "org-1", licenseId: "lic-1", status: "CANCELLED", cancelAt: FUTURE, currentPeriodEnd: FUTURE },
      now: NOW,
    });

    assert.equal(result.applied, false);
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "ACTIVE");
  });

  it("period-ended is not an eager close (read-time gate only)", async () => {
    const db = makeMockDb(
      [{ id: "lic-1", organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
      [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
    );

    const result = await syncSubscriptionTerminalAccess(db as never, {
      subscription: { id: "sub-1", organizationId: "org-1", licenseId: "lic-1", status: "ACTIVE", cancelAt: null, currentPeriodEnd: PAST },
      now: NOW,
    });

    assert.equal(result.applied, false);
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "ACTIVE");
  });

  it("K: idempotent — second run produces no further writes", async () => {
    const db = makeMockDb(
      [{ id: "lic-1", organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
      [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
    );
    const input = {
      subscription: { id: "sub-1", organizationId: "org-1", licenseId: "lic-1", status: "CANCELLED" as const, cancelAt: NOW, currentPeriodEnd: FUTURE },
      now: NOW,
    };

    const first = await syncSubscriptionTerminalAccess(db as never, input);
    const second = await syncSubscriptionTerminalAccess(db as never, input);

    assert.equal(first.licenseStatusChanged, true);
    assert.equal(first.installationDisabled, true);
    assert.equal(second.applied, true);
    assert.equal(second.licenseStatusChanged, false);
    assert.equal(second.installationDisabled, false);
    assert.equal(db.licenses[0].status, "CANCELLED");
    assert.equal(db.installations[0].status, "DISABLED");
  });

  it("I: other product installation in the same organization is untouched", async () => {
    const db = makeMockDb(
      [{ id: "lic-1", organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
      [
        { organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" },
        { organizationId: "org-1", productId: "prod-other", status: "ACTIVE" },
      ],
    );

    await syncSubscriptionTerminalAccess(db as never, {
      subscription: { id: "sub-1", organizationId: "org-1", licenseId: "lic-1", status: "CANCELLED", cancelAt: NOW, currentPeriodEnd: FUTURE },
      now: NOW,
    });

    assert.equal(db.installations[0].status, "DISABLED");
    assert.equal(db.installations[1].status, "ACTIVE");
  });

  it("J: another organization is untouched", async () => {
    const db = makeMockDb(
      [{ id: "lic-1", organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
      [
        { organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" },
        { organizationId: "org-2", productId: "prod-wexpay", status: "ACTIVE" },
      ],
    );

    await syncSubscriptionTerminalAccess(db as never, {
      subscription: { id: "sub-1", organizationId: "org-1", licenseId: "lic-1", status: "CANCELLED", cancelAt: NOW, currentPeriodEnd: FUTURE },
      now: NOW,
    });

    assert.equal(db.installations[0].status, "DISABLED");
    assert.equal(db.installations[1].status, "ACTIVE");
  });

  it("defensive: license belonging to a different org is not modified", async () => {
    const db = makeMockDb(
      [{ id: "lic-1", organizationId: "org-OTHER", productId: "prod-wexpay", status: "ACTIVE" }],
      [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }],
    );

    const result = await syncSubscriptionTerminalAccess(db as never, {
      subscription: { id: "sub-1", organizationId: "org-1", licenseId: "lic-1", status: "CANCELLED", cancelAt: NOW, currentPeriodEnd: FUTURE },
      now: NOW,
    });

    assert.equal(result.applied, false);
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "ACTIVE");
  });
});
