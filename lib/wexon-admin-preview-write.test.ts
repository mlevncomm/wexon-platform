import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_PREVIEW_WRITE_CAPABILITY_VERSION,
  ADMIN_PREVIEW_WRITE_COOKIE,
  ADMIN_PREVIEW_WRITE_TTL_MS,
  buildAdminPreviewAuditMetadata,
  buildAdminPreviewWriteCapability,
  encodeAdminPreviewWriteCookieValue,
  evaluateAdminPreviewDisableRequest,
  evaluateAdminPreviewWriteGate,
  hashPreviewWriteReason,
  parseAdminPreviewWriteCookieValue,
  sanitizeAdminPreviewAuditMetadata,
  validatePreviewWriteEnableInput,
} from "@/lib/wexon-admin-preview-write";
import {
  isAllowedWexPayRedirectPath,
  resolveSafeWexPayRedirectPath,
  wexpayAdminPreviewBasePath,
} from "@/lib/wexon-admin-preview-path";

function withSecret(fn: () => void) {
  const previous = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "unit-test-admin-preview-secret-key-32b";
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  }
}

describe("admin preview write capability sign/verify", () => {
  it("round-trips a valid pw2 capability with writeSessionId", () => {
    withSecret(() => {
      const payload = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-sub-1",
        organizationId: "org_1",
        reason: "support investigation note",
        now: 1_700_000_000_000,
        writeSessionId: "session-nonce-abc",
      });
      const encoded = encodeAdminPreviewWriteCookieValue(payload);
      const parsed = parseAdminPreviewWriteCookieValue(encoded, { now: 1_700_000_000_000 });
      assert.deepEqual(parsed, payload);
      assert.equal(ADMIN_PREVIEW_WRITE_COOKIE, "wexon_admin_preview_write_v1");
      assert.equal(ADMIN_PREVIEW_WRITE_CAPABILITY_VERSION, "pw2");
      assert.equal(ADMIN_PREVIEW_WRITE_TTL_MS, 10 * 60 * 1000);
      assert.equal(payload.writeSessionId, "session-nonce-abc");
      assert.equal(payload.expiresAt - payload.issuedAt, ADMIN_PREVIEW_WRITE_TTL_MS);
    });
  });

  it("rejects legacy pw1 cookies fail-closed", () => {
    withSecret(() => {
      const legacy = [
        "pw1",
        Buffer.from("admin_1").toString("base64url"),
        Buffer.from("cf-sub-1").toString("base64url"),
        Buffer.from("org_1").toString("base64url"),
        "1700000000000",
        "1700000600000",
        Buffer.from("deadbeef").toString("base64url"),
        "a".repeat(64),
      ].join(".");
      assert.equal(parseAdminPreviewWriteCookieValue(legacy, { now: 1_700_000_000_000 }), null);
    });
  });

  it("rejects expired, malformed, and tampered cookies", () => {
    withSecret(() => {
      assert.equal(parseAdminPreviewWriteCookieValue(""), null);
      assert.equal(parseAdminPreviewWriteCookieValue("not.a.cookie"), null);
      const payload = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-sub-1",
        organizationId: "org_1",
        reason: "reason long enough",
        now: 1_700_000_000_000,
      });
      const encoded = encodeAdminPreviewWriteCookieValue(payload);
      assert.equal(
        parseAdminPreviewWriteCookieValue(encoded, { now: 1_700_000_000_000 + 11 * 60_000 }),
        null,
      );
      const tampered = `${encoded.slice(0, -4)}abcd`;
      assert.equal(parseAdminPreviewWriteCookieValue(tampered, { now: 1_700_000_000_000 }), null);
    });
  });
});

describe("slug + reason validation", () => {
  it("requires exact slug match and reason length ≥ 8", () => {
    assert.equal(
      validatePreviewWriteEnableInput({
        slug: "wexpay-real-test",
        expectedSlug: "wexpay-real-test",
        reason: "short",
      }).ok,
      false,
    );
    assert.equal(
      validatePreviewWriteEnableInput({
        slug: "wrong",
        expectedSlug: "wexpay-real-test",
        reason: "long enough reason",
      }).ok,
      false,
    );
    assert.equal(
      validatePreviewWriteEnableInput({
        slug: "wexpay-real-test",
        expectedSlug: "wexpay-real-test",
        reason: "long enough reason",
      }).ok,
      true,
    );
  });

  it("hashes reasons without storing raw reason in capability", () => {
    const hash = hashPreviewWriteReason("support investigation note");
    assert.equal(hash.length, 32);
    assert.notEqual(hash, "support investigation note");
  });
});

