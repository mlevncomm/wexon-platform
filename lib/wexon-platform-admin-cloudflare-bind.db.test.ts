/**
 * DB-backed PlatformAdmin Cloudflare subject bind (PR2B).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  createPlatformAdminRecord,
  maskPlatformAdminEmail,
  runPlatformAdminMutation,
  setPlatformAdminActiveRecord,
  LastActivePlatformAdminError,
} from "@/lib/wexon-platform-admin";
import {
  PlatformAdminCloudflareAccessError,
  resolvePlatformAdminForCloudflareAccess,
} from "@/lib/wexon-platform-admin-cloudflare-bind";

assertLocalDbTestGuard(process.env);

const actor = { email: "bind-actor@example.test" };
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

describe("PlatformAdmin Cloudflare subject bind (db)", () => {
  before(async () => {
    // no-op — creates happen per test
  });

  after(async () => {
    if (createdIds.length) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "PlatformAdmin", entityId: { in: createdIds } },
      });
      await prisma.platformAdmin.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  it("binds cloudflareSubject on first login and audits masked email only", async () => {
    const email = `bind.first.${Date.now()}@example.test`;
    const created = await createAdmin(email, "Bind First");
    assert.equal(created.cloudflareSubject, null);

    const bound = await runPlatformAdminMutation(() =>
      prisma.$transaction((tx) =>
        resolvePlatformAdminForCloudflareAccess(tx, {
          emailNormalized: email.toLowerCase(),
          cloudflareSubject: "cf-subject-first",
        }),
      ),
    );
    assert.equal(bound.cloudflareSubject, "cf-subject-first");
    assert.ok(bound.lastLoginAt);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "PlatformAdmin",
        entityId: created.id,
        action: "admin.platform_admin.cloudflare_subject_bound",
      },
    });
    assert.equal(audits.length, 1);
    const meta = audits[0]!.metadataJson as Record<string, unknown>;
    const serialized = JSON.stringify(meta);
    assert.equal(meta.emailMasked, maskPlatformAdminEmail(email));
    assert.doesNotMatch(serialized, new RegExp(email.replace(".", "\\."), "i"));
    assert.doesNotMatch(serialized, /cf-subject-first/);
    assert.doesNotMatch(serialized, /cloudflareSubject":"/);
  });

  it("is idempotent when subject already bound", async () => {
    const email = `bind.idem.${Date.now()}@example.test`;
    await createAdmin(email, "Bind Idem");
    await runPlatformAdminMutation(() =>
      prisma.$transaction((tx) =>
        resolvePlatformAdminForCloudflareAccess(tx, {
          emailNormalized: email.toLowerCase(),
          cloudflareSubject: "cf-subject-idem",
        }),
      ),
    );
    const again = await runPlatformAdminMutation(() =>
      prisma.$transaction((tx) =>
        resolvePlatformAdminForCloudflareAccess(tx, {
          emailNormalized: email.toLowerCase(),
          cloudflareSubject: "cf-subject-idem",
        }),
      ),
    );
    assert.equal(again.cloudflareSubject, "cf-subject-idem");
    const audits = await prisma.auditLog.count({
      where: {
        entityId: again.id,
        action: "admin.platform_admin.cloudflare_subject_bound",
      },
    });
    assert.equal(audits, 1);
  });

  it("handles concurrent first bind safely", async () => {
    const email = `bind.concurrent.${Date.now()}@example.test`;
    await createAdmin(email, "Bind Concurrent");
    const subject = "cf-subject-concurrent";

    const results = await Promise.allSettled([
      runPlatformAdminMutation(() =>
        prisma.$transaction((tx) =>
          resolvePlatformAdminForCloudflareAccess(tx, {
            emailNormalized: email.toLowerCase(),
            cloudflareSubject: subject,
          }),
        ),
      ),
      runPlatformAdminMutation(() =>
        prisma.$transaction((tx) =>
          resolvePlatformAdminForCloudflareAccess(tx, {
            emailNormalized: email.toLowerCase(),
            cloudflareSubject: subject,
          }),
        ),
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    assert.ok(fulfilled.length >= 1);
    for (const r of fulfilled) {
      if (r.status === "fulfilled") assert.equal(r.value.cloudflareSubject, subject);
    }
    const row = await prisma.platformAdmin.findUnique({
      where: { emailNormalized: email.toLowerCase() },
    });
    assert.equal(row?.cloudflareSubject, subject);
  });

  it("rejects subject mismatch", async () => {
    const email = `bind.mismatch.${Date.now()}@example.test`;
    await createAdmin(email, "Bind Mismatch");
    await runPlatformAdminMutation(() =>
      prisma.$transaction((tx) =>
        resolvePlatformAdminForCloudflareAccess(tx, {
          emailNormalized: email.toLowerCase(),
          cloudflareSubject: "cf-subject-a",
        }),
      ),
    );
    await assert.rejects(
      () =>
        runPlatformAdminMutation(() =>
          prisma.$transaction((tx) =>
            resolvePlatformAdminForCloudflareAccess(tx, {
              emailNormalized: email.toLowerCase(),
              cloudflareSubject: "cf-subject-b",
            }),
          ),
        ),
      PlatformAdminCloudflareAccessError,
    );
  });

  it("rejects inactive or missing PlatformAdmin", async () => {
    const email = `bind.inactive.${Date.now()}@example.test`;
    // Keep another active admin so deactivation of target is allowed.
    await createAdmin(`bind.inactive.peer.${Date.now()}@example.test`, "Peer");
    const target = await createAdmin(email, "Inactive Target");
    await runPlatformAdminMutation(() =>
      prisma.$transaction((tx) => setPlatformAdminActiveRecord(tx, { id: target.id, isActive: false }, actor)),
    );

    await assert.rejects(
      () =>
        runPlatformAdminMutation(() =>
          prisma.$transaction((tx) =>
            resolvePlatformAdminForCloudflareAccess(tx, {
              emailNormalized: email.toLowerCase(),
              cloudflareSubject: "cf-subject-inactive",
            }),
          ),
        ),
      PlatformAdminCloudflareAccessError,
    );

    await assert.rejects(
      () =>
        runPlatformAdminMutation(() =>
          prisma.$transaction((tx) =>
            resolvePlatformAdminForCloudflareAccess(tx, {
              emailNormalized: "missing-admin@example.test",
              cloudflareSubject: "cf-subject-missing",
            }),
          ),
        ),
      PlatformAdminCloudflareAccessError,
    );

    // last-active regression: deactivating the sole remaining active admin is blocked.
    const soleEmail = `bind.sole.${Date.now()}@example.test`;
    const sole = await createAdmin(soleEmail, "Sole Active");
    // Force every other PlatformAdmin inactive temporarily, then restore.
    const others = await prisma.platformAdmin.findMany({
      where: { isActive: true, id: { not: sole.id } },
      select: { id: true },
    });
    if (others.length) {
      await prisma.platformAdmin.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { isActive: false },
      });
    }
    try {
      await assert.rejects(
        () =>
          runPlatformAdminMutation(() =>
            prisma.$transaction((tx) => setPlatformAdminActiveRecord(tx, { id: sole.id, isActive: false }, actor)),
          ),
        LastActivePlatformAdminError,
      );
    } finally {
      if (others.length) {
        await prisma.platformAdmin.updateMany({
          where: { id: { in: others.map((o) => o.id) } },
          data: { isActive: true },
        });
      }
    }
  });
});
