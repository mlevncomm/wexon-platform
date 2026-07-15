import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyE2EDatabase,
  createEligibilityLeadMarker,
  createWexPayRunMarker,
  describeDatabaseSafely,
  E2E_ELIGIBILITY_SOURCE_BASE,
  E2E_LEAD_PREFIX,
  isE2eTestDatabaseName,
  isLocalDatabaseHost,
  isRemoteSharedDatabaseHost,
  leadMutationBlockedReason,
  wexPayMutationBlockedReason,
} from "../e2e/lead-isolation";

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    previous[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(patch)) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("e2e lead isolation markers", () => {
  it("builds unique source/email/company with E2E prefix", () => {
    const marker = createEligibilityLeadMarker("abc123");
    assert.equal(marker.source, `${E2E_ELIGIBILITY_SOURCE_BASE}.abc123`);
    assert.equal(marker.email, "e2e.elig.abc123@example.com");
    assert.ok(marker.company.startsWith(E2E_LEAD_PREFIX));
    assert.match(marker.message, /E2E\[WXP\]/);
  });

  it("builds WexPay run marker token", () => {
    const marker = createWexPayRunMarker("run9");
    assert.equal(marker.token, `${E2E_LEAD_PREFIX}.run9`);
    assert.match(marker.note, /E2E\[WXP\]\.run9/);
  });

  it("blocks shared remote mutation without allow flag", () => {
    withEnv(
      {
        WEXON_E2E_ALLOW_SHARED_LEAD_MUTATION: undefined,
        WEXON_E2E_SKIP_LEAD_MUTATION: undefined,
        WEXON_E2E_TARGET: "local",
        WEXON_E2E_CONFIRM_PRODUCTION: undefined,
        WEXON_E2E_CONFIRM_ISOLATED: undefined,
        DATABASE_URL: "postgresql://u:p@db.xyz.supabase.com:5432/postgres",
        DIRECT_URL: "postgresql://u:p@db.xyz.supabase.com:5432/postgres",
        E2E_BASE_URL: "http://localhost:3100",
        VERCEL_ENV: undefined,
      },
      () => {
        const reason = leadMutationBlockedReason();
        assert.ok(reason);
        assert.match(reason!, /shared remote-unverified/);
      },
    );
  });
});

describe("isolated WexPay E2E classification", () => {
  it("describes database without leaking credentials", () => {
    const desc = describeDatabaseSafely("postgresql://secret:hunter2@127.0.0.1:5433/wexon_e2e");
    assert.deepEqual(desc, { host: "127.0.0.1", port: "5433", database: "wexon_e2e" });
    assert.ok(!JSON.stringify(desc).includes("hunter2"));
  });

  it("recognizes local vs remote hosts and e2e db names", () => {
    assert.equal(isLocalDatabaseHost("postgresql://u:p@127.0.0.1:5433/wexon_e2e"), true);
    assert.equal(isRemoteSharedDatabaseHost("postgresql://u:p@db.x.supabase.com:6543/postgres"), true);
    assert.equal(isE2eTestDatabaseName("postgresql://u:p@127.0.0.1:5433/wexon_e2e"), true);
    assert.equal(isE2eTestDatabaseName("postgresql://u:p@127.0.0.1:5433/postgres"), false);
  });

  it("classifies confirmed isolated localhost e2e DB", () => {
    withEnv(
      {
        WEXON_E2E_TARGET: "isolated",
        WEXON_E2E_CONFIRM_ISOLATED: "true",
        WEXON_E2E_CONFIRM_PRODUCTION: undefined,
        DATABASE_URL: "postgresql://wexon_e2e:wexon_e2e_dev_only@127.0.0.1:5433/wexon_e2e",
        DIRECT_URL: "postgresql://wexon_e2e:wexon_e2e_dev_only@127.0.0.1:5433/wexon_e2e",
        E2E_BASE_URL: "http://localhost:3100",
        VERCEL_ENV: undefined,
      },
      () => {
        assert.equal(classifyE2EDatabase(), "isolated");
        assert.equal(wexPayMutationBlockedReason(), null);
      },
    );
  });

  it("refuses TARGET=isolated on supabase even with confirm flag", () => {
    withEnv(
      {
        WEXON_E2E_TARGET: "isolated",
        WEXON_E2E_CONFIRM_ISOLATED: "true",
        DATABASE_URL: "postgresql://u:p@db.xyz.supabase.com:5432/postgres",
        DIRECT_URL: "postgresql://u:p@db.xyz.supabase.com:5432/postgres",
        E2E_BASE_URL: "http://localhost:3100",
        VERCEL_ENV: undefined,
      },
      () => {
        assert.equal(classifyE2EDatabase(), "shared remote-unverified");
        assert.match(wexPayMutationBlockedReason()!, /shared remote/);
      },
    );
  });

  it("refuses isolated mutation without confirm flag", () => {
    withEnv(
      {
        WEXON_E2E_TARGET: "isolated",
        WEXON_E2E_CONFIRM_ISOLATED: undefined,
        DATABASE_URL: "postgresql://wexon_e2e:x@127.0.0.1:5433/wexon_e2e",
        DIRECT_URL: "postgresql://wexon_e2e:x@127.0.0.1:5433/wexon_e2e",
        E2E_BASE_URL: "http://localhost:3100",
        VERCEL_ENV: undefined,
      },
      () => {
        assert.equal(classifyE2EDatabase(), "local");
        assert.match(wexPayMutationBlockedReason()!, /isolated/);
      },
    );
  });

  it("hard-blocks production-confirmed mutations with no allow bypass", () => {
    withEnv(
      {
        WEXON_E2E_TARGET: "production",
        WEXON_E2E_CONFIRM_PRODUCTION: "true",
        WEXON_E2E_CONFIRM_ISOLATED: "true",
        WEXON_E2E_ALLOW_GUEST_MUTATION: "true",
        DATABASE_URL: "postgresql://u:p@127.0.0.1:5433/wexon_e2e",
        DIRECT_URL: "postgresql://u:p@127.0.0.1:5433/wexon_e2e",
        E2E_BASE_URL: "https://www.wexon.dev",
        VERCEL_ENV: undefined,
      },
      () => {
        assert.equal(classifyE2EDatabase(), "production-confirmed");
        assert.match(wexPayMutationBlockedReason()!, /production-confirmed/);
      },
    );
  });
});
