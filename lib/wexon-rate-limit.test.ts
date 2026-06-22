import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enforceRateLimit, RATE_LIMITS } from "./wexon-rate-limit";

describe("login rate limits", () => {
  it("blocks admin login IP after limit", () => {
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

  it("uses configured admin email limit", () => {
    assert.equal(RATE_LIMITS.adminLoginEmail.limit, 5);
    assert.equal(RATE_LIMITS.customerLoginEmail.limit, 8);
  });
});
