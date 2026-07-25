import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  __clearCommercialAuditWriterForTests,
  __setCommercialAuditWriterForTests,
  assertAllowedAdminSubscriptionProvider,
  assertCommercialAuditOverrideAllowed,
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
import {
  classifyPlanChangeBySortOrder,
  evaluateActivationFeeWaivePolicy,
} from "@/lib/wexon-admin-commercial-policy";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import { parseSubscriptionCreatePayload, parseLicensePlanPayload, parseActivationFeeWaivePayload } from "@/lib/wexon-admin-validation";

describe("admin commercial consistency unit", () => {
  afterEach(() => {
    __clearCommercialAuditWriterForTests();
  });

  it("classifies upgrade/downgrade/lateral via canonical tiers", () => {
    assert.equal(classifyPlanChange("essential", "growth"), "upgrade");
    assert.equal(classifyPlanChange("scale", "essential"), "downgrade");
    assert.equal(classifyPlanChange("growth", "growth"), "lateral");
    assert.equal(classifyPlanChange("wexpay_essential", "wexpay_business_suite"), "upgrade");
  });

  it("UI sortOrder classification matches upgrade/downgrade/lateral", () => {
    assert.equal(classifyPlanChangeBySortOrder(1, 2), "upgrade");
    assert.equal(classifyPlanChangeBySortOrder(3, 1), "downgrade");
    assert.equal(classifyPlanChangeBySortOrder(2, 2), "lateral");
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

  it("activation waive policy allows null/FAILED/CANCELED/EXPIRED and blocks open/PAID", () => {
    assert.equal(
      evaluateActivationFeeWaivePolicy({
        status: "PENDING",
        reservedUntil: null,
        subscriptionPaymentId: null,
      }).canWaive,
      true,
    );
    for (const paymentStatus of ["FAILED", "CANCELED", "EXPIRED"] as const) {
      assert.equal(
        evaluateActivationFeeWaivePolicy({
          status: "PENDING",
          reservedUntil: null,
          subscriptionPaymentId: "pay_1",
          paymentStatus,
        }).canWaive,
        true,
      );
    }
    for (const paymentStatus of ["INITIATED", "TOKEN_CREATED", "PENDING_CALLBACK", "PAID"] as const) {
      const denied = evaluateActivationFeeWaivePolicy({
        status: "PENDING",
        reservedUntil: new Date(Date.now() - 60_000),
        subscriptionPaymentId: "pay_1",
        paymentStatus,
      });
      assert.equal(denied.canWaive, false);
    }
    const paid = evaluateActivationFeeWaivePolicy({
      status: "PENDING",
      reservedUntil: new Date(Date.now() - 60_000),
      subscriptionPaymentId: "pay_1",
      paymentStatus: "PAID",
    });
    assert.equal(paid.canWaive, false);
    if (!paid.canWaive) {
      assert.match(paid.message, /tahsilat|uzlaştırma/i);
    }
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

  it("audit override setter is production-guarded", () => {
    const localTestEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "",
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5433/wexon_e2e",
      DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:5433/wexon_e2e",
    };
    assert.doesNotThrow(() => assertCommercialAuditOverrideAllowed(localTestEnv));
    assert.throws(
      () => assertCommercialAuditOverrideAllowed({ ...localTestEnv, NODE_ENV: "production" }),
      /NODE_ENV=test/,
    );
    assert.throws(
      () => assertCommercialAuditOverrideAllowed({ ...localTestEnv, VERCEL_ENV: "production" }),
      /VERCEL_ENV|reddedildi/,
    );
    assert.throws(
      () => assertCommercialAuditOverrideAllowed({ ...localTestEnv, VERCEL_ENV: "preview" }),
      /VERCEL_ENV|reddedildi/,
    );
    assert.throws(
      () =>
        assertCommercialAuditOverrideAllowed({
          ...localTestEnv,
          DATABASE_URL: "postgresql://postgres:postgres@db.xxx.supabase.co:5432/postgres",
          DIRECT_URL: undefined,
        }),
      /loopback|reddedildi/,
    );

    // Live setter is exercised under NODE_ENV=test in DB-backed suites.
  });
});
