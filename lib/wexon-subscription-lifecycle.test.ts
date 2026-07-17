import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSubscriptionLifecycle } from "./wexon-core-access";
import { syncSubscriptionAccessState, SubscriptionAccessSyncError } from "./wexon-subscription-lifecycle";

const NOW = new Date("2026-07-17T12:00:00.000Z");
const FUTURE = new Date("2026-08-17T12:00:00.000Z");
const PAST = new Date("2026-06-17T12:00:00.000Z");

describe("evaluateSubscriptionLifecycle", () => {
  it("A/N: manual license without subscription keeps access", () => {
    assert.deepEqual(evaluateSubscriptionLifecycle(null, NOW), { ok: true });
  });

  it("B: ACTIVE subscription (no cancelAt, open period) keeps access", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: null, currentPeriodEnd: FUTURE }, NOW),
      { ok: true },
    );
  });

  it("1: EXPIRED + future cancelAt still denies (EXPIRED wins)", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "EXPIRED", cancelAt: FUTURE, currentPeriodEnd: FUTURE }, NOW),
      { ok: false, reason: "subscription_expired" },
    );
  });

  it("2: EXPIRED + null cancelAt denies", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "EXPIRED", cancelAt: null, currentPeriodEnd: FUTURE }, NOW),
      { ok: false, reason: "subscription_expired" },
    );
  });

  it("3: CANCELLED + future cancelAt keeps access until that date", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "CANCELLED", cancelAt: FUTURE, currentPeriodEnd: null }, NOW),
      { ok: true },
    );
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: FUTURE, currentPeriodEnd: FUTURE }, NOW),
      { ok: true },
    );
  });

  it("4: cancelAt == now denies (boundary counts as elapsed)", () => {
    assert.deepEqual(evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: NOW, currentPeriodEnd: FUTURE }, NOW), {
      ok: false,
      reason: "subscription_cancelled",
    });
    assert.deepEqual(evaluateSubscriptionLifecycle({ status: "CANCELLED", cancelAt: PAST, currentPeriodEnd: FUTURE }, NOW), {
      ok: false,
      reason: "subscription_cancelled",
    });
  });

  it("E: terminal CANCELLED (no cancelAt) denies", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "CANCELLED", cancelAt: null, currentPeriodEnd: FUTURE }, NOW),
      { ok: false, reason: "subscription_cancelled" },
    );
  });

  it("5: currentPeriodEnd == now denies (period ended, boundary)", () => {
    assert.deepEqual(evaluateSubscriptionLifecycle({ status: "ACTIVE", cancelAt: null, currentPeriodEnd: NOW }, NOW), {
      ok: false,
      reason: "subscription_period_ended",
    });
    assert.deepEqual(evaluateSubscriptionLifecycle({ status: "TRIALING", cancelAt: null, currentPeriodEnd: PAST }, NOW), {
      ok: false,
      reason: "subscription_period_ended",
    });
  });

  it("8/H: PAST_DUE preserves existing policy (access retained, no invented grace)", () => {
    assert.deepEqual(
      evaluateSubscriptionLifecycle({ status: "PAST_DUE", cancelAt: null, currentPeriodEnd: PAST }, NOW),
      { ok: true },
    );
  });
});

// --- Transactional access sync helper (mock) --------------------------------

type LicenseRow = { id: string; organizationId: string; productId: string; status: string; startsAt: Date; endsAt: Date | null };
type InstallationRow = { organizationId: string; productId: string; status: string };

function lic(status: string, extra: Partial<LicenseRow> = {}): LicenseRow {
  return { id: "lic-1", organizationId: "org-1", productId: "prod-wexpay", status, startsAt: PAST, endsAt: FUTURE, ...extra };
}

