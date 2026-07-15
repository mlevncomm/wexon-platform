import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRequestIpAddress } from "./wexon-server-request";

describe("getRequestIpAddress", () => {
  it("prefers x-vercel-forwarded-for over spoofable leftmost x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 10.0.0.1",
        "x-vercel-forwarded-for": "203.0.113.50",
      },
    });
    assert.equal(getRequestIpAddress(request), "203.0.113.50");
  });

  it("prefers cf-connecting-ip over x-real-ip", () => {
    const request = new Request("https://example.com", {
      headers: {
        "cf-connecting-ip": "198.51.100.7",
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "1.2.3.4",
      },
    });
    assert.equal(getRequestIpAddress(request), "198.51.100.7");
  });

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
