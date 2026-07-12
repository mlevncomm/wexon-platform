import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enforceRateLimit, RATE_LIMITS } from "./wexon-rate-limit";

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const env = process.env as Record<string, string | undefined>;
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = env[key];
    const next = overrides[key];
    if (next === undefined) delete env[key];
    else env[key] = next;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

describe("login rate limits", () => {
  it("blocks admin login IP after limit", () => {
    withEnv({ WEXON_E2E_RELAX_RATE_LIMIT: undefined }, () => {
      const scope = `test.admin.login.ip.${Date.now()}`;
      const config = { limit: 3, windowMs: 60_000 };
      for (let i = 0; i < 3; i += 1) {
        const result = enforceRateLimit(scope, "203.0.113.10", config);
        assert.equal(result.ok, true);
      }
      const blocked = enforceRateLimit(scope, "203.0.113.10", config);
      assert.equal(blocked.ok, false);
      if (!blocked.ok) {
        assert.ok(blocked.retryAfterSeconds >= 1);
      }
    });
  });

  it("relaxes limits when WEXON_E2E_RELAX_RATE_LIMIT is enabled outside production", () => {
    withEnv(
      {
        WEXON_E2E_RELAX_RATE_LIMIT: "true",
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        WEXON_E2E_TARGET: "local",
      },
      () => {
        const scope = `test.admin.login.relaxed.${Date.now()}`;
        const config = { limit: 1, windowMs: 60_000 };
        assert.equal(enforceRateLimit(scope, "203.0.113.10", config).ok, true);
        assert.equal(enforceRateLimit(scope, "203.0.113.10", config).ok, true);
      },
    );
  });

  it("ignores WEXON_E2E_RELAX_RATE_LIMIT on hosted production", () => {
    withEnv(
      {
        WEXON_E2E_RELAX_RATE_LIMIT: "true",
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        WEXON_E2E_TARGET: "local",
      },
      () => {
        const scope = `test.admin.login.prod-no-relax.${Date.now()}`;
        const config = { limit: 1, windowMs: 60_000 };
        assert.equal(enforceRateLimit(scope, "203.0.113.99", config).ok, true);
        assert.equal(enforceRateLimit(scope, "203.0.113.99", config).ok, false);
      },
    );
  });

  it("relaxes limits for local Playwright next start with NODE_ENV=production", () => {
    withEnv(
      {
        WEXON_E2E_RELAX_RATE_LIMIT: "true",
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        WEXON_E2E_TARGET: "local",
      },
      () => {
        const scope = `test.admin.login.local-start-relax.${Date.now()}`;
        const config = { limit: 1, windowMs: 60_000 };
        assert.equal(enforceRateLimit(scope, "203.0.113.55", config).ok, true);
        assert.equal(enforceRateLimit(scope, "203.0.113.55", config).ok, true);
      },
    );
  });

  it("uses configured admin email limit", () => {
    assert.equal(RATE_LIMITS.adminLoginEmail.limit, 5);
    assert.equal(RATE_LIMITS.customerLoginEmail.limit, 8);
  });
});
