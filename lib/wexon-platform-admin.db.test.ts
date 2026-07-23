/**
 * DB-backed PlatformAdmin foundation tests (PR2A).
 *
 * Gated by `assertLocalDbTestGuard`. Run with:
 *   WEXON_ALLOW_LOCAL_DB_TESTS=1 npm run test:unit:db
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { EXPECTED_PUBLIC_TABLE_COUNT } from "@/lib/wexon-db-backup-guards";
import {
  createPlatformAdminRecord,
  LastActivePlatformAdminError,
  PlatformAdminDuplicateEmailError,
  runPlatformAdminMutation,
  setPlatformAdminActiveRecord,
  updatePlatformAdminDisplayNameRecord,
} from "@/lib/wexon-platform-admin";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);
const actor = { email: `actor+${suffix}@wexon.test` };
const createdIds: string[] = [];

async function createAdmin(email: string, displayName: string) {
  return runPlatformAdminMutation(() =>
    prisma.$transaction(async (tx) => {
      const row = await createPlatformAdminRecord(tx, { email, displayName }, actor);
      createdIds.push(row.id);
      return row;
    }),
  );
}

async function setActive(id: string, isActive: boolean) {
  return runPlatformAdminMutation(() =>
    prisma.$transaction(async (tx) => setPlatformAdminActiveRecord(tx, { id, isActive }, actor)),
  );
}

describe("PlatformAdmin foundation (db)", () => {
  before(async () => {
    // Ensure clean slate for this suffix; leftover from prior failed runs.
    await prisma.platformAdmin.deleteMany({
      where: { emailNormalized: { contains: suffix } },
    });
  });

  after(async () => {
    if (createdIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "PlatformAdmin", entityId: { in: createdIds } },
      });
      await prisma.platformAdmin.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  it("creates, updates displayName, and deactivates/reactivates with masked audit", async () => {
    const created = await createAdmin(`Ops.One+${suffix}@Example.COM`, "Ops One");
    assert.equal(created.emailNormalized, `ops.one+${suffix}@example.com`);
    assert.equal(created.isActive, true);

    const peer = await createAdmin(`ops.peer+${suffix}@example.com`, "Peer");
    assert.equal(peer.isActive, true);

    const renamed = await runPlatformAdminMutation(() =>
      prisma.$transaction(async (tx) =>
        updatePlatformAdminDisplayNameRecord(tx, { id: created.id, displayName: "Ops One Renamed" }, actor),
      ),
    );
    assert.equal(renamed.displayName, "Ops One Renamed");

    const deactivated = await setActive(created.id, false);
    assert.equal(deactivated.isActive, false);

    const reactivated = await setActive(created.id, true);
    assert.equal(reactivated.isActive, true);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "PlatformAdmin", entityId: { in: [created.id, peer.id] } },
      orderBy: { createdAt: "asc" },
    });
    assert.ok(audits.length >= 3);
    for (const audit of audits) {
      const json = JSON.stringify(audit.metadataJson ?? {});
      assert.equal(json.includes(`ops.one+${suffix}@example.com`), false);
      assert.equal(json.toLowerCase().includes("cloudflaresubject"), false);
      assert.match(json, /emailMasked/);
      assert.match(json, /\*\*\*@/);
    }
  });

  it("rejects duplicate normalized emails", async () => {
    await createAdmin(`Dup+${suffix}@Example.com`, "Dup A");
    await assert.rejects(
      () => createAdmin(`  dup+${suffix}@example.com `, "Dup B"),
      PlatformAdminDuplicateEmailError,
    );
  });

  it("blocks deactivating the last active PlatformAdmin", async () => {
    const sole = await createAdmin(`sole+${suffix}@example.com`, "Sole");

    // Bypass domain guard to isolate: force every other PlatformAdmin inactive, then restore.
    const others = await prisma.platformAdmin.findMany({
      where: { isActive: true, id: { not: sole.id } },
      select: { id: true },
    });
    if (others.length > 0) {
      await prisma.platformAdmin.updateMany({
        where: { id: { in: others.map((row) => row.id) } },
        data: { isActive: false },
      });
    }

    try {
      await assert.rejects(() => setActive(sole.id, false), LastActivePlatformAdminError);
      const still = await prisma.platformAdmin.findUniqueOrThrow({ where: { id: sole.id } });
      assert.equal(still.isActive, true);
    } finally {
      if (others.length > 0) {
        await prisma.platformAdmin.updateMany({
          where: { id: { in: others.map((row) => row.id) } },
          data: { isActive: true },
        });
      }
    }
  });

  it("concurrent double-deactivate leaves at least one active", async () => {
    const a = await createAdmin(`race.a+${suffix}@example.com`, "Race A");
    const b = await createAdmin(`race.b+${suffix}@example.com`, "Race B");

    const others = await prisma.platformAdmin.findMany({
      where: { isActive: true, id: { notIn: [a.id, b.id] } },
      select: { id: true },
    });
    if (others.length > 0) {
      await prisma.platformAdmin.updateMany({
        where: { id: { in: others.map((row) => row.id) } },
        data: { isActive: false },
      });
    }

    try {
      const results = await Promise.allSettled([setActive(a.id, false), setActive(b.id, false)]);
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected");
      assert.equal(fulfilled, 1, "exactly one concurrent deactivation should succeed");
      assert.equal(rejected.length, 1, "exactly one concurrent deactivation should fail");
      assert.ok(
        rejected[0]!.status === "rejected" && rejected[0]!.reason instanceof LastActivePlatformAdminError,
      );

      const afterA = await prisma.platformAdmin.findUniqueOrThrow({ where: { id: a.id } });
      const afterB = await prisma.platformAdmin.findUniqueOrThrow({ where: { id: b.id } });
      assert.equal(afterA.isActive && afterB.isActive, false);
      assert.equal(afterA.isActive || afterB.isActive, true);
    } finally {
      await prisma.platformAdmin.updateMany({
        where: { id: { in: [a.id, b.id, ...others.map((row) => row.id)] } },
        data: { isActive: true },
      });
    }
  });

  it("enforces unique cloudflareSubject", async () => {
    const one = await createAdmin(`subj.one+${suffix}@example.com`, "Subj One");
    const two = await createAdmin(`subj.two+${suffix}@example.com`, "Subj Two");
    const subject = `cf-subject-${suffix}`;

    await prisma.platformAdmin.update({
      where: { id: one.id },
      data: { cloudflareSubject: subject },
    });

    await assert.rejects(
      () =>
        prisma.platformAdmin.update({
          where: { id: two.id },
          data: { cloudflareSubject: subject },
        }),
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "P2002",
    );
  });

  it("rolls back admin mutation when audit write fails (atomicity)", async () => {
    const row = await createAdmin(`atomic+${suffix}@example.com`, "Atomic");
    const before = await prisma.platformAdmin.findUniqueOrThrow({ where: { id: row.id } });

    await assert.rejects(() =>
      runPlatformAdminMutation(() =>
        prisma.$transaction(async (tx) => {
          await tx.platformAdmin.update({
            where: { id: row.id },
            data: { displayName: "Should Rollback" },
          });
          // Force failure after mutation — audit path must not commit alone.
          throw new Error("forced_audit_failure");
        }),
      ),
    );

    const after = await prisma.platformAdmin.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(after.displayName, before.displayName);
  });

  it("public schema has 41 tables; PlatformAdmin RLS/grants deny anon/authenticated", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string; rls: boolean; force: boolean }>>`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls, c.relforcerowsecurity AS force
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;
    assert.equal(tables.length, EXPECTED_PUBLIC_TABLE_COUNT);
    assert.equal(EXPECTED_PUBLIC_TABLE_COUNT, 41);

    const platform = tables.find((t) => t.table_name === "PlatformAdmin");
    assert.ok(platform);
    assert.equal(platform!.rls, true);
    assert.equal(platform!.force, false);

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
        has_table_privilege('anon', 'public."PlatformAdmin"', 'SELECT') AS anon_select,
        has_table_privilege('anon', 'public."PlatformAdmin"', 'INSERT') AS anon_insert,
        has_table_privilege('anon', 'public."PlatformAdmin"', 'UPDATE') AS anon_update,
        has_table_privilege('anon', 'public."PlatformAdmin"', 'DELETE') AS anon_delete,
        has_table_privilege('authenticated', 'public."PlatformAdmin"', 'SELECT') AS auth_select,
        has_table_privilege('authenticated', 'public."PlatformAdmin"', 'INSERT') AS auth_insert,
        has_table_privilege('authenticated', 'public."PlatformAdmin"', 'UPDATE') AS auth_update,
        has_table_privilege('authenticated', 'public."PlatformAdmin"', 'DELETE') AS auth_delete
    `;
    const p = priv[0]!;
    assert.equal(p.anon_select, false);
    assert.equal(p.anon_insert, false);
    assert.equal(p.anon_update, false);
    assert.equal(p.anon_delete, false);
    assert.equal(p.auth_select, false);
    assert.equal(p.auth_insert, false);
    assert.equal(p.auth_update, false);
    assert.equal(p.auth_delete, false);

    const policy = await prisma.$queryRaw<Array<{ polname: string }>>`
      SELECT pol.polname
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'PlatformAdmin'
        AND pol.polname = 'wexon_app_all'
    `;
    assert.equal(policy.length, 1);
  });
});
