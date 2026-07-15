import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHealthLivenessBody,
  buildHealthReadinessBody,
  healthResponseHeaders,
  probeDatabaseReadiness,
} from "./wexon-health";

describe("health bodies", () => {
  it("builds liveness payload without internals", () => {
    const body = buildHealthLivenessBody();
    assert.deepEqual(body, { status: "ok", service: "wexon-platform" });
    assert.equal(Object.keys(body).length, 2);
  });

  it("builds readiness success and failure payloads", () => {
    assert.deepEqual(buildHealthReadinessBody(true), { status: "ready" });
    assert.deepEqual(buildHealthReadinessBody(false), { status: "not_ready" });
  });

  it("sets no-store cache headers", () => {
    const headers = healthResponseHeaders() as Record<string, string>;
    assert.match(headers["Cache-Control"], /no-store/i);
  });
});

describe("probeDatabaseReadiness", () => {
  it("returns false when DATABASE_URL and DIRECT_URL are missing", async () => {
    const previousDb = process.env.DATABASE_URL;
    const previousDirect = process.env.DIRECT_URL;
    try {
      delete process.env.DATABASE_URL;
      delete process.env.DIRECT_URL;
      assert.equal(await probeDatabaseReadiness(200, async () => undefined), false);
    } finally {
      if (previousDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDb;
      if (previousDirect === undefined) delete process.env.DIRECT_URL;
      else process.env.DIRECT_URL = previousDirect;
    }
  });

  it("returns true when injectable query succeeds", async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://local/test";
    assert.equal(await probeDatabaseReadiness(500, async () => ({ ok: 1 })), true);
  });

  it("returns false on query failure without leaking the error", async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://local/test";
    const ready = await probeDatabaseReadiness(200, async () => {
      throw new Error("prisma connection refused host=db.internal stack DATABASE_URL=secret");
    });
    assert.equal(ready, false);
    assert.deepEqual(buildHealthReadinessBody(ready), { status: "not_ready" });
  });

  it("returns false on timeout", async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://local/test";
    const ready = await probeDatabaseReadiness(
      50,
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    );
    assert.equal(ready, false);
  });
});
