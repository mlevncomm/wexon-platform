import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCustomerDevLoginAllowed,
  isE2eRateLimitRelaxAllowed,
  isRuntimeProduction,
  listForbiddenProductionEnvsSet,
} from "./wexon-production-guards";

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

describe("production guards", () => {
  it("detects production via NODE_ENV or VERCEL_ENV", () => {
    withEnv({ NODE_ENV: "production", VERCEL_ENV: undefined }, () => {
      assert.equal(isRuntimeProduction(), true);
    });
    withEnv({ NODE_ENV: "development", VERCEL_ENV: "production" }, () => {
      assert.equal(isRuntimeProduction(), true);
    });
    withEnv({ NODE_ENV: "development", VERCEL_ENV: "preview" }, () => {
      assert.equal(isRuntimeProduction(), false);
    });
  });

  it("blocks customer dev login in production even if password env is set", () => {
    withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        CUSTOMER_DEV_LOGIN_PASSWORD: "secret-dev-password",
        WEXON_E2E_TARGET: "local",
      },
      () => {
        assert.equal(isCustomerDevLoginAllowed(), false);
      },
    );
  });

  it("allows customer dev login only outside production with password set", () => {
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        CUSTOMER_DEV_LOGIN_PASSWORD: "secret-dev-password",
      },
      () => {
        assert.equal(isCustomerDevLoginAllowed(), true);
      },
    );
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        CUSTOMER_DEV_LOGIN_PASSWORD: undefined,
      },
      () => {
        assert.equal(isCustomerDevLoginAllowed(), false);
      },
    );
  });

  it("never relaxes rate limits on Vercel production or production E2E target", () => {
    withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        WEXON_E2E_RELAX_RATE_LIMIT: "true",
        WEXON_E2E_TARGET: "local",
      },
      () => {
        assert.equal(isE2eRateLimitRelaxAllowed(), false);
      },
    );
    withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        WEXON_E2E_RELAX_RATE_LIMIT: "true",
        WEXON_E2E_TARGET: "production",
      },
      () => {
        assert.equal(isE2eRateLimitRelaxAllowed(), false);
      },
    );
  });

  it("relaxes rate limits for local Playwright next start (NODE_ENV=production)", () => {
    withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        WEXON_E2E_RELAX_RATE_LIMIT: "true",
        WEXON_E2E_TARGET: "local",
      },
      () => {
        assert.equal(isE2eRateLimitRelaxAllowed(), true);
      },
    );
    withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        WEXON_E2E_RELAX_RATE_LIMIT: undefined,
        WEXON_E2E_TARGET: "local",
      },
      () => {
        assert.equal(isE2eRateLimitRelaxAllowed(), false);
      },
    );
  });

  it("lists forbidden production envs that are set", () => {
    withEnv(
      {
        CUSTOMER_DEV_LOGIN_PASSWORD: "x",
        WEXON_E2E_RELAX_RATE_LIMIT: "true",
      },
      () => {
        const set = listForbiddenProductionEnvsSet();
        assert.ok(set.includes("CUSTOMER_DEV_LOGIN_PASSWORD"));
        assert.ok(set.includes("WEXON_E2E_RELAX_RATE_LIMIT"));
      },
    );
  });
});
