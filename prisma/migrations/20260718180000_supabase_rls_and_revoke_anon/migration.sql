-- Harden PostgREST exposure for Prisma-only Wexon Platform.
-- A: ENABLE ROW LEVEL SECURITY on all public tables (deny-by-default for anon/authenticated).
-- B: REVOKE table/sequence/function privileges from anon + authenticated when those roles exist.
-- Runtime Prisma uses the postgres role (rolbypassrls=true) and continues to work without policies.
-- service_role grants are left intact for Supabase platform tooling.
-- Local/CI Postgres without Supabase roles skips REVOKE safely.

ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AppInstallation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BillingPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CustomerOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Entitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."License" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuModifierGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuModifierOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuProductModifierGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItemModifier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PublicIdempotencyRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ReceiptRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Restaurant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RestaurantTable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SubscriptionPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WebhookEndpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WexPayProviderCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WexPayWebhookEvent" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated';
  END IF;
END
$$;