describe("audit sanitizer + reason linkage fields", () => {
  it("strips secrets, subjects, jwt, and raw emails", () => {
    const sanitized = sanitizeAdminPreviewAuditMetadata({
      adminId: "admin_1",
      organizationId: "org_1",
      actionKey: "create_restaurant",
      email: "admin@wexon.dev",
      cloudflareSubject: "raw-subject",
      jwt: "eyJhbGciOi",
      token: "secret-token",
      password: "x",
      ADMIN_SESSION_SECRET: "nope",
      reason: "support fix",
      reasonHash: "abc",
      writeSessionId: "sess",
    });
    assert.equal(sanitized.email, undefined);
    assert.equal(sanitized.cloudflareSubject, undefined);
    assert.equal(sanitized.jwt, undefined);
    assert.equal(sanitized.token, undefined);
    assert.equal(sanitized.password, undefined);
    assert.equal(sanitized.ADMIN_SESSION_SECRET, undefined);
    assert.equal(sanitized.actionKey, "create_restaurant");
    assert.equal(sanitized.reason, "support fix");
    assert.equal(sanitized.reasonHash, "abc");
    assert.equal(sanitized.writeSessionId, "sess");
  });

  it("buildAdminPreviewAuditMetadata includes reasonHash/writeSessionId/expiry and masks email", () => {
    const meta = buildAdminPreviewAuditMetadata({
      adminId: "admin_1",
      email: "ops@wexon.dev",
      organizationId: "org_1",
      actionKey: "enable_write",
      reason: "customer support request",
      reasonHash: hashPreviewWriteReason("customer support request"),
      writeSessionId: "ws_123",
      writeModeExpiry: 123,
    });
    assert.equal(meta.emailMasked, "o***@wexon.dev");
    assert.equal(meta.email, undefined);
    assert.equal(meta.writeModeExpiry, 123);
    assert.equal(meta.writeSessionId, "ws_123");
    assert.equal(meta.reasonHash, hashPreviewWriteReason("customer support request"));
    assert.equal(meta.reason, "customer support request");
  });
});

describe("evaluateAdminPreviewWriteGate", () => {
  it("allows matching unexpired capability for active non-demo org", () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: "org_a",
        reason: "reason long enough",
        now: 1000,
      });
      const ok = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: "org_a",
        organization: { isActive: true, isDemo: false },
        now: 1000,
      });
      assert.equal(ok.ok, true);
    });
  });

  it("denies wrong org, demo, inactive, and expiry", () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: "org_a",
        reason: "reason long enough",
        now: 1000,
        ttlMs: 60_000,
      });
      assert.equal(
        evaluateAdminPreviewWriteGate({
          capability,
          adminId: "admin_1",
          cloudflareSubject: "cf-1",
          organizationId: "org_b",
          organization: { isActive: true, isDemo: false },
          now: 1000,
        }).ok,
        false,
      );
      const demoGate = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: "org_a",
        organization: { isActive: true, isDemo: true },
        now: 1000,
      });
      assert.equal(demoGate.ok, false);
      if (!demoGate.ok) assert.equal(demoGate.reason, "organization_demo");

      const inactiveGate = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: "org_a",
        organization: { isActive: false, isDemo: false },
        now: 1000,
      });
      assert.equal(inactiveGate.ok, false);
      if (!inactiveGate.ok) assert.equal(inactiveGate.reason, "organization_inactive");

      const expiredGate = evaluateAdminPreviewWriteGate({
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: "org_a",
        organization: { isActive: true, isDemo: false },
        now: 1000 + 61_000,
      });
      assert.equal(expiredGate.ok, false);
      if (!expiredGate.ok) assert.equal(expiredGate.reason, "capability_expired");
    });
  });
});

describe("disableAdminPreviewWrite tenant safety", () => {
  it("Org A capability + Org B disable request is denied without clearing cookie", () => {
    withSecret(() => {
      const capability = buildAdminPreviewWriteCapability({
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
        organizationId: "org_a",
        reason: "support window",
      });
      const decision = evaluateAdminPreviewDisableRequest({
        formOrganizationId: "org_b",
        capability,
        adminId: "admin_1",
        cloudflareSubject: "cf-1",
      });
      assert.equal(decision.ok, false);
      if (!decision.ok) {
        assert.equal(decision.reason, "capability_mismatch");
        assert.equal(decision.clearCookie, false);
        assert.equal(decision.auditOrganizationId, "org_a");
      }
    });
  });

  it("missing capability clears cookie and never invents success-org audit", () => {
    const decision = evaluateAdminPreviewDisableRequest({
      formOrganizationId: "org_b",
      capability: null,
      adminId: "admin_1",
      cloudflareSubject: "cf-1",
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.reason, "missing_capability");
      assert.equal(decision.clearCookie, true);
      assert.equal(decision.auditOrganizationId, undefined);
    }
  });
});

describe("preview path helpers + redirect confinement", () => {
  it("same-org preview redirect allowed; cross-org falls back; customer apps path unchanged", () => {
    assert.equal(
      wexpayAdminPreviewBasePath("org_abc"),
      "/admin/organizations/org_abc/wexpay-preview",
    );
    assert.equal(isAllowedWexPayRedirectPath("/apps/wexpay/restaurants"), true);
    assert.equal(
      resolveSafeWexPayRedirectPath(
        "/admin/organizations/org_abc/wexpay-preview/menu",
        "org_abc",
        wexpayAdminPreviewBasePath("org_abc"),
      ),
      "/admin/organizations/org_abc/wexpay-preview/menu",
    );
    assert.equal(
      resolveSafeWexPayRedirectPath(
        "/admin/organizations/org_other/wexpay-preview/menu",
        "org_abc",
        wexpayAdminPreviewBasePath("org_abc"),
      ),
      "/admin/organizations/org_abc/wexpay-preview",
    );
    assert.equal(
      resolveSafeWexPayRedirectPath(
        "/apps/wexpay/restaurants",
        "org_abc",
        "/apps/wexpay/restaurants",
      ),
      "/apps/wexpay/restaurants",
    );
    assert.equal(isAllowedWexPayRedirectPath("https://evil.example"), false);
    assert.equal(isAllowedWexPayRedirectPath("//evil.example"), false);
  });
});
