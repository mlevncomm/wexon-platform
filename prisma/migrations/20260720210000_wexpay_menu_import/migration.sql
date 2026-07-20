-- Additive: MenuImportJob + MenuImportRowError for Smart Activation (PR-3).
-- Public table count 38 → 40.
-- Raw uploaded files are never persisted (normalizedStagingJson only).
-- Do NOT alter wexon_app NOLOGIN / NOBYPASSRLS.

CREATE TYPE "MenuImportJobStatus" AS ENUM (
  'UPLOADED',
  'DRY_RUN',
  'APPLYING',
  'APPLIED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "MenuImportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "MenuImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
    "checksum" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "normalizedStagingJson" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "appliedRows" INTEGER NOT NULL DEFAULT 0,
    "applyCursor" INTEGER NOT NULL DEFAULT 0,
    "previewJson" JSONB,
    "lastErrorCode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "forceReimport" BOOLEAN NOT NULL DEFAULT false,
    "dryRunAt" TIMESTAMP(3),
    "applyStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuImportJob_organizationId_idx" ON "MenuImportJob"("organizationId");
CREATE INDEX "MenuImportJob_journeyId_idx" ON "MenuImportJob"("journeyId");
CREATE INDEX "MenuImportJob_branchId_idx" ON "MenuImportJob"("branchId");
CREATE INDEX "MenuImportJob_checksum_idx" ON "MenuImportJob"("checksum");
CREATE INDEX "MenuImportJob_status_idx" ON "MenuImportJob"("status");
CREATE INDEX "MenuImportJob_createdByUserId_idx" ON "MenuImportJob"("createdByUserId");
CREATE INDEX "MenuImportJob_organizationId_checksum_idx" ON "MenuImportJob"("organizationId", "checksum");

ALTER TABLE "MenuImportJob"
  ADD CONSTRAINT "MenuImportJob_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuImportJob"
  ADD CONSTRAINT "MenuImportJob_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "ActivationJourney"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuImportJob"
  ADD CONSTRAINT "MenuImportJob_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuImportJob"
  ADD CONSTRAINT "MenuImportJob_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MenuImportRowError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "safeContextJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuImportRowError_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuImportRowError_jobId_idx" ON "MenuImportRowError"("jobId");
CREATE INDEX "MenuImportRowError_jobId_rowNumber_idx" ON "MenuImportRowError"("jobId", "rowNumber");

ALTER TABLE "MenuImportRowError"
  ADD CONSTRAINT "MenuImportRowError_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "MenuImportJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Security: RLS enable (not FORCE), deny PostgREST roles, grant wexon_app.
-- ---------------------------------------------------------------------------
ALTER TABLE public."MenuImportJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuImportRowError" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."MenuImportJob" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public."MenuImportRowError" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."MenuImportJob" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public."MenuImportRowError" FROM authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MenuImportJob" TO wexon_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MenuImportRowError" TO wexon_app';
    EXECUTE 'DROP POLICY IF EXISTS wexon_app_all ON public."MenuImportJob"';
    EXECUTE 'CREATE POLICY wexon_app_all ON public."MenuImportJob" FOR ALL TO wexon_app USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS wexon_app_all ON public."MenuImportRowError"';
    EXECUTE 'CREATE POLICY wexon_app_all ON public."MenuImportRowError" FOR ALL TO wexon_app USING (true) WITH CHECK (true)';
  END IF;
END
$$;
