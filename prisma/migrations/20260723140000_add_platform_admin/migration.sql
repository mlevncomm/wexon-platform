-- Additive: PlatformAdmin for Wexon platform operators (PR2A).
-- Public table count 40 → 41.
-- Do NOT backfill from ADMIN_EMAILS.
-- Do NOT alter User/Membership/license/subscription data.
-- Do NOT alter wexon_app NOLOGIN / NOBYPASSRLS.

CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cloudflareSubject" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdmin_emailNormalized_key" ON "PlatformAdmin"("emailNormalized");
CREATE UNIQUE INDEX "PlatformAdmin_cloudflareSubject_key" ON "PlatformAdmin"("cloudflareSubject");
CREATE INDEX "PlatformAdmin_isActive_idx" ON "PlatformAdmin"("isActive");

-- ---------------------------------------------------------------------------
-- Security: RLS enable (not FORCE), deny PostgREST roles, grant wexon_app.
-- ---------------------------------------------------------------------------
ALTER TABLE public."PlatformAdmin" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."PlatformAdmin" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."PlatformAdmin" FROM authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PlatformAdmin" TO wexon_app';
    EXECUTE 'DROP POLICY IF EXISTS wexon_app_all ON public."PlatformAdmin"';
    EXECUTE 'CREATE POLICY wexon_app_all ON public."PlatformAdmin" FOR ALL TO wexon_app USING (true) WITH CHECK (true)';
  END IF;
END
$$;
