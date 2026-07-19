import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertEntitlementLimit, isEntitlementEnabled } from "@/lib/wexon-core-access";
import { entitlementDefaultsForTier } from "@/lib/wexpay-entitlement-map";

describe("assertEntitlementLimit canonical semantics", () => {
  it("denies missing, zero, invalid negative, and non-numeric values", () => {
    assert.equal(assertEntitlementLimit({}, "table_limit", 0).ok, false);
    assert.equal(assertEntitlementLimit({ table_limit: 0 }, "table_limit", 0).ok, false);
    assert.equal(assertEntitlementLimit({ table_limit: -2 }, "table_limit", 0).ok, false);
    assert.equal(assertEntitlementLimit({ table_limit: "abc" }, "table_limit", 0).ok, false);
    assert.equal(assertEntitlementLimit({ table_limit: true }, "table_limit", 0).ok, false);
  });

  it("allows under positive limit, denies at/above, and treats -1 as unlimited", () => {
    const under = assertEntitlementLimit({ table_limit: 50 }, "table_limit", 49);
    assert.equal(under.ok, true);
    if (under.ok) assert.equal(under.unlimited, false);

    const at = assertEntitlementLimit({ table_limit: 50 }, "table_limit", 50);
    assert.equal(at.ok, false);

    const unlimited = assertEntitlementLimit({ table_limit: -1 }, "table_limit", 10_000);
    assert.equal(unlimited.ok, true);
    if (unlimited.ok) assert.equal(unlimited.unlimited, true);
  });

  it("gates features as missing/0 deny and 1/true enable", () => {
    assert.equal(isEntitlementEnabled({}, "feature_qr_advanced"), false);
    assert.equal(isEntitlementEnabled({ feature_qr_advanced: 0 }, "feature_qr_advanced"), false);
    assert.equal(isEntitlementEnabled({ feature_qr_advanced: 1 }, "feature_qr_advanced"), true);
    assert.equal(isEntitlementEnabled({ feature_qr_advanced: true }, "feature_qr_advanced"), true);
    assert.equal(isEntitlementEnabled({ feature_qr_advanced: false }, "feature_qr_advanced"), false);
  });

  it("canonical Essential defaults allow first table and deny missing keys", () => {
    const essential = entitlementDefaultsForTier("essential");
    assert.equal(assertEntitlementLimit(essential, "table_limit", 0).ok, true);
    assert.equal(assertEntitlementLimit(essential, "table_limit", 50).ok, false);
    assert.equal(assertEntitlementLimit(essential, "unknown_limit", 0).ok, false);
    assert.equal(isEntitlementEnabled(essential, "feature_qr_basic"), true);
    assert.equal(isEntitlementEnabled(essential, "feature_api_access"), false);
  });
});
