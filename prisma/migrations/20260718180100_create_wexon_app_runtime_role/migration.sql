-- P1: least-privilege runtime role scaffold (Option E).
-- Creates NOLOGIN wexon_app without BYPASSRLS and grants DML + permissive RLS policies
-- so the role can see rows once LOGIN is enabled via Dashboard (password not stored in git).
-- Keep DIRECT_URL / migrate on postgres. Switch DATABASE_URL to wexon_app only after LOGIN + Vercel env update.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
    CREATE ROLE wexon_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO wexon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wexon_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wexon_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wexon_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO wexon_app;

-- Permissive policies for wexon_app only (anon/authenticated remain denied: no policy + revoked grants).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_prisma_migrations',
    'ApiKey',
    'AppInstallation',
    'AuditLog',
    'BillingPayment',
    'Branch',
    'BusinessNotification',
    'CustomerOrder',
    'Entitlement',
    'Invoice',
    'License',
    'Membership',
    'MenuCategory',
    'MenuModifierGroup',
    'MenuModifierOption',
    'MenuProduct',
    'MenuProductModifierGroup',
    'OrderItem',
    'OrderItemModifier',
    'Organization',
    'Payment',
    'Plan',
    'Product',
    'PublicIdempotencyRecord',
    'ReceiptRequest',
    'Restaurant',
    'RestaurantTable',
    'Subscription',
    'SubscriptionPayment',
    'User',
    'WebhookEndpoint',
    'WexPayProviderCredential',
    'WexPayWebhookEvent'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS wexon_app_all ON public.%I',
      t
    );
    EXECUTE format(
      'CREATE POLICY wexon_app_all ON public.%I FOR ALL TO wexon_app USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END
$$;
