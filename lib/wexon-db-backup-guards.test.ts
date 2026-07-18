import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRecoveryBackup,
  compareRowCountManifests,
  connectionUrlToLibpqEnv,
  evaluatePgDumpVersionGate,
  evaluateRestoreTargetGuard,
  parsePostgresMajorVersion,
  RECOVERY_STATUS,
  sanitizeBackupLog,
  sha256HexEqual,
} from "./wexon-db-backup-guards";

describe("parsePostgresMajorVersion", () => {
  it("parses pg_dump version strings", () => {
    assert.equal(parsePostgresMajorVersion("pg_dump (PostgreSQL) 17.10"), 17);
    assert.equal(parsePostgresMajorVersion("pg_dump (PostgreSQL) 16.4"), 16);
    assert.equal(parsePostgresMajorVersion("bogus"), null);
  });
});

describe("evaluatePgDumpVersionGate", () => {
  it("rejects PostgreSQL 16 client against PostgreSQL 17 source", () => {
    const gate = evaluatePgDumpVersionGate({ clientMajor: 16, serverMajor: 17 });
    assert.equal(gate.ok, false);
    assert.match(gate.reason || "", /older than server|below required/);
  });

  it("allows PostgreSQL 17 client against PostgreSQL 17 source", () => {
    const gate = evaluatePgDumpVersionGate({ clientMajor: 17, serverMajor: 17 });
    assert.equal(gate.ok, true);
  });

  it("allows PostgreSQL 18 client against PostgreSQL 17 source", () => {
    const gate = evaluatePgDumpVersionGate({ clientMajor: 18, serverMajor: 17 });
    assert.equal(gate.ok, true);
  });
});

describe("evaluateRestoreTargetGuard", () => {
  it("rejects remote supabase targets", () => {
    const r = evaluateRestoreTargetGuard({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "postgresql://u:p@db.abc.supabase.co:5432/wexon_test",
      NODE_ENV: "test",
    });
    assert.equal(r.ok, false);
  });

  it("rejects production VERCEL_ENV", () => {
    const r = evaluateRestoreTargetGuard({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/wexon_test",
      VERCEL_ENV: "production",
    });
    assert.equal(r.ok, false);
  });

  it("rejects preview VERCEL_ENV", () => {
    const r = evaluateRestoreTargetGuard({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/wexon_test",
      VERCEL_ENV: "preview",
    });
    assert.equal(r.ok, false);
  });

  it("rejects missing opt-in", () => {
    const r = evaluateRestoreTargetGuard({
      DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/wexon_test",
      NODE_ENV: "test",
    });
    assert.equal(r.ok, false);
  });

  it("allows loopback test database with opt-in", () => {
    const r = evaluateRestoreTargetGuard({
      WEXON_ALLOW_LOCAL_DB_TESTS: "1",
      DATABASE_URL: "postgresql://u:p@127.0.0.1:55432/wexon_restore_abc_test",
      NODE_ENV: "test",
    });
    assert.equal(r.ok, true);
  });
});

describe("classifyRecoveryBackup", () => {
  it("marks JSONL as not a recovery backup", () => {
    const c = classifyRecoveryBackup({
      method: "node-pg-logical",
      format: "jsonl",
      pgDumpMajor: null,
      restoreVerified: false,
    });
    assert.equal(c.ok, false);
    assert.equal(c.status, RECOVERY_STATUS.NOT_VERIFIED);
  });

  it("requires restore verification even for custom archives", () => {
    const c = classifyRecoveryBackup({
      method: "pg_dump",
      format: "custom",
      pgDumpMajor: 17,
      serverMajor: 17,
      restoreVerified: false,
    });
    assert.equal(c.ok, false);
    assert.equal(c.status, RECOVERY_STATUS.NOT_VERIFIED);
  });

  it("marks verified custom archive as RESTORE VERIFIED", () => {
    const c = classifyRecoveryBackup({
      method: "pg_dump",
      format: "custom",
      pgDumpMajor: 17,
      serverMajor: 17,
      restoreVerified: true,
    });
    assert.equal(c.ok, true);
    assert.equal(c.status, RECOVERY_STATUS.RESTORE_VERIFIED);
  });
});

describe("compareRowCountManifests / sha256", () => {
  it("fails on manifest mismatch", () => {
    const cmp = compareRowCountManifests({ User: 3, ApiKey: 0 }, { User: 2, ApiKey: 0 });
    assert.equal(cmp.ok, false);
    assert.equal(cmp.mismatched.length, 1);
  });

  it("passes identical manifests", () => {
    const cmp = compareRowCountManifests({ User: 3 }, { User: 3 });
    assert.equal(cmp.ok, true);
  });

  it("compares sha256 case-insensitively", () => {
    assert.equal(sha256HexEqual("AbC", "abc"), true);
    assert.equal(sha256HexEqual("a", "b"), false);
  });
});

describe("connectionUrlToLibpqEnv / sanitize", () => {
  it("maps URL fields to PG* env without exposing password in sanitize", () => {
    const parsed = connectionUrlToLibpqEnv(
      "postgresql://myuser:s3cret@127.0.0.1:5432/wexon_test",
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.env.PGUSER, "myuser");
      assert.equal(parsed.env.PGPASSWORD, "s3cret");
      assert.equal(parsed.env.PGDATABASE, "wexon_test");
    }
    const sanitized = sanitizeBackupLog("postgresql://myuser:s3cret@host/db PGPASSWORD=s3cret");
    assert.equal(sanitized.includes("s3cret"), false);
  });
});

describe("JSONL naming", () => {
  it("exposes NOT A DISASTER-RECOVERY BACKUP constant", () => {
    assert.equal(RECOVERY_STATUS.NOT_DISASTER_RECOVERY, "NOT A DISASTER-RECOVERY BACKUP");
  });
});
