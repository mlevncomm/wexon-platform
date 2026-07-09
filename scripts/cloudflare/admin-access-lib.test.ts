import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCESS_DOMAIN,
  ADMIN_HOSTNAME,
  buildPolicyPayload,
  domainHasWildcard,
  extractApplicationDomains,
  findForbiddenApplications,
  isExactAdminAccessDomain,
  isForbiddenAccessDomain,
  parseAdminEmails,
  policyNeedsUpdate,
  redactEmail,
} from "./admin-access-lib";

describe("parseAdminEmails", () => {
  it("parses comma-separated emails", () => {
    assert.deepEqual(parseAdminEmails(" Admin@Example.com, ops@wexon.dev "), [
      "admin@example.com",
      "ops@wexon.dev",
    ]);
  });

  it("rejects empty input", () => {
    assert.throws(() => parseAdminEmails("   "), /CLOUDFLARE_ACCESS_ADMIN_EMAILS/);
  });
});

describe("admin access domain guards", () => {
  it("accepts exact admin host with wildcard path", () => {
    assert.equal(isExactAdminAccessDomain(ACCESS_DOMAIN), true);
    assert.equal(isExactAdminAccessDomain(ADMIN_HOSTNAME), true);
  });

  it("rejects wildcard subdomains", () => {
    assert.equal(domainHasWildcard("*.wexon.dev"), true);
    assert.equal(isForbiddenAccessDomain("*.wexon.dev"), true);
    assert.equal(isForbiddenAccessDomain("*.wexon.dev/*"), true);
  });

  it("rejects public and product hosts", () => {
    assert.equal(isForbiddenAccessDomain("www.wexon.dev"), true);
    assert.equal(isForbiddenAccessDomain("core.wexon.dev/dashboard"), true);
    assert.equal(isForbiddenAccessDomain("app.wexon.dev"), true);
    assert.equal(isForbiddenAccessDomain("wexon.dev"), true);
  });

  it("allows only admin host", () => {
    assert.equal(isForbiddenAccessDomain(ACCESS_DOMAIN), false);
    assert.equal(isExactAdminAccessDomain(ACCESS_DOMAIN), true);
  });
});

describe("forbidden application scan", () => {
  it("flags wildcard apps", () => {
    const matches = findForbiddenApplications([
      {
        id: "1",
        name: "Bad",
        domain: "*.wexon.dev",
        type: "self_hosted",
      },
    ]);
    assert.equal(matches.length, 1);
  });

  it("extracts destination URIs", () => {
    assert.deepEqual(
      extractApplicationDomains({
        id: "1",
        name: "Admin",
        domain: "admin.wexon.dev/*",
        type: "self_hosted",
        destinations: [{ type: "public", uri: "admin.wexon.dev/*" }],
      }),
      ["admin.wexon.dev/*"],
    );
  });
});

describe("policy helpers", () => {
  it("builds exact email allowlist payload", () => {
    const payload = buildPolicyPayload(["admin@wexon.dev"]);
    assert.equal(payload.decision, "allow");
    assert.deepEqual(payload.include, [{ email: { email: "admin@wexon.dev" } }]);
  });

  it("detects email drift", () => {
    const reasons = policyNeedsUpdate(
      {
        id: "p1",
        name: "Wexon Admin Allowlist",
        decision: "allow",
        include: [{ email: { email: "old@wexon.dev" } }],
      },
      ["new@wexon.dev"],
    );
    assert.ok(reasons.length > 0);
  });
});

describe("redactEmail", () => {
  it("redacts local part", () => {
    assert.equal(redactEmail("admin@wexon.dev"), "a***@wexon.dev");
  });
});
