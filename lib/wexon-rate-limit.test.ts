import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enforceRateLimit, RATE_LIMITS } from "./wexon-rate-limit";

describe("login rate limits", () => {
  it("blocks admin login IP after limit", () => {
    const previous = process.env.WEXON_E2E_RELAX_RATE_LIMIT;
    delete process.env.WEXON_E2E_RELAX_RATE_LIMIT;
    try {
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
    } finally {
      if (previous === undefined) delete process.env.WEXON_E2E_RELAX_RATE_LIMIT;
      else process.env.WEXON_E2E_RELAX_RATE_LIMIT = previous;
    }
  });

  it("relaxes limits when WEXON_E2E_RELAX_RATE_LIMIT is enabled", () => {
    const previous = process.env.WEXON_E2E_RELAX_RATE_LIMIT;
    process.env.WEXON_E2E_RELAX_RATE_LIMIT = "true";
    try {
      const scope = `test.admin.login.relaxed.${Date.now()}`;
      const config = { limit: 1, windowMs: 60_000 };
      assert.equal(enforceRateLimit(scope, "203.0.113.10", config).ok, true);
      assert.equal(enforceRateLimit(scope, "203.0.113.10", config).ok, true);
    } finally {
      if (previous === undefined) delete process.env.WEXON_E2E_RELAX_RATE_LIMIT;
      else process.env.WEXON_E2E_RELAX_RATE_LIMIT = previous;
    }
  });

  it("uses configured admin email limit", () => {
    assert.equal(RATE_LIMITS.adminLoginEmail.limit, 5);
    assert.equal(RATE_LIMITS.customerLoginEmail.limit, 8);
  });
});
