-- Additive: TableAssistRequest lifecycle + Payment.method + org rollout flag.
-- Partial unique index enforces one open payment request per table.
-- Do NOT alter wexon_app NOLOGIN / NOBYPASSRLS.

-- CreateEnum
CREATE TYPE "TableAssistKind" AS ENUM ('PAYMENT_REQUEST', 'WAITER_CALL');

-- CreateEnum
CREATE TYPE "TableAssistStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethodPreference" AS ENUM ('CASH', 'PHYSICAL_POS');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PHYSICAL_POS', 'INTEGRATED_TERMINAL', 'ONLINE_PSP');

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN "paymentRequestV2Enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN "method" "PaymentMethod";

-- CreateTable
CREATE TABLE "TableAssistRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "kind" "TableAssistKind" NOT NULL,
    "paymentMethod" "PaymentMethodPreference",
    "mode" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "status" "TableAssistStatus" NOT NULL DEFAULT 'OPEN',
    "requestedAmount" DECIMAL(10,2),
    "businessNotificationId" TEXT,
    "acknowledgedByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedPaymentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "TableAssistRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableAssistRequest_businessNotificationId_key" ON "TableAssistRequest"("businessNotificationId");

-- CreateIndex
CREATE INDEX "TableAssistRequest_tableId_status_idx" ON "TableAssistRequest"("tableId", "status");

-- CreateIndex
CREATE INDEX "TableAssistRequest_branchId_status_idx" ON "TableAssistRequest"("branchId", "status");

-- CreateIndex
CREATE INDEX "TableAssistRequest_organizationId_status_idx" ON "TableAssistRequest"("organizationId", "status");

-- Partial unique: at most one open/acknowledged PAYMENT_REQUEST per table
CREATE UNIQUE INDEX "table_assist_request_open_payment_per_table"
ON "TableAssistRequest" ("tableId")
WHERE "kind" = 'PAYMENT_REQUEST' AND "status" IN ('OPEN', 'ACKNOWLEDGED');

-- AddForeignKey
ALTER TABLE "TableAssistRequest" ADD CONSTRAINT "TableAssistRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableAssistRequest" ADD CONSTRAINT "TableAssistRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableAssistRequest" ADD CONSTRAINT "TableAssistRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TableAssistRequest" ADD CONSTRAINT "TableAssistRequest_businessNotificationId_fkey" FOREIGN KEY ("businessNotificationId") REFERENCES "BusinessNotification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TableAssistRequest" ADD CONSTRAINT "TableAssistRequest_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TableAssistRequest" ADD CONSTRAINT "TableAssistRequest_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TableAssistRequest" ADD CONSTRAINT "TableAssistRequest_resolvedPaymentId_fkey" FOREIGN KEY ("resolvedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Security: RLS enable (not FORCE), deny PostgREST roles, grant wexon_app.
-- ---------------------------------------------------------------------------
ALTER TABLE public."TableAssistRequest" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."TableAssistRequest" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."TableAssistRequest" FROM authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."TableAssistRequest" TO wexon_app';
  END IF;
END
$$;
