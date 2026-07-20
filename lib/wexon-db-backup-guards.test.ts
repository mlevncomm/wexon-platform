import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCurrentSchemaPublicTableCount,
  classifyRecoveryBackup,
  compareRowCountManifests,
  connectionUrlToLibpqEnv,
  evaluateActivationFeeLedgerRls,
  evaluatePgDumpVersionGate,
  evaluateRestoreTableCountContract,
  evaluateRestoreTargetGuard,
  EXPECTED_PUBLIC_TABLE_COUNT,
  HISTORICAL_PUBLIC_TABLE_COUNT_PRE_ACTIVATION_LEDGER,
  HISTORICAL_PUBLIC_TABLE_COUNT_PRE_SMART_ACTIVATION,
  HISTORICAL_PUBLIC_TABLE_COUNT_PRE_STAFF_INVITE,
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

describe("current schema table count", () => {
  it("expects 38 public tables after Smart Activation wizard (StaffInvite)", () => {
    assert.equal(EXPECTED_PUBLIC_TABLE_COUNT, 38);
    assert.equal(HISTORICAL_PUBLIC_TABLE_COUNT_PRE_ACTIVATION_LEDGER, 33);
    assert.equal(HISTORICAL_PUBLIC_TABLE_COUNT_PRE_SMART_ACTIVATION, 34);
    assert.equal(HISTORICAL_PUBLIC_TABLE_COUNT_PRE_STAFF_INVITE, 37);
    assert.equal(assertCurrentSchemaPublicTableCount(38).ok, true);
    assert.equal(assertCurrentSchemaPublicTableCount(37).ok, false);
    assert.equal(assertCurrentSchemaPublicTableCount(34).ok, false);
    assert.equal(assertCurrentSchemaPublicTableCount(33).ok, false);
  });

  it("accepts a current 38-table manifest contract", () => {
    const rowCounts = Object.fromEntries(
      Array.from({ length: 38 }, (_, i) => [`T${i}`, i]),
    );
    const ok = evaluateRestoreTableCountContract({
      restoredTableCount: 38,
      manifest: { tableCount: 38, rowCounts },
    });
    assert.equal(ok.ok, true);
  });

  it("accepts a historical 37-table (pre-staff-invite) manifest", () => {
    const rowCounts = Object.fromEntries(
      Array.from({ length: 37 }, (_, i) => [`S${i}`, i]),
    );
    const ok = evaluateRestoreTableCountContract({
      restoredTableCount: 37,
      manifest: { tableCount: 37, rowCounts },
    });
    assert.equal(ok.ok, true);
  });

  it("accepts a historical 34-table (pre-smart-activation) manifest", () => {
    const rowCounts = Object.fromEntries(
      Array.from({ length: 34 }, (_, i) => [`P${i}`, i]),
    );
    const ok = evaluateRestoreTableCountContract({
      restoredTableCount: 34,
      manifest: { tableCount: 34, rowCounts },
    });
    assert.equal(ok.ok, true);
  });

  it("accepts a historical 33-table manifest + 33 restored tables", () => {
    const rowCounts = Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => [`H${i}`, i]),
    );
    const ok = evaluateRestoreTableCountContract({
      restoredTableCount: 33,
      manifest: { tableCount: 33, rowCounts },
    });
    assert.equal(ok.ok, true);
  });

  it("rejects manifest 33 vs restore 38", () => {
    const rowCounts = Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => [`H${i}`, i]),
    );
    const bad = evaluateRestoreTableCountContract({
      restoredTableCount: 38,
      manifest: { tableCount: 33, rowCounts },
    });
    assert.equal(bad.ok, false);
  });

  it("rejects when manifest tableCount differs from rowCounts keys", () => {
    const bad = evaluateRestoreTableCountContract({
      restoredTableCount: 33,
      manifest: { tableCount: 33, rowCounts: { A: 1, B: 2 } },
    });
    assert.equal(bad.ok, false);
  });

  it("rejects missing or corrupt manifests", () => {
    assert.equal(
      evaluateRestoreTableCountContract({ restoredTableCount: 37, manifest: null }).ok,
      false,
    );
    assert.equal(
      evaluateRestoreTableCountContract({
        restoredTableCount: 37,
        manifest: { tableCount: 37 },
      }).ok,
      false,
    );
  });

  it("rejects ActivationFeeLedger without RLS", () => {
    assert.equal(
      evaluateActivationFeeLedgerRls({ present: true, relrowsecurity: false }).ok,
      false,
    );
    assert.equal(
      evaluateActivationFeeLedgerRls({ present: true, relrowsecurity: true }).ok,
      true,
    );
    assert.equal(
      evaluateActivationFeeLedgerRls({ present: false, relrowsecurity: false }).ok,
      true,
    );
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
