import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertWexPayFeatureEnabled,
  isWexPayFeatureEnabled,
  requireWexPayFeatureEnabled,
} from "@/lib/wexpay-entitlements";
import { WexPayValidationError } from "@/lib/wexpay-validation";

describe("assertWexPayFeatureEnabled", () => {
  it("denies Essential CSV export (missing / false)", () => {
    assert.equal(assertWexPayFeatureEnabled({}, "feature_csv_export").ok, false);
    assert.equal(assertWexPayFeatureEnabled({ feature_csv_export: false }, "feature_csv_export").ok, false);
    assert.equal(assertWexPayFeatureEnabled({ feature_csv_export: 0 }, "feature_csv_export").ok, false);
  });

  it("allows Growth+ CSV export", () => {
    assert.equal(assertWexPayFeatureEnabled({ feature_csv_export: true }, "feature_csv_export").ok, true);
    assert.equal(assertWexPayFeatureEnabled({ feature_csv_export: 1 }, "feature_csv_export").ok, true);
  });

  it("denies multi-location when feature is off", () => {
    const denied = assertWexPayFeatureEnabled({ feature_multi_location: false }, "feature_multi_location");
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.match(denied.message, /feature_multi_location/);
    }
  });

  it("requireWexPayFeatureEnabled throws validation error", () => {
    assert.throws(
      () => requireWexPayFeatureEnabled({ feature_csv_export: false }, "feature_csv_export"),
      (error: unknown) => error instanceof WexPayValidationError,
    );
  });

  it("isWexPayFeatureEnabled mirrors assert result", () => {
    assert.equal(isWexPayFeatureEnabled({ feature_advanced_reports: true }, "feature_advanced_reports"), true);
    assert.equal(isWexPayFeatureEnabled({ feature_advanced_reports: false }, "feature_advanced_reports"), false);
  });
});
