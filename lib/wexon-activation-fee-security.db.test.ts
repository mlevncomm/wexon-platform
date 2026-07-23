import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { EXPECTED_PUBLIC_TABLE_COUNT } from "@/lib/wexon-db-backup-guards";

assertLocalDbTestGuard(process.env);

describe("ActivationFeeLedger RLS security (db)", () => {
  it("public schema has 41 tables and ActivationFeeLedger RLS is enabled", async () => {
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
    assert.equal(EXPECTED_PUBLIC_TABLE_COUNT, 41);

    for (const name of [
      "ActivationFeeLedger",
      "ActivationJourney",
      "ActivationJourneyStep",
      "TableQrToken",
      "StaffInvite",
      "MenuImportJob",
      "MenuImportRowError",
      "PlatformAdmin",
    ]) {
      const row = tables.find((t) => t.table_name === name);
      assert.ok(row, `${name} must exist`);
      assert.equal(row!.rls, true);
    }
  });

  it("denies anon/authenticated privileges and keeps wexon_app NOLOGIN/NOBYPASSRLS (read-only catalog)", async () => {
    // Roles are created before migrate in CI — never CREATE ROLE / REVOKE / GRANT here.
    const roles = await prisma.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'wexon_app')
      ORDER BY rolname
    `;
    const roleNames = new Set(roles.map((r) => r.rolname));
    assert.ok(roleNames.has("anon"), "anon role must exist (create before migrate in CI)");
    assert.ok(roleNames.has("authenticated"), "authenticated role must exist (create before migrate in CI)");
    assert.ok(roleNames.has("wexon_app"), "wexon_app role must exist");

    for (const table of ["ActivationFeeLedger", "StaffInvite", "PlatformAdmin"]) {
      const priv = await prisma.$queryRawUnsafe<
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
      >(
        `SELECT
          has_table_privilege('anon', 'public."${table}"', 'SELECT') AS anon_select,
          has_table_privilege('anon', 'public."${table}"', 'INSERT') AS anon_insert,
          has_table_privilege('anon', 'public."${table}"', 'UPDATE') AS anon_update,
          has_table_privilege('anon', 'public."${table}"', 'DELETE') AS anon_delete,
          has_table_privilege('authenticated', 'public."${table}"', 'SELECT') AS auth_select,
          has_table_privilege('authenticated', 'public."${table}"', 'INSERT') AS auth_insert,
          has_table_privilege('authenticated', 'public."${table}"', 'UPDATE') AS auth_update,
          has_table_privilege('authenticated', 'public."${table}"', 'DELETE') AS auth_delete`,
      );
      const p = priv[0]!;
      assert.equal(p.anon_select, false, `${table} anon SELECT`);
      assert.equal(p.anon_insert, false, `${table} anon INSERT`);
      assert.equal(p.anon_update, false, `${table} anon UPDATE`);
      assert.equal(p.anon_delete, false, `${table} anon DELETE`);
      assert.equal(p.auth_select, false, `${table} auth SELECT`);
      assert.equal(p.auth_insert, false, `${table} auth INSERT`);
      assert.equal(p.auth_update, false, `${table} auth UPDATE`);
      assert.equal(p.auth_delete, false, `${table} auth DELETE`);
    }

    const role = await prisma.$queryRaw<
      Array<{ rolcanlogin: boolean; rolbypassrls: boolean }>
    >`
      SELECT rolcanlogin, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'wexon_app'
    `;
    assert.equal(role.length, 1);
    assert.equal(role[0]!.rolcanlogin, false);
    assert.equal(role[0]!.rolbypassrls, false);

    for (const table of ["ActivationFeeLedger", "PlatformAdmin"]) {
      const policy = await prisma.$queryRawUnsafe<Array<{ polname: string }>>(
        `SELECT pol.polname
         FROM pg_policy pol
         JOIN pg_class c ON c.oid = pol.polrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = '${table}'
           AND pol.polname = 'wexon_app_all'`,
      );
      assert.equal(policy.length, 1, `${table} wexon_app_all policy`);
    }

    const count = await prisma.activationFeeLedger.count();
    assert.ok(Number.isFinite(count));
    const platformAdminCount = await prisma.platformAdmin.count();
    assert.ok(Number.isFinite(platformAdminCount));
  });
});
