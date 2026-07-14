-- Additive commercial fields for WexPay tiered pricing (non-destructive).
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "tierKey" TEXT;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "setupFee" DECIMAL(10,2);
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "processingFeePct" DECIMAL(5,2);
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "minimumTransactionCommitment" DECIMAL(10,2);
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "requiresManualReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "settlementDisplay" TEXT;

CREATE INDEX IF NOT EXISTS "Plan_tierKey_idx" ON "Plan"("tierKey");
