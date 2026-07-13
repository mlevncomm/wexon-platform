-- CreateTable
CREATE TABLE "PublicIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "bodyJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicIdempotencyRecord_scopeKey_key" ON "PublicIdempotencyRecord"("scopeKey");

-- CreateIndex
CREATE INDEX "PublicIdempotencyRecord_expiresAt_idx" ON "PublicIdempotencyRecord"("expiresAt");
