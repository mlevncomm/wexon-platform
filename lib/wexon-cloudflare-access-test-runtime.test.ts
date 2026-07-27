/**
 * Loopback + CF Access test-mode runtime guards.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminCookieSecureFlag,
  isLocalCloudflareAccessTestRuntime,
  isLoopbackAdminHost,
} from "@/lib/wexon-cloudflare-access-test-runtime";
import { isCloudflareAccessTestMode } from "@/lib/wexon-cloudflare-access-config";

async function withEnv(env: Record<string, string | undefined>, run: () => void | Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key]);
    const value = env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("isLoopbackAdminHost", () => {
  it("allows localhost / 127.0.0.1 / ::1 with optional ports", () => {
    assert.equal(isLoopbackAdminHost("localhost"), true);
    assert.equal(isLoopbackAdminHost("LOCALHOST"), true);
    assert.equal(isLoopbackAdminHost("localhost:3000"), true);
    assert.equal(isLoopbackAdminHost("127.0.0.1"), true);
    assert.equal(isLoopbackAdminHost("127.0.0.1:5433"), true);
    assert.equal(isLoopbackAdminHost("::1"), true);
    assert.equal(isLoopbackAdminHost("[::1]"), true);
    assert.equal(isLoopbackAdminHost("[::1]:3000"), true);
  });

  it("rejects empty and non-loopback hosts", () => {
    assert.equal(isLoopbackAdminHost(null), false);
    assert.equal(isLoopbackAdminHost(""), false);
    assert.equal(isLoopbackAdminHost("   "), false);
    assert.equal(isLoopbackAdminHost("example.com"), false);
    assert.equal(isLoopbackAdminHost("admin.wexon.dev"), false);
    assert.equal(isLoopbackAdminHost("wexon-platform.vercel.app"), false);
    assert.equal(isLoopbackAdminHost("192.168.1.10"), false);
    assert.equal(isLoopbackAdminHost("10.0.0.1:3000"), false);
    assert.equal(isLoopbackAdminHost("localhost.evil.com"), false);
  });
});

describe("isLocalCloudflareAccessTestRuntime", () => {
  it("requires both test mode and loopback host", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        WEXON_CF_ACCESS_TEST_MODE: "1",
      },
      () => {
        assert.equal(isCloudflareAccessTestMode(), true);
        assert.equal(isLocalCloudflareAccessTestRuntime("localhost:3000"), true);
        assert.equal(isLocalCloudflareAccessTestRuntime("127.0.0.1"), true);
        assert.equal(isLocalCloudflareAccessTestRuntime("admin.wexon.dev"), false);
        assert.equal(isLocalCloudflareAccessTestRuntime("example.com"), false);
      },
    );
  });

  it("stays false on Vercel production even with flag + loopback host header spoof", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        WEXON_CF_ACCESS_TEST_MODE: "1",
      },
      () => {
        assert.equal(isCloudflareAccessTestMode(), false);
        assert.equal(isLocalCloudflareAccessTestRuntime("localhost"), false);
        assert.equal(isLocalCloudflareAccessTestRuntime("127.0.0.1:3000"), false);
      },
    );
  });

  it("stays false on Vercel preview even with flag + loopback host header spoof", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        WEXON_CF_ACCESS_TEST_MODE: "1",
      },
      () => {
        assert.equal(isCloudflareAccessTestMode(), false);
        assert.equal(isLocalCloudflareAccessTestRuntime("localhost"), false);
      },
    );
  });

  it("stays false without test mode on loopback", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        WEXON_CF_ACCESS_TEST_MODE: undefined,
      },
      () => {
        assert.equal(isCloudflareAccessTestMode(), false);
        assert.equal(isLocalCloudflareAccessTestRuntime("localhost"), false);
      },
    );
  });
});

describe("adminCookieSecureFlag", () => {
  it("forces insecure cookies for CF Access test mode HTTP local/CI", async () => {
    await withEnv({ NODE_ENV: "production", WEXON_CF_ACCESS_TEST_MODE: "1" }, () => {
      assert.equal(adminCookieSecureFlag(), false);
    });
  });

  it("keeps Secure cookies in production without test mode", async () => {
    await withEnv({ NODE_ENV: "production", WEXON_CF_ACCESS_TEST_MODE: undefined }, () => {
      assert.equal(adminCookieSecureFlag(), true);
    });
  });
});
