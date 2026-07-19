-- WexPay Smart Activation foundation:
-- ActivationJourney + ActivationJourneyStep + TableQrToken
-- Legacy ACTIVE AppInstallation backfill (LEGACY_BACKFILL)
-- RLS/grants for new public tables
-- Public table count: 34 -> 37

-- CreateEnum
CREATE TYPE "ActivationJourneyStatus" AS ENUM ('IN_PROGRESS', 'BLOCKED', 'READY', 'ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivationJourneySource" AS ENUM ('SELF_SERVE', 'ADMIN_ASSISTED', 'LEGACY_BACKFILL');

-- CreateEnum
CREATE TYPE "ActivationStepKey" AS ENUM (
  'BUSINESS_PROFILE',
  'BRANCH_SETUP',
  'TABLE_SETUP',
  'STAFF_INVITE',
  'MENU_IMPORT',
  'PAYMENT_PROVIDER',
  'VALIDATION',
  'GO_LIVE'
);

-- CreateEnum
CREATE TYPE "ActivationJourneyStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "TableQrTokenStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "ActivationJourney" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "ActivationJourneyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "source" "ActivationJourneySource" NOT NULL,
    "currentStep" "ActivationStepKey" NOT NULL DEFAULT 'BUSINESS_PROFILE',
    "blockedReasonCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationJourneyStep" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "stepKey" "ActivationStepKey" NOT NULL,
    "status" "ActivationJourneyStepStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "safeMetadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationJourneyStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableQrToken" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "status" "TableQrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableQrToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivationJourney_organizationId_productId_key" ON "ActivationJourney"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "ActivationJourney_status_idx" ON "ActivationJourney"("status");

-- CreateIndex
CREATE INDEX "ActivationJourney_productId_idx" ON "ActivationJourney"("productId");

-- CreateIndex
CREATE INDEX "ActivationJourney_source_idx" ON "ActivationJourney"("source");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationJourneyStep_journeyId_stepKey_key" ON "ActivationJourneyStep"("journeyId", "stepKey");

-- CreateIndex
CREATE INDEX "ActivationJourneyStep_journeyId_idx" ON "ActivationJourneyStep"("journeyId");

-- CreateIndex
CREATE INDEX "ActivationJourneyStep_status_idx" ON "ActivationJourneyStep"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TableQrToken_tokenHash_key" ON "TableQrToken"("tokenHash");

-- CreateIndex
CREATE INDEX "TableQrToken_tableId_idx" ON "TableQrToken"("tableId");

-- CreateIndex
CREATE INDEX "TableQrToken_status_idx" ON "TableQrToken"("status");

-- CreateIndex
CREATE INDEX "TableQrToken_tokenPrefix_idx" ON "TableQrToken"("tokenPrefix");

-- At most one ACTIVE token per table (partial unique).
CREATE UNIQUE INDEX "TableQrToken_tableId_active_uidx"
  ON "TableQrToken"("tableId")
  WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "ActivationJourney" ADD CONSTRAINT "ActivationJourney_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivationJourney" ADD CONSTRAINT "ActivationJourney_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActivationJourneyStep" ADD CONSTRAINT "ActivationJourneyStep_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "ActivationJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableQrToken" ADD CONSTRAINT "TableQrToken_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Legacy backfill: ACTIVE WexPay AppInstallation -> journey ACTIVE + LEGACY_BACKFILL
-- Does NOT modify License, Subscription, AppInstallation, or ActivationFeeLedger.
-- Idempotent: ON CONFLICT DO NOTHING on (organizationId, productId).
-- ---------------------------------------------------------------------------
INSERT INTO "ActivationJourney" (
  "id",
  "organizationId",
  "productId",
  "status",
  "source",
  "currentStep",
  "completedAt",
  "version",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('legacy-journey:' || ai."organizationId" || ':' || ai."productId"),
  ai."organizationId",
  ai."productId",
  'ACTIVE'::"ActivationJourneyStatus",
  'LEGACY_BACKFILL'::"ActivationJourneySource",
  'GO_LIVE'::"ActivationStepKey",
  CURRENT_TIMESTAMP,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppInstallation" ai
INNER JOIN "Product" p ON p."id" = ai."productId"
WHERE ai."status" = 'ACTIVE'
  AND p."key" = 'wexpay'
ON CONFLICT ("organizationId", "productId") DO NOTHING;

INSERT INTO "ActivationJourneyStep" (
  "id",
  "journeyId",
  "stepKey",
  "status",
  "attemptCount",
  "completedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('legacy-step:' || j."id" || ':' || step_key::text),
  j."id",
  step_key,
  CASE
    WHEN step_key IN ('STAFF_INVITE'::"ActivationStepKey", 'MENU_IMPORT'::"ActivationStepKey")
      THEN 'SKIPPED'::"ActivationJourneyStepStatus"
    ELSE 'COMPLETED'::"ActivationJourneyStepStatus"
  END,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ActivationJourney" j
CROSS JOIN (
  VALUES
    ('BUSINESS_PROFILE'::"ActivationStepKey"),
    ('BRANCH_SETUP'::"ActivationStepKey"),
    ('TABLE_SETUP'::"ActivationStepKey"),
    ('STAFF_INVITE'::"ActivationStepKey"),
    ('MENU_IMPORT'::"ActivationStepKey"),
    ('PAYMENT_PROVIDER'::"ActivationStepKey"),
    ('VALIDATION'::"ActivationStepKey"),
    ('GO_LIVE'::"ActivationStepKey")
) AS steps(step_key)
WHERE j."source" = 'LEGACY_BACKFILL'
ON CONFLICT ("journeyId", "stepKey") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Security: RLS enable (not FORCE), deny PostgREST roles, grant wexon_app.
-- Do NOT alter wexon_app NOLOGIN / NOBYPASSRLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public."ActivationJourney" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ActivationJourneyStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TableQrToken" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."ActivationJourney" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public."ActivationJourneyStep" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public."TableQrToken" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."ActivationJourney" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public."ActivationJourneyStep" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public."TableQrToken" FROM authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ActivationJourney" TO wexon_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ActivationJourneyStep" TO wexon_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."TableQrToken" TO wexon_app';

    EXECUTE 'DROP POLICY IF EXISTS wexon_app_all ON public."ActivationJourney"';
    EXECUTE 'CREATE POLICY wexon_app_all ON public."ActivationJourney" FOR ALL TO wexon_app USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS wexon_app_all ON public."ActivationJourneyStep"';
    EXECUTE 'CREATE POLICY wexon_app_all ON public."ActivationJourneyStep" FOR ALL TO wexon_app USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS wexon_app_all ON public."TableQrToken"';
    EXECUTE 'CREATE POLICY wexon_app_all ON public."TableQrToken" FOR ALL TO wexon_app USING (true) WITH CHECK (true)';
  END IF;
END
$$;
