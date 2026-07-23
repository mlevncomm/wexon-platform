import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  maskSecretInMessage,
  validateDeployEnvironment,
  validateLongSecretValue,
  validatePaytrOffForReadiness,
  validatePublicAppUrl,
} from "./wexon-deploy-env";

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app",
    DIRECT_URL: "postgresql://user:pass@db.example.com:5432/app",
    ADMIN_EMAILS: "admin@wexon.dev",
    ADMIN_LOGIN_PASSWORD: "strong-admin-password",
    ADMIN_SESSION_SECRET: "adm1n-Sess1on-Secret-Value-9f3a2c71e8b4",
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: "mute-snow-d07a.cloudflareaccess.com",
    CLOUDFLARE_ACCESS_AUD: "wexon-admin-access-audience-9f3a2c71",
    CUSTOMER_SESSION_SECRET: "cust0mer-Sess1on-Secret-Value-7d2e9a14c6",
    API_KEY_HASH_SECRET: "ap1-Key-Hash-Secret-Value-4b8c1e9063d2",
    NEXT_PUBLIC_APP_URL: "https://www.wexon.dev",
    MAINTENANCE_MODE: "false",
    WEXPAY_PAYTR_ENABLE_API: "false",
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    ...overrides,
  };
}

describe("deploy environment validation", () => {
  it("passes a complete production PayTR-off matrix", () => {
    const report = validateDeployEnvironment(baseEnv());
    assert.equal(report.ok, true);
    assert.equal(report.missing.length, 0);
  });

  it("fails when required vars are missing including API_KEY_HASH_SECRET", () => {
    const report = validateDeployEnvironment(
      baseEnv({ API_KEY_HASH_SECRET: undefined, ADMIN_SESSION_SECRET: undefined }),
    );
    assert.equal(report.ok, false);
    assert.ok(report.missing.includes("API_KEY_HASH_SECRET"));
    assert.ok(report.missing.includes("ADMIN_SESSION_SECRET"));
  });

  it("rejects placeholder and short secrets", () => {
    assert.ok(validateLongSecretValue("API_KEY_HASH_SECRET", "change-me-now-please-xxxxxxxx"));
    assert.ok(validateLongSecretValue("API_KEY_HASH_SECRET", "short"));
    const report = validateDeployEnvironment(
      baseEnv({ API_KEY_HASH_SECRET: "change-me-before-production-xxxxxxxxxx" }),
    );
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((i) => i.code === "secret_weak" || i.code === "secret_too_short"));
  });

  it("forbids PayTR activation values including true/1/yes", () => {
    assert.equal(validatePaytrOffForReadiness("false"), null);
    assert.ok(validatePaytrOffForReadiness("true"));
    assert.ok(validatePaytrOffForReadiness("1"));
    assert.ok(validatePaytrOffForReadiness("yes"));

    const report = validateDeployEnvironment(baseEnv({ WEXPAY_PAYTR_ENABLE_API: "true" }));
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((i) => i.code === "paytr_must_be_off"));
  });

  it("forbids localhost NEXT_PUBLIC_APP_URL in production", () => {
    assert.ok(
      validatePublicAppUrl("http://localhost:3000", { requireProductionUrl: true }),
    );
    assert.ok(
      validatePublicAppUrl("https://127.0.0.1:3000", { requireProductionUrl: true }),
    );
    assert.equal(
      validatePublicAppUrl("https://www.wexon.dev", { requireProductionUrl: true }),
      null,
    );

    const report = validateDeployEnvironment(
      baseEnv({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
    );
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((i) => i.code === "app_url_not_https" || i.code === "app_url_localhost"));
  });

  it("allows localhost APP_URL outside production-like env", () => {
    const report = validateDeployEnvironment(
      baseEnv({
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    );
    assert.equal(report.ok, true);
  });

  it("requires Cloudflare Access team domain + audience", () => {
    const report = validateDeployEnvironment(
      baseEnv({ CLOUDFLARE_ACCESS_TEAM_DOMAIN: undefined, CLOUDFLARE_ACCESS_AUD: undefined }),
    );
    assert.equal(report.ok, false);
    assert.ok(report.missing.includes("CLOUDFLARE_ACCESS_TEAM_DOMAIN"));
    assert.ok(report.missing.includes("CLOUDFLARE_ACCESS_AUD"));
  });

  it("forbids CF Access test mode envs in production-like env", () => {
    for (const name of [
      "WEXON_CF_ACCESS_TEST_MODE",
      "WEXON_CF_ACCESS_TEST_PRIVATE_JWK",
      "WEXON_CF_ACCESS_TEST_PUBLIC_JWKS",
    ] as const) {
      const report = validateDeployEnvironment(baseEnv({ [name]: "1" }));
      assert.equal(report.ok, false, name);
      assert.ok(
        report.issues.some((i) => i.code === "forbidden_env" && i.message.includes(name)),
        name,
      );
    }
  });

  it("forbids CF Access test mode envs in preview env", () => {
    for (const name of [
      "WEXON_CF_ACCESS_TEST_MODE",
      "WEXON_CF_ACCESS_TEST_PRIVATE_JWK",
      "WEXON_CF_ACCESS_TEST_PUBLIC_JWKS",
    ] as const) {
      const report = validateDeployEnvironment(
        baseEnv({
          NODE_ENV: "development",
          VERCEL_ENV: "preview",
          NEXT_PUBLIC_APP_URL: "https://preview.example.com",
          [name]: name === "WEXON_CF_ACCESS_TEST_MODE" ? "1" : '{"keys":[]}',
        }),
      );
      assert.equal(report.ok, false, name);
      assert.ok(
        report.issues.some((i) => i.code === "forbidden_env" && i.message.includes(name)),
        name,
      );
    }
  });

  it("masks secrets in messages", () => {
    const secret = "super-secret-value-do-not-leak";
    const masked = maskSecretInMessage(`boom ${secret} postgresql://u:p@h/db`, [secret]);
    assert.equal(masked.includes(secret), false);
    assert.ok(masked.includes("[REDACTED]"));
    assert.equal(masked.includes("postgresql://u:p@h/db"), false);
  });
});
