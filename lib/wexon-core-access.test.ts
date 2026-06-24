import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertStaffEntitlementLimit, type ProductAccessResult } from "./wexon-core-access";

describe("assertStaffEntitlementLimit", () => {
  it("denies when Core access is not allowed", () => {
    const result = assertStaffEntitlementLimit(
      {
        allowed: false,
        reason: "license_missing",
        organization: null,
        product: null,
        license: null,
        installation: null,
        subscription: null,
        billingState: "none",
        entitlementMap: {},
      },
      2,
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.key, "staff_limit");
    }
  });

  it("enforces plan limit when access is allowed", () => {
    const result = assertStaffEntitlementLimit(
      {
        allowed: true,
        reason: null,
        organization: { id: "org-1", isDemo: false, isActive: true },
        product: { id: "p1", key: "wexpay" },
        license: { id: "lic-1" },
        installation: { id: "inst-1", status: "ACTIVE" },
        subscription: null,
        billingState: "ok",
        entitlementMap: { staff_limit: 2 },
      } as unknown as ProductAccessResult,
      2,
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.limit, 2);
      assert.equal(result.current, 2);
    }
  });
});
