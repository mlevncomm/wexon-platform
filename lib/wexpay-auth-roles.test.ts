import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessWexPay,
  canConfigureWexPaySettings,
  canManageWexPay,
  canOperateCashierWexPay,
  canOperateKitchenWexPay,
} from "@/lib/wexpay-auth";
import { assertWexPayFeatureEnabled, isWexPayFeatureEnabled } from "@/lib/wexpay-entitlements";
import { getCanonicalTier } from "@/lib/wexpay-canonical-catalog";
import { buildOperationsSnapshotSignature } from "@/lib/wexpay-live-refresh";

type RoleMatrixRow = {
  role: string;
  access: boolean;
  manage: boolean;
  kitchen: boolean;
  cashier: boolean;
  settings: boolean;
};

const ROLE_MATRIX: RoleMatrixRow[] = [
  { role: "OWNER", access: true, manage: true, kitchen: true, cashier: true, settings: true },
  { role: "ADMIN", access: true, manage: true, kitchen: true, cashier: true, settings: true },
  { role: "MANAGER", access: true, manage: true, kitchen: true, cashier: true, settings: false },
  { role: "STAFF", access: true, manage: false, kitchen: true, cashier: true, settings: false },
  { role: "VIEWER", access: true, manage: false, kitchen: false, cashier: false, settings: false },
  { role: "BILLING", access: false, manage: false, kitchen: false, cashier: false, settings: false },
];

describe("wexpay role permission matrix", () => {
  for (const row of ROLE_MATRIX) {
    it(`${row.role} matches allowlist matrix`, () => {
      assert.equal(canAccessWexPay(row.role), row.access, "access");
      assert.equal(canManageWexPay(row.role), row.manage, "manage");
      assert.equal(canOperateKitchenWexPay(row.role), row.kitchen, "kitchen");
      assert.equal(canOperateCashierWexPay(row.role), row.cashier, "cashier");
      assert.equal(canConfigureWexPaySettings(row.role), row.settings, "settings");
    });
  }

  it("never grants STAFF global canManage", () => {
    assert.equal(canManageWexPay("STAFF"), false);
    assert.equal(canOperateKitchenWexPay("STAFF"), true);
    assert.equal(canOperateCashierWexPay("STAFF"), true);
  });
});

describe("canonical package feature gates", () => {
  it("Essential denies CSV/multi-location/advanced roles; Growth+ allows", () => {
    const essential = getCanonicalTier("essential").entitlements;
    const growth = getCanonicalTier("growth").entitlements;
    const scale = getCanonicalTier("scale").entitlements;
    const enterprise = getCanonicalTier("business_suite").entitlements;

    assert.equal(assertWexPayFeatureEnabled(essential, "feature_csv_export").ok, false);
    assert.equal(assertWexPayFeatureEnabled(essential, "feature_multi_location").ok, false);
    assert.equal(isWexPayFeatureEnabled(essential, "feature_advanced_roles"), false);
    assert.equal(isWexPayFeatureEnabled(essential, "feature_advanced_reports"), false);

    for (const map of [growth, scale, enterprise]) {
      assert.equal(assertWexPayFeatureEnabled(map, "feature_csv_export").ok, true);
      assert.equal(assertWexPayFeatureEnabled(map, "feature_multi_location").ok, true);
      assert.equal(isWexPayFeatureEnabled(map, "feature_advanced_roles"), true);
    }
  });

  it("fail-closes missing and malformed feature values", () => {
    assert.equal(assertWexPayFeatureEnabled({}, "feature_csv_export").ok, false);
    assert.equal(assertWexPayFeatureEnabled({ feature_csv_export: "nope" as never }, "feature_csv_export").ok, false);
    assert.equal(assertWexPayFeatureEnabled({ feature_csv_export: -1 }, "feature_csv_export").ok, false);
  });

  it("advanced_roles is invite-time only; Core Membership remains org-global (architectural limit)", () => {
    const essential = getCanonicalTier("essential").entitlements;
    assert.equal(isWexPayFeatureEnabled(essential, "feature_advanced_roles"), false);
    // StaffInvite gates MANAGER/ADMIN/BILLING when the flag is off.
    // Core /dashboard/users uses the same org-global Membership.role for OWNER/ADMIN
    // (needed outside WexPay), so product entitlement cannot safely own all role writes.
    // Existing advanced memberships are never auto-downgraded.
    assert.equal(canManageWexPay("MANAGER"), true);
    assert.equal(canConfigureWexPaySettings("ADMIN"), true);
  });
});

describe("operations snapshot signature", () => {
  it("stays stable when generatedAt changes but metrics do not", () => {
    const a = buildOperationsSnapshotSignature({
      metrics: { openOrders: 2, pendingKitchen: 1, pendingPaytrCount: 0 },
      openTablesCount: 3,
      notifications: [{ id: "n1", createdAt: "2026-01-01T00:00:00.000Z" }],
      generatedAt: "t1",
    });
    const b = buildOperationsSnapshotSignature({
      metrics: { openOrders: 2, pendingKitchen: 1, pendingPaytrCount: 0 },
      openTablesCount: 3,
      notifications: [{ id: "n1", createdAt: "2026-01-01T00:00:00.000Z" }],
      generatedAt: "t2",
    });
    assert.equal(a, b);
  });

  it("changes when kitchen/open table metrics change", () => {
    const a = buildOperationsSnapshotSignature({
      metrics: { openOrders: 2, pendingKitchen: 1 },
      openTablesCount: 3,
      notifications: [],
    });
    const b = buildOperationsSnapshotSignature({
      metrics: { openOrders: 3, pendingKitchen: 1 },
      openTablesCount: 3,
      notifications: [],
    });
    assert.notEqual(a, b);
  });
});
