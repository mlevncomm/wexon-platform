import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeIdempotencyKey, readIdempotencyKeyFromRequest } from "./wexpay-public-idempotency";

describe("public QR idempotency", () => {
  it("normalizes keys", () => {
    assert.equal(normalizeIdempotencyKey("  abc  "), "abc");
    assert.equal(normalizeIdempotencyKey(""), null);
    assert.equal(normalizeIdempotencyKey("x".repeat(200)), null);
  });

  it("reads Idempotency-Key header", () => {
    const request = new Request("https://example.com", {
      headers: { "Idempotency-Key": "  key-1  " },
    });
    assert.equal(readIdempotencyKeyFromRequest(request), "key-1");
  });
});
