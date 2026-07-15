import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enforceRateLimit,
  RATE_LIMITS,
  resetRateLimitStoreForTests,
  resolveRateLimitConfig,
} from "./wexon-rate-limit";
import {
  assertPublicPayloadSafe,
  enforcePublicAssistTableCooldown,
  enforcePublicQrIpRateLimit,
} from "./wexpay-public-rate-limit";

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

describe("public QR rate limit matrix", () => {
  it("exposes dedicated menu/waiter/payment buckets", () => {
    assert.equal(RATE_LIMITS.publicQrMenu.limit, 90);
    assert.equal(RATE_LIMITS.publicQrOrder.limit, 20);
    assert.equal(RATE_LIMITS.publicQrBill.limit, 90);
    assert.equal(RATE_LIMITS.publicQrWaiterCall.limit, 8);
    assert.equal(RATE_LIMITS.publicQrPaymentRequest.limit, 8);
    assert.equal(RATE_LIMITS.publicQrCheckout.limit, 15);
    assert.equal(RATE_LIMITS.publicQrWaiterTableCooldown.limit, 1);
    assert.equal(RATE_LIMITS.publicQrPaymentRequestTableCooldown.windowMs, 60_000);
  });

  it("force flag bypasses E2E rate-limit relax", () => {
    resetRateLimitStoreForTests();
    withEnv(
      {
        WEXON_E2E_RELAX_RATE_LIMIT: "true",
        WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT: "true",
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        WEXON_E2E_TARGET: "isolated",
      },
      () => {
        const scope = `test.public.force.${Date.now()}`;
        const config = { limit: 1, windowMs: 60_000 };
        assert.equal(enforceRateLimit(scope, "203.0.113.1", config).ok, true);
        assert.equal(enforceRateLimit(scope, "203.0.113.1", config).ok, false);
      },
    );
  });

  it("resolves low E2E override limits only when force flag is set", () => {
    withEnv(
      {
        WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT: "true",
        WEXON_PUBLIC_QR_MENU_LIMIT: "4",
        VERCEL_ENV: undefined,
      },
      () => {
        const resolved = resolveRateLimitConfig(RATE_LIMITS.publicQrMenu, "WEXON_PUBLIC_QR_MENU_LIMIT");
        assert.equal(resolved.limit, 4);
      },
    );
    withEnv(
      {
        WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT: undefined,
        WEXON_PUBLIC_QR_MENU_LIMIT: "4",
        VERCEL_ENV: undefined,
      },
      () => {
        const resolved = resolveRateLimitConfig(RATE_LIMITS.publicQrMenu, "WEXON_PUBLIC_QR_MENU_LIMIT");
        assert.equal(resolved.limit, RATE_LIMITS.publicQrMenu.limit);
      },
    );
  });

  it("keeps waiter and payment-request table cooldowns in separate buckets", () => {
    resetRateLimitStoreForTests();
    withEnv(
      {
        WEXON_E2E_RELAX_RATE_LIMIT: undefined,
        WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT: "true",
        WEXON_PUBLIC_ASSIST_COOLDOWN_MS: "60000",
        VERCEL_ENV: undefined,
      },
      () => {
        const tableId = `table-${Date.now()}`;
        const waiter1 = enforcePublicAssistTableCooldown({
          kind: "waiter",
          tableId,
          qrCode: "QR",
          ipAddress: "203.0.113.9",
        });
        const pay1 = enforcePublicAssistTableCooldown({
          kind: "payment_request",
          tableId,
          qrCode: "QR",
          ipAddress: "203.0.113.9",
        });
        assert.equal(waiter1.ok, true);
        assert.equal(pay1.ok, true);
        const waiter2 = enforcePublicAssistTableCooldown({
          kind: "waiter",
          tableId,
          qrCode: "QR",
          ipAddress: "203.0.113.9",
        });
        assert.equal(waiter2.ok, false);
        if (!waiter2.ok) {
          assert.equal(waiter2.response.status, 429);
        }
      },
    );
  });

  it("rejects public payloads that leak internal fields", () => {
    assert.throws(() => assertPublicPayloadSafe({ organizationId: "x" }));
    assert.throws(() => assertPublicPayloadSafe({ riskReasons: [] }));
    assert.doesNotThrow(() => assertPublicPayloadSafe({ ok: true, charged: false }));
  });

  it("enforces menu IP rate limit helper", () => {
    resetRateLimitStoreForTests();
    withEnv(
      {
        WEXON_E2E_RELAX_RATE_LIMIT: undefined,
        WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT: "true",
        WEXON_PUBLIC_QR_MENU_LIMIT: "2",
        VERCEL_ENV: undefined,
      },
      () => {
        const ip = `203.0.113.${Date.now() % 200}`;
        for (let i = 0; i < 2; i += 1) {
          const request = new Request("https://example.com/menu", {
            headers: { "x-real-ip": ip },
          });
          const result = enforcePublicQrIpRateLimit({ kind: "menu", request, qrCode: "QR" });
          assert.equal(result.ok, true);
        }
        const blocked = enforcePublicQrIpRateLimit({
          kind: "menu",
          request: new Request("https://example.com/menu", { headers: { "x-real-ip": ip } }),
          qrCode: "QR",
        });
        assert.equal(blocked.ok, false);
      },
    );
  });
});
