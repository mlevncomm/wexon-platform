-- CreateEnum
CREATE TYPE "WexPayProviderCredentialMode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "WexPayWebhookEventStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "WexPayProviderCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mode" "WexPayProviderCredentialMode" NOT NULL DEFAULT 'TEST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configCiphertext" TEXT NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "maskedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WexPayProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WexPayWebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "rawBodyHash" TEXT NOT NULL,
    "status" "WexPayWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WexPayWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WexPayProviderCredential_organizationId_idx" ON "WexPayProviderCredential"("organizationId");

-- CreateIndex
CREATE INDEX "WexPayProviderCredential_provider_idx" ON "WexPayProviderCredential"("provider");

-- CreateIndex
CREATE INDEX "WexPayProviderCredential_isActive_idx" ON "WexPayProviderCredential"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WexPayProviderCredential_organizationId_provider_mode_key" ON "WexPayProviderCredential"("organizationId", "provider", "mode");

-- CreateIndex
CREATE INDEX "WexPayWebhookEvent_organizationId_idx" ON "WexPayWebhookEvent"("organizationId");

-- CreateIndex
CREATE INDEX "WexPayWebhookEvent_provider_idx" ON "WexPayWebhookEvent"("provider");

-- CreateIndex
CREATE INDEX "WexPayWebhookEvent_status_idx" ON "WexPayWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WexPayWebhookEvent_receivedAt_idx" ON "WexPayWebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WexPayWebhookEvent_provider_providerEventId_key" ON "WexPayWebhookEvent"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "WexPayProviderCredential" ADD CONSTRAINT "WexPayProviderCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WexPayWebhookEvent" ADD CONSTRAINT "WexPayWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
