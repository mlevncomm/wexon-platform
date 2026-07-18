/**
 * Local staging prova for A+B (RLS enable + revoke anon/authenticated).
 * Uses ephemeral local E2E Postgres only — never production Supabase.
 *
 * Usage:
 *   npm run e2e:db:up && npm run e2e:db:prepare
 *   npm run db:prove:rls-revoke
 */
import pg from "pg";
import {
  applyIsolatedE2eEnv,
  isolatedE2eConnectionUrl,
} from "./e2e-isolated-guards.mjs";

applyIsolatedE2eEnv();
const url = isolatedE2eConnectionUrl();
if (!url) {
  console.error("[prove-rls] isolated e2e URL missing");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

async function q(sql, params) {
  return client.query(sql, params);
}

try {
  await q(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  END $$;`);

  await q(`GRANT USAGE ON SCHEMA public TO anon, authenticated`);
  await q(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`);

  const before = await q(
    `SELECT has_table_privilege('anon', 'public."User"', 'SELECT') AS anon_select`,
  );
  if (!before.rows[0]?.anon_select) {
    throw new Error("Precondition failed: anon should SELECT User after GRANT");
  }

  // Re-apply hardening (idempotent with production migration).
  await q(`
    DO $$
    DECLARE t text;
    BEGIN
      FOR t IN
        SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      END LOOP;
    END $$;
  `);

  await q(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
      END IF;
    END $$;
  `);

  const afterPriv = await q(
    `SELECT has_table_privilege('anon', 'public."User"', 'SELECT') AS anon_select,
            has_table_privilege('anon', 'public."WexPayProviderCredential"', 'SELECT') AS anon_cred_select`,
  );
  const rlsOff = await q(`
    SELECT COUNT(*)::int AS n
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
  `);

  if (afterPriv.rows[0]?.anon_select || afterPriv.rows[0]?.anon_cred_select) {
    throw new Error("Expected anon SELECT to be false after REVOKE");
  }
  if ((rlsOff.rows[0]?.n ?? 1) !== 0) {
    throw new Error(`Expected all public tables RLS-enabled; still off=${rlsOff.rows[0]?.n}`);
  }

  const appRead = await q(`SELECT COUNT(*)::int AS n FROM public."User"`);
  if (typeof appRead.rows[0]?.n !== "number") {
    throw new Error("App connection failed to read User after hardening");
  }

  console.log("[prove-rls] OK — local A+B prova passed");
  console.log(
    JSON.stringify({
      anon_select_before: true,
      anon_select_after: false,
      rls_disabled_tables: 0,
      user_count_readable_by_app: appRead.rows[0].n,
    }),
  );
} finally {
  await client.end();
}
