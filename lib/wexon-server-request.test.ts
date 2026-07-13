import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRequestIpAddress } from "./wexon-server-request";

describe("getRequestIpAddress", () => {
  it("prefers x-real-ip over spoofable x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 10.0.0.1",
        "x-real-ip": "203.0.113.10",
      },
    });
    assert.equal(getRequestIpAddress(request), "203.0.113.10");
  });

  it("falls back to the rightmost x-forwarded-for hop", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 10.0.0.1",
      },
    });
    assert.equal(getRequestIpAddress(request), "10.0.0.1");
  });
});
