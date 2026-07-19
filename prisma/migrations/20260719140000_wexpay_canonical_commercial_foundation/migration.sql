-- Additive: ActivationFeeLedger + SubscriptionPayment quote snapshot columns.
-- Backfill canonical WexPay plan entitlements (idempotent upsert by planId+key).
-- Does not mutate License / AppInstallation / Subscription tenant rows.
-- Rollback: DROP TABLE "ActivationFeeLedger"; DROP TYPE "ActivationFeeStatus";
--   ALTER TABLE "SubscriptionPayment" DROP COLUMN snapshot fields listed below.

CREATE TYPE "ActivationFeeStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED', 'WAIVED_LEGACY');

CREATE TABLE "ActivationFeeLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "planId" TEXT,
    "status" "ActivationFeeStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "activationFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "taxRateBps" INTEGER NOT NULL DEFAULT 2000,
    "taxEnabledAtPurchase" BOOLEAN NOT NULL DEFAULT false,
    "taxModeAtPurchase" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "taxAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "grossAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "waivedReason" TEXT,
    "waivedByUserId" TEXT,
    "subscriptionPaymentId" TEXT,
    "reservedUntil" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationFeeLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivationFeeLedger_organizationId_productId_key" ON "ActivationFeeLedger"("organizationId", "productId");
CREATE UNIQUE INDEX "ActivationFeeLedger_subscriptionPaymentId_key" ON "ActivationFeeLedger"("subscriptionPaymentId");
CREATE INDEX "ActivationFeeLedger_status_idx" ON "ActivationFeeLedger"("status");
CREATE INDEX "ActivationFeeLedger_productId_idx" ON "ActivationFeeLedger"("productId");

