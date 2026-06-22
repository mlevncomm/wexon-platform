-- Prevent PayTR merchant_oid collisions across operational Payment rows.
CREATE UNIQUE INDEX "Payment_provider_providerRef_unique"
ON "Payment" ("provider", "providerRef")
WHERE "providerRef" IS NOT NULL;
