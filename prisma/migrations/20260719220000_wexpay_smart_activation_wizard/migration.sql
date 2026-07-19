-- Additive: StaffInvite for Smart Activation wizard (PR-2).
-- Public table count 37 → 38.
-- Raw invite tokens are never stored (tokenHash only).
-- Do NOT alter wexon_app NOLOGIN / NOBYPASSRLS.

CREATE TYPE "StaffInviteDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "deliveryStatus" "StaffInviteDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "lastDeliveryErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");

CREATE INDEX "StaffInvite_organizationId_idx" ON "StaffInvite"("organizationId");
CREATE INDEX "StaffInvite_email_idx" ON "StaffInvite"("email");
CREATE INDEX "StaffInvite_expiresAt_idx" ON "StaffInvite"("expiresAt");
CREATE INDEX "StaffInvite_deliveryStatus_idx" ON "StaffInvite"("deliveryStatus");
CREATE INDEX "StaffInvite_createdByUserId_idx" ON "StaffInvite"("createdByUserId");
CREATE INDEX "StaffInvite_tokenPrefix_idx" ON "StaffInvite"("tokenPrefix");

-- At most one open (unaccepted, unrevoked) invite per organization + email.
CREATE UNIQUE INDEX "StaffInvite_org_email_open_uidx"
ON "StaffInvite" ("organizationId", "email")
WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

ALTER TABLE "StaffInvite"
  ADD CONSTRAINT "StaffInvite_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffInvite"
  ADD CONSTRAINT "StaffInvite_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Security: RLS enable (not FORCE), deny PostgREST roles, grant wexon_app.
-- ---------------------------------------------------------------------------
ALTER TABLE public."StaffInvite" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."StaffInvite" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."StaffInvite" FROM authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."StaffInvite" TO wexon_app';
    EXECUTE 'DROP POLICY IF EXISTS wexon_app_all ON public."StaffInvite"';
    EXECUTE 'CREATE POLICY wexon_app_all ON public."StaffInvite" FOR ALL TO wexon_app USING (true) WITH CHECK (true)';
  END IF;
END
$$;