ALTER TABLE "ActivationFeeLedger" ADD CONSTRAINT "ActivationFeeLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivationFeeLedger" ADD CONSTRAINT "ActivationFeeLedger_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivationFeeLedger" ADD CONSTRAINT "ActivationFeeLedger_subscriptionPaymentId_fkey" FOREIGN KEY ("subscriptionPaymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment" ADD COLUMN "subscriptionAmountMinor" INTEGER;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "activationFeeAmountMinor" INTEGER;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "netAmountMinor" INTEGER;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "taxRateBps" INTEGER;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "taxAmountMinor" INTEGER;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "grossAmountMinor" INTEGER;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "taxEnabledAtPurchase" BOOLEAN;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "taxModeAtPurchase" TEXT;

-- Helper: upsert one integer entitlement for a tierKey
-- Canonical values from data/wexpay-canonical-catalog.json (keep in sync with seed).

WITH plans AS (
  SELECT p.id, p."tierKey"
  FROM "Plan" p
  JOIN "Product" pr ON pr.id = p."productId"
  WHERE pr.key = 'wexpay' AND p."tierKey" IN ('essential', 'growth', 'scale', 'business_suite')
),
wanted(tier_key, ent_key, value_type, value_bool, value_int, value_string) AS (
  VALUES
  -- essential
  ('essential', 'branch_limit', 'INTEGER', NULL::boolean, 1, NULL::text),
  ('essential', 'table_limit', 'INTEGER', NULL, 50, NULL),
  ('essential', 'product_limit', 'INTEGER', NULL, 300, NULL),
  ('essential', 'staff_limit', 'INTEGER', NULL, 10, NULL),
  ('essential', 'monthly_order_limit', 'INTEGER', NULL, 6000, NULL),
  ('essential', 'api_request_limit', 'INTEGER', NULL, 0, NULL),
  ('essential', 'reporting_level', 'STRING', NULL, NULL, 'basic'),
  ('essential', 'integration_level', 'STRING', NULL, NULL, 'none'),
  ('essential', 'support_level', 'STRING', NULL, NULL, 'standard'),
  ('essential', 'role_level', 'STRING', NULL, NULL, 'basic'),
  ('essential', 'feature_subscriptions', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_qr_basic', 'BOOLEAN', true, NULL, NULL),
  ('essential', 'feature_qr_advanced', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_pos_bridge', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_multi_location', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_reporting_advanced', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_api_access', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_priority_support', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_fast_settlement_eligible', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_custom_settlement', 'BOOLEAN', false, NULL, NULL),
  ('essential', 'feature_invoicing_exports', 'BOOLEAN', true, NULL, NULL),
  -- growth
  ('growth', 'branch_limit', 'INTEGER', NULL, 5, NULL),
  ('growth', 'table_limit', 'INTEGER', NULL, 200, NULL),
  ('growth', 'product_limit', 'INTEGER', NULL, 1500, NULL),
  ('growth', 'staff_limit', 'INTEGER', NULL, 40, NULL),
  ('growth', 'monthly_order_limit', 'INTEGER', NULL, 30000, NULL),
  ('growth', 'api_request_limit', 'INTEGER', NULL, 50000, NULL),
  ('growth', 'reporting_level', 'STRING', NULL, NULL, 'standard'),
  ('growth', 'integration_level', 'STRING', NULL, NULL, 'basic'),
  ('growth', 'support_level', 'STRING', NULL, NULL, 'priority'),
  ('growth', 'role_level', 'STRING', NULL, NULL, 'standard'),
  ('growth', 'feature_subscriptions', 'BOOLEAN', true, NULL, NULL),
  ('growth', 'feature_qr_basic', 'BOOLEAN', true, NULL, NULL),
  ('growth', 'feature_qr_advanced', 'BOOLEAN', true, NULL, NULL),
  ('growth', 'feature_pos_bridge', 'BOOLEAN', false, NULL, NULL),
  ('growth', 'feature_multi_location', 'BOOLEAN', true, NULL, NULL),
  ('growth', 'feature_reporting_advanced', 'BOOLEAN', true, NULL, NULL),
  ('growth', 'feature_api_access', 'BOOLEAN', true, NULL, NULL),
  ('growth', 'feature_priority_support', 'BOOLEAN', true, NULL, NULL),
  ('growth', 'feature_fast_settlement_eligible', 'BOOLEAN', false, NULL, NULL),
  ('growth', 'feature_custom_settlement', 'BOOLEAN', false, NULL, NULL),
  ('growth', 'feature_invoicing_exports', 'BOOLEAN', true, NULL, NULL),
  -- scale
  ('scale', 'branch_limit', 'INTEGER', NULL, 25, NULL),
  ('scale', 'table_limit', 'INTEGER', NULL, 1000, NULL),
  ('scale', 'product_limit', 'INTEGER', NULL, 7500, NULL),
  ('scale', 'staff_limit', 'INTEGER', NULL, 200, NULL),
  ('scale', 'monthly_order_limit', 'INTEGER', NULL, 150000, NULL),
  ('scale', 'api_request_limit', 'INTEGER', NULL, 250000, NULL),
  ('scale', 'reporting_level', 'STRING', NULL, NULL, 'advanced'),
  ('scale', 'integration_level', 'STRING', NULL, NULL, 'advanced'),
  ('scale', 'support_level', 'STRING', NULL, NULL, 'priority'),
  ('scale', 'role_level', 'STRING', NULL, NULL, 'advanced'),
  ('scale', 'feature_subscriptions', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_qr_basic', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_qr_advanced', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_pos_bridge', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_multi_location', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_reporting_advanced', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_api_access', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_priority_support', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_fast_settlement_eligible', 'BOOLEAN', true, NULL, NULL),
  ('scale', 'feature_custom_settlement', 'BOOLEAN', false, NULL, NULL),
  ('scale', 'feature_invoicing_exports', 'BOOLEAN', true, NULL, NULL),
  -- business_suite / Enterprise
  ('business_suite', 'branch_limit', 'INTEGER', NULL, -1, NULL),
  ('business_suite', 'table_limit', 'INTEGER', NULL, -1, NULL),
  ('business_suite', 'product_limit', 'INTEGER', NULL, -1, NULL),
  ('business_suite', 'staff_limit', 'INTEGER', NULL, -1, NULL),
  ('business_suite', 'monthly_order_limit', 'INTEGER', NULL, -1, NULL),
  ('business_suite', 'api_request_limit', 'INTEGER', NULL, -1, NULL),
  ('business_suite', 'reporting_level', 'STRING', NULL, NULL, 'custom'),
  ('business_suite', 'integration_level', 'STRING', NULL, NULL, 'custom'),
  ('business_suite', 'support_level', 'STRING', NULL, NULL, 'enterprise'),
  ('business_suite', 'role_level', 'STRING', NULL, NULL, 'enterprise'),
  ('business_suite', 'feature_subscriptions', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_qr_basic', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_qr_advanced', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_pos_bridge', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_multi_location', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_reporting_advanced', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_api_access', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_priority_support', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_fast_settlement_eligible', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_custom_settlement', 'BOOLEAN', true, NULL, NULL),
  ('business_suite', 'feature_invoicing_exports', 'BOOLEAN', true, NULL, NULL)
)
INSERT INTO "Entitlement" (
  "id", "planId", "key", "valueType", "valueBool", "valueInt", "valueString", "isActive", "createdAt", "updatedAt"
)
SELECT
  md5(p.id || ':' || w.ent_key),
  p.id,
  w.ent_key,
  w.value_type::"EntitlementValueType",
  w.value_bool,
  w.value_int,
  w.value_string,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM plans p
JOIN wanted w ON w.tier_key = p."tierKey"
ON CONFLICT ("planId", "key") DO UPDATE SET
  "valueType" = EXCLUDED."valueType",
  "valueBool" = EXCLUDED."valueBool",
  "valueInt" = EXCLUDED."valueInt",
  "valueString" = EXCLUDED."valueString",
  "isActive" = true,
  "deactivatedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Sync canonical plan commercial fields (prices / names / setupFee) for known tierKeys.
UPDATE "Plan" p
SET
  "name" = CASE p."tierKey"
    WHEN 'essential' THEN 'WexPay Essential'
    WHEN 'growth' THEN 'WexPay Growth'
    WHEN 'scale' THEN 'WexPay Scale'
    WHEN 'business_suite' THEN 'WexPay Enterprise'
    ELSE p."name"
  END,
  "priceMonthly" = CASE p."tierKey"
    WHEN 'essential' THEN 7500
    WHEN 'growth' THEN 15000
    WHEN 'scale' THEN 35000
    WHEN 'business_suite' THEN 75000
    ELSE p."priceMonthly"
  END,
  "priceYearly" = CASE p."tierKey"
    WHEN 'essential' THEN 75000
    WHEN 'growth' THEN 150000
    WHEN 'scale' THEN 350000
    WHEN 'business_suite' THEN NULL
    ELSE p."priceYearly"
  END,
  "setupFee" = CASE p."tierKey"
    WHEN 'essential' THEN 20000
    WHEN 'growth' THEN 40000
    WHEN 'scale' THEN 90000
    WHEN 'business_suite' THEN 200000
    ELSE p."setupFee"
  END,
  "taxRatePct" = 20,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Product" pr
WHERE pr.id = p."productId"
  AND pr.key = 'wexpay'
  AND p."tierKey" IN ('essential', 'growth', 'scale', 'business_suite');

-- Legacy orgs with ACTIVE WexPay installation: waive activation so they are not re-billed.
INSERT INTO "ActivationFeeLedger" (
  "id", "organizationId", "productId", "status", "currency",
  "activationFeeMinor", "taxRateBps", "taxEnabledAtPurchase", "taxModeAtPurchase",
  "taxAmountMinor", "grossAmountMinor", "waivedReason", "createdAt", "updatedAt"
)
SELECT
  md5(ai."organizationId" || ':' || ai."productId" || ':legacy'),
  ai."organizationId",
  ai."productId",
  'WAIVED_LEGACY'::"ActivationFeeStatus",
  'TRY',
  0,
  2000,
  false,
  'EXCLUSIVE',
  0,
  0,
  'Pre-existing ACTIVE AppInstallation at activation-fee launch',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppInstallation" ai
JOIN "Product" p ON p.id = ai."productId"
WHERE p.key = 'wexpay'
  AND ai.status = 'ACTIVE'
ON CONFLICT ("organizationId", "productId") DO NOTHING;

-- Demo orgs: waive activation (never charge).
INSERT INTO "ActivationFeeLedger" (
  "id", "organizationId", "productId", "status", "currency",
  "activationFeeMinor", "taxRateBps", "taxEnabledAtPurchase", "taxModeAtPurchase",
  "taxAmountMinor", "grossAmountMinor", "waivedReason", "createdAt", "updatedAt"
)
SELECT
  md5(o.id || ':' || p.id || ':demo'),
  o.id,
  p.id,
  'WAIVED'::"ActivationFeeStatus",
  'TRY',
  0,
  2000,
  false,
  'EXCLUSIVE',
  0,
  0,
  'Demo organization',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN "Product" p
WHERE o."isDemo" = true
  AND p.key = 'wexpay'
ON CONFLICT ("organizationId", "productId") DO NOTHING;
