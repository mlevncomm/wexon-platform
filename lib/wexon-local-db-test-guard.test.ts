import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLocalDbTestGuard } from "./wexon-local-db-test-guard";

const OPTIN = { WEXON_ALLOW_LOCAL_DB_TESTS: "1" };
const LOCAL_TEST = "postgresql://postgres:postgres@127.0.0.1:5432/wexon_test";

describe("evaluateLocalDbTestGuard", () => {
  it("denies Supabase direct host db.<ref>.supabase.co", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres" });
    assert.equal(result.ok, false);
  });

  it("denies Supabase pooler host", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" });
    assert.equal(result.ok, false);
  });

  it("denies an arbitrary remote Postgres host (e.g. Neon)", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@ep-cool-name.eu-central-1.aws.neon.tech/neondb_test" });
    assert.equal(result.ok, false);
  });

  it("denies a Railway remote host even with a test database name", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@containers-us-west-1.railway.app:5432/railway_test" });
    assert.equal(result.ok, false);
  });

  it("denies empty URL", () => {
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "" }).ok, false);
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN }).ok, false);
  });

  it("denies a malformed URL", () => {
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "::::not a url::::" }).ok, false);
  });

  it("denies localhost when the database name is not test/e2e (production/dev)", () => {
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@localhost:5432/wexon" }).ok, false);
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@localhost:5432/wexon_dev" }).ok, false);
  });

  it("denies a local test database without the opt-in flag", () => {
    assert.equal(evaluateLocalDbTestGuard({ DATABASE_URL: LOCAL_TEST }).ok, false);
    assert.equal(evaluateLocalDbTestGuard({ WEXON_ALLOW_LOCAL_DB_TESTS: "0", DATABASE_URL: LOCAL_TEST }).ok, false);
  });

  it("denies when NODE_ENV=production or VERCEL_ENV is a deployment env", () => {
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_TEST, NODE_ENV: "production" }).ok, false);
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_TEST, VERCEL_ENV: "production" }).ok, false);
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_TEST, VERCEL_ENV: "preview" }).ok, false);
  });

  it("does not let a remote DIRECT_URL fallback mask a missing DATABASE_URL", () => {
    // DATABASE_URL is what Prisma actually uses; a remote DIRECT_URL must not sneak through.
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "", DIRECT_URL: "postgresql://u:p@db.ref.supabase.co:5432/postgres" });
    assert.equal(result.ok, false);
  });

  it("allows localhost + test database + opt-in", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_TEST });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.host, "127.0.0.1");
  });

  it("allows 127.0.0.1 + e2e database + opt-in", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/wexon_e2e" });
    assert.equal(result.ok, true);
  });

  it("allows IPv6 loopback ::1 + test database + opt-in", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://postgres:postgres@[::1]:5432/wexon_test" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.host, "::1");
  });

  it("allows localhost host literal + test database + opt-in", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/app_test" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.host, "localhost");
  });
});
