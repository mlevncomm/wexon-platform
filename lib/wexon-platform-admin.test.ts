import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import {
  buildPlatformAdminAuditMetadata,
  decidePlatformAdminActiveStatus,
  evaluatePlatformAdminReadiness,
  formatCloudflareSubjectStatus,
  maskPlatformAdminEmail,
  normalizePlatformAdminEmail,
  parsePlatformAdminDisplayName,
  parsePlatformAdminEmail,
  sanitizePlatformAdminAuditMetadata,
} from "@/lib/wexon-platform-admin";

describe("normalizePlatformAdminEmail", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizePlatformAdminEmail("  Admin@Wexon.DEV "), "admin@wexon.dev");
  });
});

describe("parsePlatformAdminEmail / displayName", () => {
  it("accepts valid email and preserves original trim for display email", () => {
    const parsed = parsePlatformAdminEmail("  Ops@Example.COM ");
    assert.equal(parsed.email, "Ops@Example.COM");
    assert.equal(parsed.emailNormalized, "ops@example.com");
  });

  it("rejects invalid email and empty displayName", () => {
    assert.throws(() => parsePlatformAdminEmail("not-an-email"), AdminValidationError);
    assert.throws(() => parsePlatformAdminEmail("   "), AdminValidationError);
    assert.throws(() => parsePlatformAdminDisplayName("  "), AdminValidationError);
    assert.throws(() => parsePlatformAdminDisplayName("x".repeat(121)), AdminValidationError);
  });

  it("treats case/whitespace variants as the same normalized email (duplicate key)", () => {
    const a = parsePlatformAdminEmail("Admin@Wexon.dev");
    const b = parsePlatformAdminEmail("  admin@wexon.dev ");
    assert.equal(a.emailNormalized, b.emailNormalized);
  });
});

describe("maskPlatformAdminEmail / audit sanitization", () => {
  it("masks as a***@domain", () => {
    assert.equal(maskPlatformAdminEmail("admin@wexon.dev"), "a***@wexon.dev");
    assert.equal(maskPlatformAdminEmail("a@x.com"), "*@x.com");
  });

  it("strips raw email, subject, jwt, and secrets from audit metadata", () => {
    const meta = buildPlatformAdminAuditMetadata({
      email: "secret.admin@wexon.dev",
      displayName: "Ops",
      before: { isActive: true, email: "leak@x.com", cloudflareSubject: "sub-1" },
      after: { isActive: false },
      extra: {
        cloudflareSubject: "cf-sub",
        jwt: "eyJhbGciOi...",
        password: "nope",
        ADMIN_LOGIN_PASSWORD: "x",
        nested: { email: "nested@x.com", token: "t", ok: true },
      },
    });

    const json = JSON.stringify(meta);
    assert.equal(meta.emailMasked, "s***@wexon.dev");
    assert.equal(json.includes("secret.admin@wexon.dev"), false);
    assert.equal(json.includes("cloudflareSubject"), false);
    assert.equal(json.includes("cf-sub"), false);
    assert.equal(json.includes("eyJhbGciOi"), false);
    assert.equal(json.includes("ADMIN_LOGIN_PASSWORD"), false);
    assert.equal(json.includes("nested@x.com"), false);
    assert.deepEqual(meta.before, { isActive: true });
    assert.deepEqual(meta.after, { isActive: false });
    assert.equal((meta.nested as { ok: boolean }).ok, true);

    const sanitized = sanitizePlatformAdminAuditMetadata({
      email: "raw@x.com",
      emailMasked: "r***@x.com",
      subject: "s",
    });
    assert.equal("email" in sanitized, false);
    assert.equal("subject" in sanitized, false);
    assert.equal(sanitized.emailMasked, "r***@x.com");
  });
});

describe("status decisions / readiness", () => {
  it("blocks deactivating the last active PlatformAdmin", () => {
    const blocked = decidePlatformAdminActiveStatus({
      currentlyActive: true,
      otherActiveCount: 0,
      nextActive: false,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.reason, "last_active_platform_admin");
  });

  it("allows deactivate when another active admin exists and allows reactivate always", () => {
    assert.equal(
      decidePlatformAdminActiveStatus({
        currentlyActive: true,
        otherActiveCount: 1,
        nextActive: false,
      }).ok,
      true,
    );
    assert.deepEqual(
      decidePlatformAdminActiveStatus({
        currentlyActive: false,
        otherActiveCount: 0,
        nextActive: true,
      }),
      { ok: true, nextActive: true },
    );
  });

  it("readiness recommends at least two active admins and keeps Cloudflare note safe", () => {
    const low = evaluatePlatformAdminReadiness(1);
    assert.equal(low.recommendAtLeastTwo, true);
    assert.equal(low.cloudflareIdentity, "PR2B'de bağlanacak");
    assert.equal(low.sharedPasswordTransitional, true);
    assert.match(low.message, /paylaşılan admin şifresi/i);

    const ok = evaluatePlatformAdminReadiness(2);
    assert.equal(ok.recommendAtLeastTwo, false);
    assert.equal(formatCloudflareSubjectStatus(null), "Bağlanmadı");
    assert.equal(formatCloudflareSubjectStatus("cf|abc"), "Bağlandı");
  });
});
