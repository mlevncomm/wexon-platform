import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLocalDbTestGuard } from "./wexon-local-db-test-guard";

const OPTIN = { WEXON_ALLOW_LOCAL_DB_TESTS: "1" };
const LOCAL_TEST = "postgresql://postgres:postgres@127.0.0.1:5432/wexon_test";
const LOCAL_E2E = "postgresql://postgres:postgres@127.0.0.1:5432/wexon_e2e";
const REMOTE_SUPA =
  "postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres";
const REMOTE_POOLER =
  "postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

describe("evaluateLocalDbTestGuard", () => {
  it("denies Supabase direct host db.<ref>.supabase.co", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: REMOTE_SUPA });
    assert.equal(result.ok, false);
  });

  it("denies Supabase pooler host", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: REMOTE_POOLER });
    assert.equal(result.ok, false);
  });

  it("denies remote host even with opt-in", () => {
    const result = evaluateLocalDbTestGuard({
      ...OPTIN,
      DATABASE_URL: "postgresql://u:p@ep-cool-name.eu-central-1.aws.neon.tech/neondb_test",
    });
    assert.equal(result.ok, false);
  });

  it("denies Railway / Render / RDS-style remotes even with _test db name", () => {
    assert.equal(
      evaluateLocalDbTestGuard({
        ...OPTIN,
        DATABASE_URL: "postgresql://u:p@containers-us-west-1.railway.app:5432/railway_test",
      }).ok,
      false,
    );
    assert.equal(
      evaluateLocalDbTestGuard({
        ...OPTIN,
        DATABASE_URL: "postgresql://u:p@dpg-xyz.render.com:5432/app_test",
      }).ok,
      false,
    );
    assert.equal(
      evaluateLocalDbTestGuard({
        ...OPTIN,
        DATABASE_URL: "postgresql://u:p@mydb.abc123.us-east-1.rds.amazonaws.com:5432/wexon_test",
      }).ok,
      false,
    );
  });

  it("denies DATABASE_URL remote even when DIRECT_URL is local", () => {
    const result = evaluateLocalDbTestGuard({
      ...OPTIN,
      DATABASE_URL: REMOTE_SUPA,
      DIRECT_URL: LOCAL_TEST,
    });
    assert.equal(result.ok, false);
  });

  it("denies DATABASE_URL local when DIRECT_URL is remote", () => {
    const result = evaluateLocalDbTestGuard({
      ...OPTIN,
      DATABASE_URL: LOCAL_TEST,
      DIRECT_URL: REMOTE_POOLER,
    });
    assert.equal(result.ok, false);
  });

  it("denies empty or malformed URL", () => {
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "" }).ok, false);
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN }).ok, false);
    assert.equal(evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "::::not a url::::" }).ok, false);
  });

  it("denies local development databases without _test/_e2e", () => {
    assert.equal(
      evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@localhost:5432/wexon" }).ok,
      false,
    );
    assert.equal(
      evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@localhost:5432/wexon_dev" }).ok,
      false,
    );
    // Contains "test" but not "_test" / "_e2e"
    assert.equal(
      evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: "postgresql://u:p@localhost:5432/testing" }).ok,
      false,
    );
  });

  it("denies a local test database without the opt-in flag", () => {
    assert.equal(evaluateLocalDbTestGuard({ DATABASE_URL: LOCAL_TEST }).ok, false);
    assert.equal(
      evaluateLocalDbTestGuard({ WEXON_ALLOW_LOCAL_DB_TESTS: "0", DATABASE_URL: LOCAL_TEST }).ok,
      false,
    );
  });

  it("denies when NODE_ENV=production or VERCEL_ENV is a deployment env", () => {
    assert.equal(
      evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_TEST, NODE_ENV: "production" }).ok,
      false,
    );
    assert.equal(
      evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_TEST, VERCEL_ENV: "production" }).ok,
      false,
    );
    assert.equal(
      evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_TEST, VERCEL_ENV: "preview" }).ok,
      false,
    );
  });

  it("does not let a remote DIRECT_URL fallback mask a missing DATABASE_URL", () => {
    const result = evaluateLocalDbTestGuard({
      ...OPTIN,
      DATABASE_URL: "",
      DIRECT_URL: REMOTE_SUPA,
    });
    assert.equal(result.ok, false);
  });

  it("allows localhost + _test database + opt-in", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_TEST });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.host, "127.0.0.1");
  });

  it("allows 127.0.0.1 + _e2e database + opt-in", () => {
    const result = evaluateLocalDbTestGuard({ ...OPTIN, DATABASE_URL: LOCAL_E2E });
    assert.equal(result.ok, true);
  });

  it("allows IPv6 loopback ::1 + _test database + opt-in", () => {
    const result = evaluateLocalDbTestGuard({
      ...OPTIN,
      DATABASE_URL: "postgresql://postgres:postgres@[::1]:5432/wexon_test",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.host, "::1");
  });

  it("allows localhost host literal + _test database + opt-in", () => {
    const result = evaluateLocalDbTestGuard({
      ...OPTIN,
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/app_test",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.host, "localhost");
  });

  it("allows matching local DATABASE_URL and DIRECT_URL", () => {
    const result = evaluateLocalDbTestGuard({
      ...OPTIN,
      DATABASE_URL: LOCAL_TEST,
      DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/wexon_test",
    });
    assert.equal(result.ok, true);
  });
});