function makeMockDb(licenses: LicenseRow[], installations: InstallationRow[]) {
  const findInstall = (organizationId: string, productId: string) =>
    installations.find((row) => row.organizationId === organizationId && row.productId === productId) ?? null;

  return {
    licenses,
    installations,
    license: {
      findUnique: async ({ where: { id } }: { where: { id: string } }) => {
        const row = licenses.find((item) => item.id === id);
        return row ? { ...row } : null;
      },
      update: async ({ where: { id }, data }: { where: { id: string }; data: { status: string } }) => {
        const row = licenses.find((item) => item.id === id);
        if (!row) throw new Error("license not found");
        row.status = data.status;
        return { ...row };
      },
    },
    appInstallation: {
      findUnique: async ({
        where: { organizationId_productId },
      }: {
        where: { organizationId_productId: { organizationId: string; productId: string } };
      }) => {
        const row = findInstall(organizationId_productId.organizationId, organizationId_productId.productId);
        return row ? { ...row } : null;
      },
      update: async ({
        where: { organizationId_productId },
        data,
      }: {
        where: { organizationId_productId: { organizationId: string; productId: string } };
        data: { status: string };
      }) => {
        const row = findInstall(organizationId_productId.organizationId, organizationId_productId.productId);
        if (!row) throw new Error("installation not found");
        row.status = data.status;
        return { ...row };
      },
    },
  };
}

const SUB = {
  id: "sub-1",
  organizationId: "org-1",
  licenseId: "lic-1",
  status: "CANCELLED" as string,
  cancelAt: NOW as Date | null,
  currentPeriodEnd: FUTURE as Date | null,
};

describe("syncSubscriptionAccessState — terminal close", () => {
  it("L: CANCELLED now closes License + this installation atomically", async () => {
    const db = makeMockDb([lic("ACTIVE")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }]);

    const result = await syncSubscriptionAccessState(db as never, { subscription: { ...SUB }, previousStatus: "ACTIVE", now: NOW });

    assert.equal(result.intent, "close");
    assert.equal(result.reason, "subscription_cancelled");
    assert.deepEqual(result.license, { before: "ACTIVE", after: "CANCELLED" });
    assert.deepEqual(result.installation, { before: "ACTIVE", after: "DISABLED" });
    assert.equal(db.licenses[0].status, "CANCELLED");
    assert.equal(db.installations[0].status, "DISABLED");
  });

  it("D: EXPIRED maps License to EXPIRED and disables installation", async () => {
    const db = makeMockDb([lic("ACTIVE")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }]);

    const result = await syncSubscriptionAccessState(db as never, {
      subscription: { ...SUB, status: "EXPIRED", cancelAt: FUTURE },
      previousStatus: "ACTIVE",
      now: NOW,
    });

    assert.equal(result.reason, "subscription_expired");
    assert.equal(db.licenses[0].status, "EXPIRED");
    assert.equal(db.installations[0].status, "DISABLED");
  });

  it("M: future-dated cancellation is a no-op", async () => {
    const db = makeMockDb([lic("ACTIVE")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }]);

    const result = await syncSubscriptionAccessState(db as never, { subscription: { ...SUB, cancelAt: FUTURE }, previousStatus: "ACTIVE", now: NOW });

    assert.equal(result.intent, "noop");
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "ACTIVE");
  });

  it("12: idempotent — repeated close makes no further writes", async () => {
    const db = makeMockDb([lic("ACTIVE")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }]);

    const first = await syncSubscriptionAccessState(db as never, { subscription: { ...SUB }, previousStatus: "ACTIVE", now: NOW });
    const second = await syncSubscriptionAccessState(db as never, { subscription: { ...SUB }, previousStatus: "CANCELLED", now: NOW });

    assert.deepEqual(first.installation, { before: "ACTIVE", after: "DISABLED" });
    assert.deepEqual(second.license, { before: "CANCELLED", after: "CANCELLED" });
    assert.deepEqual(second.installation, { before: "DISABLED", after: "DISABLED" });
  });

  it("9: other product installation in the same organization is untouched", async () => {
    const db = makeMockDb(
      [lic("ACTIVE")],
      [
        { organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" },
        { organizationId: "org-1", productId: "prod-other", status: "ACTIVE" },
      ],
    );

    await syncSubscriptionAccessState(db as never, { subscription: { ...SUB }, previousStatus: "ACTIVE", now: NOW });

    assert.equal(db.installations[0].status, "DISABLED");
    assert.equal(db.installations[1].status, "ACTIVE");
  });

  it("10: another organization is untouched", async () => {
    const db = makeMockDb(
      [lic("ACTIVE")],
      [
        { organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" },
        { organizationId: "org-2", productId: "prod-wexpay", status: "ACTIVE" },
      ],
    );

    await syncSubscriptionAccessState(db as never, { subscription: { ...SUB }, previousStatus: "ACTIVE", now: NOW });

    assert.equal(db.installations[0].status, "DISABLED");
    assert.equal(db.installations[1].status, "ACTIVE");
  });

  it("11: license/organization mismatch throws and changes nothing", async () => {
    const db = makeMockDb([lic("ACTIVE", { organizationId: "org-OTHER" })], [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }]);

    await assert.rejects(
      () => syncSubscriptionAccessState(db as never, { subscription: { ...SUB }, previousStatus: "ACTIVE", now: NOW }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "tenant_mismatch",
    );
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "ACTIVE");
  });

  it("8-policy: terminal → PAST_DUE is refused with a clear validation error", async () => {
    const db = makeMockDb([lic("CANCELLED")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    await assert.rejects(
      () => syncSubscriptionAccessState(db as never, { subscription: { ...SUB, status: "PAST_DUE", cancelAt: null }, previousStatus: "CANCELLED", now: NOW }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "unsafe_transition",
    );
    assert.equal(db.licenses[0].status, "CANCELLED");
    assert.equal(db.installations[0].status, "DISABLED");
  });

  it("PAST_DUE from ACTIVE preserves existing state (no-op)", async () => {
    const db = makeMockDb([lic("ACTIVE")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "ACTIVE" }]);

    const result = await syncSubscriptionAccessState(db as never, { subscription: { ...SUB, status: "PAST_DUE", cancelAt: null }, previousStatus: "ACTIVE", now: NOW });

    assert.equal(result.intent, "noop");
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "ACTIVE");
  });
});

