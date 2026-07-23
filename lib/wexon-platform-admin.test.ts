import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import {
  PLATFORM_ADMIN_GENERIC_ACTION_ERROR,
  buildPlatformAdminActionErrorQuery,
  buildPlatformAdminAuditMetadata,
  decidePlatformAdminActiveStatus,
  evaluatePlatformAdminReadiness,
  formatCloudflareSubjectStatus,
  maskPlatformAdminEmail,
  normalizePlatformAdminEmail,
  parsePlatformAdminCloudflareSubject,
  parsePlatformAdminDisplayName,
  parsePlatformAdminEmail,
  resolvePlatformAdminActionErrorMessage,
  sanitizePlatformAdminAuditMetadata,
  LastActivePlatformAdminError,
  PlatformAdminDuplicateEmailError,
} from "@/lib/wexon-platform-admin";

describe("normalizePlatformAdminEmail", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizePlatformAdminEmail("  Admin@Wexon.DEV "), "admin@wexon.dev");
  });
});

describe("parsePlatformAdminEmail / displayName / cloudflareSubject", () => {
  it("accepts valid email and preserves trimmed display email", () => {
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

  it("matches DB CHECK shape for emailNormalized and displayName", () => {
    const { email, emailNormalized } = parsePlatformAdminEmail("  MixEd@Domain.COM ");
    assert.equal(emailNormalized, email.trim().toLowerCase());
    assert.equal(emailNormalized.length > 0, true);
    const name = parsePlatformAdminDisplayName("  Ops Lead  ");
    assert.equal(name, "Ops Lead");
    assert.ok(name.length >= 1 && name.length <= 120);
  });

  it("parses cloudflareSubject as null or trimmed non-empty", () => {
    assert.equal(parsePlatformAdminCloudflareSubject(null), null);
    assert.equal(parsePlatformAdminCloudflareSubject(undefined), null);
    assert.equal(parsePlatformAdminCloudflareSubject("  cf|abc  "), "cf|abc");
    assert.throws(() => parsePlatformAdminCloudflareSubject("   "), AdminValidationError);
    assert.throws(() => parsePlatformAdminCloudflareSubject(""), AdminValidationError);
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

  it("case-insensitive keys; nested arrays; preserves emailMasked/displayName/isActive", () => {
    const sanitized = sanitizePlatformAdminAuditMetadata({
      Email: "Case@Leak.com",
      EMAIL: "ALL@Leak.com",
      Subject: "sub-CASE",
      CloudflareSubject: "cf-CASE",
      JWT: "eyJhbGciOiJIUzI1NiJ9.payload.sig",
      Token: "tok-1",
      Password: "pw",
      Secret: "sec",
      emailMasked: "c***@leak.com",
      displayName: "Keeper",
      isActive: true,
      items: [
        {
          rawEmail: "array@leak.com",
          token: "array-token",
          subject: "array-subject",
          ok: 1,
        },
        [
          { JWT: "nested-jwt", cloudflareSubject: "nested-sub", keep: true },
        ],
      ],
      deep: { level: { Email: "deep@x.com", safe: "yes" } },
    });

    const json = JSON.stringify(sanitized);
    assert.equal(sanitized.emailMasked, "c***@leak.com");
    assert.equal(sanitized.displayName, "Keeper");
    assert.equal(sanitized.isActive, true);
    assert.equal(json.toLowerCase().includes("case@leak.com"), false);
    assert.equal(json.toLowerCase().includes("all@leak.com"), false);
    assert.equal(json.includes("array@leak.com"), false);
    assert.equal(json.includes("array-token"), false);
    assert.equal(json.includes("array-subject"), false);
    assert.equal(json.includes("eyJhbGciOi"), false);
    assert.equal(json.includes("nested-jwt"), false);
    assert.equal(json.includes("nested-sub"), false);
    assert.equal(json.includes("deep@x.com"), false);
    assert.equal(json.includes("pw"), false);
    assert.equal(json.includes("sec"), false);
    assert.equal((sanitized.items as Array<{ ok?: number }>)[0]?.ok, 1);
    assert.equal(
      ((sanitized.items as unknown[])[1] as Array<{ keep?: boolean }>)[0]?.keep,
      true,
    );
    assert.equal((sanitized.deep as { level: { safe: string } }).level.safe, "yes");
  });

  it("bounds recursion depth against abuse", () => {
    let nested: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 20; i += 1) {
      nested = { child: nested };
    }
    const sanitized = sanitizePlatformAdminAuditMetadata(nested);
    // Should not throw; depth bound yields empty/truncated object tree.
    assert.equal(typeof sanitized, "object");
    const json = JSON.stringify(sanitized);
    assert.ok(json.length < 5000);
  });
});

describe("action error leakage", () => {
  it("allows only domain errors; Prisma-like errors stay generic (no URL leak)", () => {
    assert.equal(
      resolvePlatformAdminActionErrorMessage(new AdminValidationError("E-posta zorunludur.")),
      "E-posta zorunludur.",
    );
    assert.equal(
      resolvePlatformAdminActionErrorMessage(new LastActivePlatformAdminError()),
      new LastActivePlatformAdminError().message,
    );
    assert.equal(
      resolvePlatformAdminActionErrorMessage(new PlatformAdminDuplicateEmailError()),
      new PlatformAdminDuplicateEmailError().message,
    );

    const prismaLike = Object.assign(
      new Error(
        "Invalid `prisma.platformAdmin.create()` invocation:\n\nUnique constraint failed on the fields: (`emailNormalized`)\n\n    at $n.handleRequestError",
      ),
      {
        code: "P2002",
        meta: { modelName: "PlatformAdmin", target: ["emailNormalized"] },
        clientVersion: "6.19.0",
      },
    );

    const message = resolvePlatformAdminActionErrorMessage(prismaLike);
    assert.equal(message, PLATFORM_ADMIN_GENERIC_ACTION_ERROR);
    assert.equal(message.includes("prisma"), false);
    assert.equal(message.includes("emailNormalized"), false);
    assert.equal(message.includes("P2002"), false);
    assert.equal(message.includes("invocation"), false);

    const query = buildPlatformAdminActionErrorQuery(prismaLike);
    assert.equal(query.includes("prisma"), false);
    assert.equal(query.includes("emailNormalized"), false);
    assert.equal(query.includes("P2002"), false);
    assert.equal(query.includes("Unique%20constraint"), false);
    assert.equal(query.includes("handleRequestError"), false);
    assert.equal(
      new URLSearchParams(query).get("adminError"),
      PLATFORM_ADMIN_GENERIC_ACTION_ERROR,
    );

    const sqlLike = new Error("connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap");
    const sqlQuery = buildPlatformAdminActionErrorQuery(sqlLike);
    assert.equal(sqlQuery.includes("ECONNREFUSED"), false);
    assert.equal(sqlQuery.includes("5432"), false);
    assert.equal(
      new URLSearchParams(sqlQuery).get("adminError"),
      PLATFORM_ADMIN_GENERIC_ACTION_ERROR,
    );
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
