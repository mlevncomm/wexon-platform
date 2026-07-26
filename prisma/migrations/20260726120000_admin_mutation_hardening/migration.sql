-- Admin PR5: additive rate-limit + idempotency tables (no drop/rename, no backfill).
-- Reverse: DROP TABLE "AdminMutationIdempotency"; DROP TYPE "AdminMutationIdempotencyStatus"; DROP TABLE "AdminMutationRateLimit";

CREATE TABLE "AdminMutationRateLimit" (
    "id" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminMutationRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminMutationRateLimit_bucketKey_windowStart_windowSeconds_key"
  ON "AdminMutationRateLimit"("bucketKey", "windowStart", "windowSeconds");

CREATE INDEX "AdminMutationRateLimit_expiresAt_idx" ON "AdminMutationRateLimit"("expiresAt");
CREATE INDEX "AdminMutationRateLimit_bucketKey_idx" ON "AdminMutationRateLimit"("bucketKey");

CREATE TYPE "AdminMutationIdempotencyStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "AdminMutationIdempotency" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "mutationKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "AdminMutationIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "organizationId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "resultJson" JSONB,
    "denyCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminMutationIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminMutationIdempotency_adminId_action_mutationKey_key"
  ON "AdminMutationIdempotency"("adminId", "action", "mutationKey");

CREATE INDEX "AdminMutationIdempotency_expiresAt_idx" ON "AdminMutationIdempotency"("expiresAt");
CREATE INDEX "AdminMutationIdempotency_adminId_action_idx" ON "AdminMutationIdempotency"("adminId", "action");
CREATE INDEX "AdminMutationIdempotency_organizationId_idx" ON "AdminMutationIdempotency"("organizationId");
