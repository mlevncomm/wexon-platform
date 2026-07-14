-- Soft-deactivation for plan entitlements (no physical deletes from admin UI).
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Entitlement_isActive_idx" ON "Entitlement"("isActive");
