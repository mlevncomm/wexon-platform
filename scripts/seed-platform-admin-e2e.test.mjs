/**
 * Fail-closed coverage for scripts/seed-platform-admin-e2e.mjs.
 * Proves remote / production / preview targets exit before Prisma queries.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts/seed-platform-admin-e2e.mjs");

const REMOTE_SUPA = "postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres";
const LOCAL_E2E = "postgresql://postgres:postgres@127.0.0.1:5432/wexon_e2e";

function runSeed(envOverrides) {
  return spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      // Neutralize caller DB / deploy env; each case sets what it needs.
      DATABASE_URL: "",
      DIRECT_URL: "",
      WEXON_ALLOW_LOCAL_DB_TESTS: "",
      NODE_ENV: "test",
      VERCEL_ENV: "",
      E2E_ADMIN_EMAIL: "seed-guard@example.test",
      ADMIN_EMAILS: "seed-guard@example.test",
      ...envOverrides,
    },
  });
}

function combined(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function assertNoPlatformAdminMutation(output) {
  assert.doesNotMatch(output, /\[seed-platform-admin-e2e\] (created|reactivated|exists)/);
  assert.doesNotMatch(output, /platformAdmin\.(create|update|findUnique)/i);
}

function assertPrismaNeverStarted(output) {
  // Guard rejection must happen before Prisma client import / query logs.
  assert.match(output, /\[db-test-guard\]/);
  assert.doesNotMatch(output, /\[seed-platform-admin-e2e\] guard OK/);
  assert.doesNotMatch(output, /PrismaClient/i);
  assertNoPlatformAdminMutation(output);
}

describe("seed-platform-admin-e2e fail-closed", () => {
  it("rejects Supabase remote URL before any Prisma query (nonzero exit)", () => {
    const result = runSeed({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: REMOTE_SUPA,
      DIRECT_URL: REMOTE_SUPA,
    });
    assert.notEqual(result.status, 0);
    assertPrismaNeverStarted(combined(result));
  });

  it("rejects Neon remote URL before any Prisma query", () => {
    const result = runSeed({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "postgresql://u:p@ep-cool-name.eu-central-1.aws.neon.tech/neondb_test",
      DIRECT_URL: "postgresql://u:p@ep-cool-name.eu-central-1.aws.neon.tech/neondb_test",
    });
    assert.notEqual(result.status, 0);
    assertPrismaNeverStarted(combined(result));
  });

  it("rejects Railway remote URL before any Prisma query", () => {
    const result = runSeed({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "postgresql://u:p@containers-us-west-1.railway.app:5432/railway_test",
      DIRECT_URL: "postgresql://u:p@containers-us-west-1.railway.app:5432/railway_test",
    });
    assert.notEqual(result.status, 0);
    assertPrismaNeverStarted(combined(result));
  });

  it("rejects empty / malformed DATABASE_URL before any Prisma query", () => {
    const empty = runSeed({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "",
      DIRECT_URL: LOCAL_E2E,
    });
    assert.notEqual(empty.status, 0);
    assertPrismaNeverStarted(combined(empty));

    const malformed = runSeed({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "::::not a url::::",
      DIRECT_URL: "::::not a url::::",
    });
    assert.notEqual(malformed.status, 0);
    assertPrismaNeverStarted(combined(malformed));
  });

  it("rejects DATABASE_URL/DIRECT_URL mismatch (remote vs local) before Prisma", () => {
    const result = runSeed({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: LOCAL_E2E,
      DIRECT_URL: REMOTE_SUPA,
    });
    assert.notEqual(result.status, 0);
    assertPrismaNeverStarted(combined(result));
  });

  it("rejects NODE_ENV=production and VERCEL_ENV production/preview before Prisma", () => {
    for (const envOverrides of [
      { WEXON_ALLOW_LOCAL_DB_TESTS: "1", DATABASE_URL: LOCAL_E2E, DIRECT_URL: LOCAL_E2E, NODE_ENV: "production" },
      {
        WEXON_ALLOW_LOCAL_DB_TESTS: "1",
        DATABASE_URL: LOCAL_E2E,
        DIRECT_URL: LOCAL_E2E,
        NODE_ENV: "test",
        VERCEL_ENV: "production",
      },
      {
        WEXON_ALLOW_LOCAL_DB_TESTS: "1",
        DATABASE_URL: LOCAL_E2E,
        DIRECT_URL: LOCAL_E2E,
        NODE_ENV: "test",
        VERCEL_ENV: "preview",
      },
    ]) {
      const result = runSeed(envOverrides);
      assert.notEqual(result.status, 0, `expected RED for ${JSON.stringify(envOverrides)}`);
      assertPrismaNeverStarted(combined(result));
    }
  });

  it("rejects missing local-test opt-in before Prisma", () => {
    const result = runSeed({
      WEXON_ALLOW_LOCAL_DB_TESTS: "0",
      DATABASE_URL: LOCAL_E2E,
      DIRECT_URL: LOCAL_E2E,
    });
    assert.notEqual(result.status, 0);
    assertPrismaNeverStarted(combined(result));
  });
});
