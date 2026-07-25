import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAllowedAdminSubscriptionProvider,
  assertExistingUsageWithinLimit,
  classifyPlanChange,
  entitlementsFromRecords,
  evaluateDowngradeBreaches,
  formatDowngradeDenialMessage,
  isAllowedAdminSubscriptionProvider,
  isFreshActivationReservation,
  maskEmailForAudit,
  maskMerchantOid,
  sanitizeCommercialReason,
} from "@/lib/wexon-admin-commercial-consistency";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import { parseSubscriptionCreatePayload, parseLicensePlanPayload, parseActivationFeeWaivePayload } from "@/lib/wexon-admin-validation";

describe("admin commercial consistency unit", () => {
  it("classifies upgrade/downgrade/lateral via canonical tiers", () => {
    assert.equal(classifyPlanChange("essential", "growth"), "upgrade");
    assert.equal(classifyPlanChange("scale", "essential"), "downgrade");
    assert.equal(classifyPlanChange("growth", "growth"), "lateral");
    assert.equal(classifyPlanChange("wexpay_essential", "wexpay_business_suite"), "upgrade");
  });

  it("entitlement existing-usage semantics: missing deny, 0 closed, -1 unlimited, positive hard limit", () => {
    assert.equal(assertExistingUsageWithinLimit({}, "branch_limit", 1).ok, false);
    assert.equal(assertExistingUsageWithinLimit({ branch_limit: 0 }, "branch_limit", 1).ok, false);
    assert.equal(assertExistingUsageWithinLimit({ branch_limit: 0 }, "branch_limit", 0).ok, true);
    assert.equal(assertExistingUsageWithinLimit({ branch_limit: -1 }, "branch_limit", 999).ok, true);
    assert.equal(assertExistingUsageWithinLimit({ branch_limit: 5 }, "branch_limit", 5).ok, true);
    assert.equal(assertExistingUsageWithinLimit({ branch_limit: 5 }, "branch_limit", 6).ok, false);
  });

  it("downgrade breach summary is Turkish and non-PII", () => {
    const breaches = evaluateDowngradeBreaches({
      entitlements: entitlementsFromRecords([
        { key: "branch_limit", valueInt: 1, valueBool: null, valueString: null },
        { key: "table_limit", valueInt: 10, valueBool: null, valueString: null },
        { key: "product_limit", valueInt: 100, valueBool: null, valueString: null },
        { key: "staff_limit", valueInt: 5, valueBool: null, valueString: null },
        { key: "feature_multi_location", valueBool: false, valueInt: null, valueString: null },
      ]),
      usage: {
        restaurants: 2,
        branches: 3,
        tables: 40,
        products: 20,
        staff: 2,
        multiLocationInUse: true,
      },
    });
    assert.ok(breaches.length >= 2);
    const message = formatDowngradeDenialMessage(breaches);
    assert.match(message, /Paket düşürme reddedildi/);
    assert.doesNotMatch(message, /@|password|secret|prisma/i);
  });

  it("provider allowlist accepts only admin_manual|paytr", () => {
    assert.equal(isAllowedAdminSubscriptionProvider("admin_manual"), true);
    assert.equal(isAllowedAdminSubscriptionProvider("paytr"), true);
    assert.equal(isAllowedAdminSubscriptionProvider("mock"), false);
    assert.equal(isAllowedAdminSubscriptionProvider("stripe"), false);
    assert.throws(() => assertAllowedAdminSubscriptionProvider("mock"), AdminValidationError);
    assert.throws(() => assertAllowedAdminSubscriptionProvider("stripe"), AdminValidationError);
  });

  it("parseSubscriptionCreatePayload rejects mock/stripe", () => {
    const base = new FormData();
    base.set("organizationId", "org_1");
    base.set("planId", "plan_1");
    base.set("interval", "MONTHLY");
    base.set("currentPeriodStart", "2026-01-01");
    base.set("provider", "mock");
    assert.throws(() => parseSubscriptionCreatePayload(base), /admin_manual veya paytr/);
    base.set("provider", "paytr");
    const ok = parseSubscriptionCreatePayload(base);
    assert.equal(ok.provider, "paytr");
  });

  it("reason validation and audit masking", () => {
    assert.throws(() => sanitizeCommercialReason("kısa", "Gerekçe"), AdminValidationError);
    const reason = sanitizeCommercialReason("  Geçerli bir operasyon gerekçesi  ", "Gerekçe");
    assert.equal(reason, "Geçerli bir operasyon gerekçesi");
    assert.equal(maskEmailForAudit("admin@wexon.dev"), "ad***@wexon.dev");
    assert.equal(maskMerchantOid("ABCDEFGHIJKLMNOP"), "ABCD…MNOP");
    assert.equal(maskMerchantOid("ab"), "ab…");
  });

  it("fresh reservation detection and settled immutability helpers", () => {
    const future = new Date(Date.now() + 60_000);
    assert.equal(
      isFreshActivationReservation({
        status: "PENDING",
        reservedUntil: future,
        subscriptionPaymentId: "pay_1",
      }),
      true,
    );
    assert.equal(
      isFreshActivationReservation({
        status: "PENDING",
        reservedUntil: new Date(Date.now() - 1000),
        subscriptionPaymentId: "pay_1",
      }),
      false,
    );
    assert.equal(
      isFreshActivationReservation({
        status: "PAID",
        reservedUntil: future,
        subscriptionPaymentId: "pay_1",
      }),
      false,
    );
  });

  it("plan change and waive payloads require reason + confirmation", () => {
    const planForm = new FormData();
    planForm.set("planId", "plan_1");
    assert.throws(() => parseLicensePlanPayload(planForm), /gerekçe|zorunlu/i);
    planForm.set("reason", "Paket yükseltme operasyon gerekçesi");
    planForm.set("confirmed", "1");
    assert.equal(parseLicensePlanPayload(planForm).confirmed, true);

    const waiveForm = new FormData();
    waiveForm.set("productId", "prod_1");
    waiveForm.set("reason", "Demo müşteri aktivasyon muafiyeti");
    waiveForm.set("confirmed", "true");
    assert.equal(parseActivationFeeWaivePayload(waiveForm).confirmed, true);
  });
});