describe("syncSubscriptionAccessState — reactivation", () => {
  it("6: CANCELLED → ACTIVE reopens License + this installation", async () => {
    const db = makeMockDb([lic("CANCELLED")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    const result = await syncSubscriptionAccessState(db as never, {
      subscription: { ...SUB, status: "ACTIVE", cancelAt: null },
      previousStatus: "CANCELLED",
      now: NOW,
    });

    assert.equal(result.intent, "open");
    assert.deepEqual(result.license, { before: "CANCELLED", after: "ACTIVE" });
    assert.deepEqual(result.installation, { before: "DISABLED", after: "ACTIVE" });
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "ACTIVE");
  });

  it("7: EXPIRED → TRIALING reopens License as TRIAL + installation ACTIVE", async () => {
    const db = makeMockDb([lic("EXPIRED")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    const result = await syncSubscriptionAccessState(db as never, {
      subscription: { ...SUB, status: "TRIALING", cancelAt: null },
      previousStatus: "EXPIRED",
      now: NOW,
    });

    assert.equal(result.intent, "open");
    assert.equal(db.licenses[0].status, "TRIAL");
    assert.equal(db.installations[0].status, "ACTIVE");
  });

  it("2: ACTIVE → ACTIVE does NOT reopen a separately-disabled installation", async () => {
    const db = makeMockDb([lic("ACTIVE")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    const result = await syncSubscriptionAccessState(db as never, {
      subscription: { ...SUB, status: "ACTIVE", cancelAt: null },
      previousStatus: "ACTIVE",
      now: NOW,
    });

    assert.equal(result.intent, "noop");
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "DISABLED"); // untouched
  });

  it("2: TRIALING → TRIALING is a no-op", async () => {
    const db = makeMockDb([lic("TRIAL")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    const result = await syncSubscriptionAccessState(db as never, {
      subscription: { ...SUB, status: "TRIALING", cancelAt: null },
      previousStatus: "TRIALING",
      now: NOW,
    });

    assert.equal(result.intent, "noop");
    assert.equal(db.installations[0].status, "DISABLED");
  });

  it("12: idempotent — second reactivation (now ACTIVE→ACTIVE) is a no-op", async () => {
    const db = makeMockDb([lic("CANCELLED")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    await syncSubscriptionAccessState(db as never, { subscription: { ...SUB, status: "ACTIVE", cancelAt: null }, previousStatus: "CANCELLED", now: NOW });
    const second = await syncSubscriptionAccessState(db as never, { subscription: { ...SUB, status: "ACTIVE", cancelAt: null }, previousStatus: "ACTIVE", now: NOW });

    assert.equal(second.intent, "noop");
    assert.equal(db.licenses[0].status, "ACTIVE");
    assert.equal(db.installations[0].status, "ACTIVE");
  });

  it("3: terminal → ACTIVE with missing installation is blocked (rollback)", async () => {
    const db = makeMockDb([lic("CANCELLED")], []);

    await assert.rejects(
      () => syncSubscriptionAccessState(db as never, { subscription: { ...SUB, status: "ACTIVE", cancelAt: null }, previousStatus: "CANCELLED", now: NOW }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "reactivation_blocked",
    );
    assert.equal(db.licenses[0].status, "CANCELLED");
  });

  it("3: terminal → ACTIVE with PENDING installation is blocked (rollback)", async () => {
    const db = makeMockDb([lic("CANCELLED")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "PENDING" }]);

    await assert.rejects(
      () => syncSubscriptionAccessState(db as never, { subscription: { ...SUB, status: "ACTIVE", cancelAt: null }, previousStatus: "CANCELLED", now: NOW }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "reactivation_blocked",
    );
    assert.equal(db.licenses[0].status, "CANCELLED");
    assert.equal(db.installations[0].status, "PENDING");
  });

  it("3: terminal → ACTIVE with expired License is blocked (rollback)", async () => {
    const db = makeMockDb([lic("CANCELLED", { endsAt: PAST })], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    await assert.rejects(
      () => syncSubscriptionAccessState(db as never, { subscription: { ...SUB, status: "ACTIVE", cancelAt: null }, previousStatus: "CANCELLED", now: NOW }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "reactivation_blocked",
    );
    assert.equal(db.licenses[0].status, "CANCELLED");
    assert.equal(db.installations[0].status, "DISABLED");
  });

  it("3: terminal → ACTIVE with future-starting License is blocked (rollback)", async () => {
    const db = makeMockDb([lic("CANCELLED", { startsAt: FUTURE })], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    await assert.rejects(
      () => syncSubscriptionAccessState(db as never, { subscription: { ...SUB, status: "ACTIVE", cancelAt: null }, previousStatus: "CANCELLED", now: NOW }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "reactivation_blocked",
    );
    assert.equal(db.licenses[0].status, "CANCELLED");
  });

  it("3: terminal → ACTIVE with ended currentPeriodEnd is blocked (rollback)", async () => {
    const db = makeMockDb([lic("CANCELLED")], [{ organizationId: "org-1", productId: "prod-wexpay", status: "DISABLED" }]);

    await assert.rejects(
      () =>
        syncSubscriptionAccessState(db as never, {
          subscription: { ...SUB, status: "ACTIVE", cancelAt: null, currentPeriodEnd: PAST },
          previousStatus: "CANCELLED",
          now: NOW,
        }),
      (error: unknown) => error instanceof SubscriptionAccessSyncError && error.reason === "reactivation_blocked",
    );
    assert.equal(db.licenses[0].status, "CANCELLED");
    assert.equal(db.installations[0].status, "DISABLED");
  });
});
