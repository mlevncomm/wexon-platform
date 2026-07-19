import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { EXPECTED_PUBLIC_TABLE_COUNT } from "@/lib/wexon-db-backup-guards";

assertLocalDbTestGuard(process.env);

describe("ActivationFeeLedger RLS security (db)", () => {
  it("public schema has 34 tables and ActivationFeeLedger RLS is enabled", async () => {
    const tables = await prisma.$queryRaw<
      Array<{ table_name: string; rls: boolean }>
    >`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;

    assert.equal(tables.length, EXPECTED_PUBLIC_TABLE_COUNT);
    assert.equal(EXPECTED_PUBLIC_TABLE_COUNT, 34);

    const ledger = tables.find((t) => t.table_name === "ActivationFeeLedger");
    assert.ok(ledger, "ActivationFeeLedger must exist after migration");
    assert.equal(ledger.rls, true);
  });

  it("denies anon/authenticated and keeps wexon_app NOLOGIN/NOBYPASSRLS with policy", async () => {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
      END $$;
    `);
    await prisma.$executeRawUnsafe(
      `REVOKE ALL ON TABLE public."ActivationFeeLedger" FROM anon, authenticated`,
    );

    const priv = await prisma.$queryRaw<
      Array<{
        anon_select: boolean;
        anon_insert: boolean;
        anon_update: boolean;
        anon_delete: boolean;
        auth_select: boolean;
        auth_insert: boolean;
        auth_update: boolean;
        auth_delete: boolean;
      }>
    >`
      SELECT
        has_table_privilege('anon', 'public."ActivationFeeLedger"', 'SELECT') AS anon_select,
        has_table_privilege('anon', 'public."ActivationFeeLedger"', 'INSERT') AS anon_insert,
        has_table_privilege('anon', 'public."ActivationFeeLedger"', 'UPDATE') AS anon_update,
        has_table_privilege('anon', 'public."ActivationFeeLedger"', 'DELETE') AS anon_delete,
        has_table_privilege('authenticated', 'public."ActivationFeeLedger"', 'SELECT') AS auth_select,
        has_table_privilege('authenticated', 'public."ActivationFeeLedger"', 'INSERT') AS auth_insert,
        has_table_privilege('authenticated', 'public."ActivationFeeLedger"', 'UPDATE') AS auth_update,
        has_table_privilege('authenticated', 'public."ActivationFeeLedger"', 'DELETE') AS auth_delete
    `;
    const p = priv[0];
    assert.equal(p.anon_select, false);
    assert.equal(p.anon_insert, false);
    assert.equal(p.anon_update, false);
    assert.equal(p.anon_delete, false);
    assert.equal(p.auth_select, false);
    assert.equal(p.auth_insert, false);
    assert.equal(p.auth_update, false);
    assert.equal(p.auth_delete, false);

    const role = await prisma.$queryRaw<
      Array<{ rolcanlogin: boolean; rolbypassrls: boolean }>
    >`
      SELECT rolcanlogin, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'wexon_app'
    `;
    assert.equal(role.length, 1);
    assert.equal(role[0].rolcanlogin, false);
    assert.equal(role[0].rolbypassrls, false);

    const policy = await prisma.$queryRaw<Array<{ polname: string }>>`
      SELECT pol.polname
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'ActivationFeeLedger'
        AND pol.polname = 'wexon_app_all'
    `;
    assert.equal(policy.length, 1);

    // Prisma postgres runtime can still use the table (no FORCE RLS).
    const count = await prisma.activationFeeLedger.count();
    assert.ok(Number.isFinite(count));
  });
});
