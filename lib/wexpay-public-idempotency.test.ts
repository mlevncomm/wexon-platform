import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearIdempotencyStoreForTests,
  getIdempotentResponse,
  normalizeIdempotencyKey,
  storeIdempotentResponse,
} from "./wexpay-public-idempotency";

describe("public QR idempotency", () => {
  it("normalizes keys", () => {
    assert.equal(normalizeIdempotencyKey("  abc  "), "abc");
    assert.equal(normalizeIdempotencyKey(""), null);
    assert.equal(normalizeIdempotencyKey("x".repeat(200)), null);
  });

  it("stores and replays responses", () => {
    clearIdempotencyStoreForTests();
    storeIdempotentResponse("scope", "key-1", 201, { orderId: "o1" });
    const cached = getIdempotentResponse("scope", "key-1");
    assert.ok(cached);
    assert.equal(cached?.status, 201);
    assert.deepEqual(cached?.body, { orderId: "o1" });
    assert.equal(getIdempotentResponse("scope", "missing"), null);
  });
});
