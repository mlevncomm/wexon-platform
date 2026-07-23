import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_LEGACY,
  ADMIN_SESSION_COOKIE_V2,
  ADMIN_SESSION_TTL_MS,
  ADMIN_LOGIN_GENERIC_ERROR,
  ADMIN_PRODUCTION_LOGIN_URL,
  adminSessionCookieClearOptions,
  adminSessionCookieLegacyDomainClearOptions,
  adminSessionCookieOptions,
  isAdminAccessHostAllowed,
  isAdminEmailAllowed,
  parseAdminSessionCookieValue,
  securePasswordEqual,
} from "./wexon-admin-auth";
import {
  ADMIN_SESSION_COOKIE as SHARED_COOKIE,
  ADMIN_SESSION_COOKIE_LEGACY as SHARED_LEGACY,
  ADMIN_SESSION_COOKIE_V2 as SHARED_V2,
} from "./wexon-admin-session-cookie";
import {
  buildAdminSessionV3Payload,
  encodeAdminSessionV3CookieValue,
  parseAdminSessionV3CookieValue,
} from "./wexon-admin-session-v3";

function withEnv(snapshot: Record<string, string | undefined>, fn: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(snapshot)) {
    previous.set(key, process.env[key]);
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("admin session cookie names (PR2B v3)", () => {
  it("uses versioned v3 name for active sessions", () => {
    assert.equal(ADMIN_SESSION_COOKIE, "wexon_admin_session_v3");
    assert.equal(ADMIN_SESSION_COOKIE_V2, "wexon_admin_session_v2");
    assert.equal(ADMIN_SESSION_COOKIE_LEGACY, "wexon_admin_session");
    assert.equal(SHARED_COOKIE, ADMIN_SESSION_COOKIE);
    assert.equal(SHARED_V2, ADMIN_SESSION_COOKIE_V2);
    assert.equal(SHARED_LEGACY, ADMIN_SESSION_COOKIE_LEGACY);
    assert.notEqual(ADMIN_SESSION_COOKIE, ADMIN_SESSION_COOKIE_V2);
  });
});

describe("ADMIN_SESSION_TTL_MS", () => {
  it("is 2 hours absolute", () => {
    assert.equal(ADMIN_SESSION_TTL_MS, 2 * 60 * 60 * 1000);
  });
});

describe("securePasswordEqual (rollback helper only)", () => {
  it("accepts matching passwords", () => {
    assert.equal(securePasswordEqual("shared-admin-secret", "shared-admin-secret"), true);
  });

  it("rejects mismatched passwords", () => {
    assert.equal(securePasswordEqual("wrong", "shared-admin-secret"), false);
  });

  it("rejects empty vs non-empty without throwing", () => {
    assert.equal(securePasswordEqual("", "shared-admin-secret"), false);
    assert.equal(securePasswordEqual("shared-admin-secret", ""), false);
  });

  it("is length-agnostic via SHA-256 digests", () => {
    assert.equal(securePasswordEqual("a", "bb"), false);
    assert.equal(securePasswordEqual("same-length-ok!", "same-length-ok!"), true);
  });
});

describe("adminSessionCookieOptions", () => {
  it("is host-only (no Domain) in production", () => {
    withEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://app.wexon.dev" }, () => {
      const expires = new Date("2030-01-01T00:00:00.000Z");
      const options = adminSessionCookieOptions(expires);
      assert.equal("domain" in options, false);
      assert.equal(options.domain, undefined);
      assert.equal(options.httpOnly, true);
      assert.equal(options.sameSite, "lax");
      assert.equal(options.secure, true);
      assert.equal(options.path, "/");
      assert.equal(options.expires.toISOString(), expires.toISOString());
    });
  });

  it("is host-only in development", () => {
    withEnv({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, () => {
      const options = adminSessionCookieOptions(new Date());
      assert.equal("domain" in options, false);
      assert.equal(options.secure, false);
    });
  });

  it("clear options are host-only; legacy clear retains Domain for migration", () => {
    withEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://app.wexon.dev" }, () => {
      const clear = adminSessionCookieClearOptions();
      assert.equal("domain" in clear, false);
      assert.equal(clear.expires.getTime(), 0);

      const legacy = adminSessionCookieLegacyDomainClearOptions();
      assert.equal(legacy.domain, ".wexon.dev");
      assert.equal(legacy.expires.getTime(), 0);
    });
  });
});

describe("isAdminAccessHostAllowed", () => {
  it("allows any host when not production Wexon deployment", () => {
    assert.equal(isAdminAccessHostAllowed("localhost", false), true);
    assert.equal(isAdminAccessHostAllowed("www.wexon.dev", false), true);
    assert.equal(isAdminAccessHostAllowed("core.wexon.dev", false), true);
  });

  it("allows only admin host/surface in production Wexon deployment", () => {
    assert.equal(isAdminAccessHostAllowed("admin.wexon.dev", true), true);
    assert.equal(isAdminAccessHostAllowed("Admin.Wexon.Dev", true), true);
    assert.equal(isAdminAccessHostAllowed("www.wexon.dev", true), false);
    assert.equal(isAdminAccessHostAllowed("core.wexon.dev", true), false);
    assert.equal(isAdminAccessHostAllowed("app.wexon.dev", true), false);
    assert.equal(isAdminAccessHostAllowed("wexon.dev", true), false);
    assert.equal(isAdminAccessHostAllowed("wexon-platform-abc.vercel.app", true), false);
  });
});

describe("isAdminEmailAllowed (deprecated — not authorization)", () => {
  it("matches allowlist case-insensitively but must not be used for auth", () => {
    withEnv({ ADMIN_EMAILS: "Ops@Wexon.dev, other@example.com" }, () => {
      assert.equal(isAdminEmailAllowed("ops@wexon.dev"), true);
      assert.equal(isAdminEmailAllowed("missing@wexon.dev"), false);
    });
  });
});

describe("ADMIN_LOGIN_GENERIC_ERROR", () => {
  it("is generic Turkish denial without technical leak", () => {
    assert.match(ADMIN_LOGIN_GENERIC_ERROR, /erişim reddedildi/i);
    assert.doesNotMatch(ADMIN_LOGIN_GENERIC_ERROR, /ADMIN_|allowlist|jwt|jwks|şifre hatalı/i);
  });
});

describe("ADMIN_PRODUCTION_LOGIN_URL", () => {
  it("points at admin.wexon.dev login", () => {
    assert.equal(ADMIN_PRODUCTION_LOGIN_URL, "https://admin.wexon.dev/login");
  });
});

describe("session v3 encode/parse", () => {
  it("round-trips payload and rejects tampering / v2 shapes", () => {
    withEnv({ ADMIN_SESSION_SECRET: "unit-test-admin-session-secret-32chars!!" }, () => {
      const payload = buildAdminSessionV3Payload({
        adminId: "admin_1",
        email: "Ops@Wexon.dev",
        cloudflareSubject: "cf-sub-9",
      });
      const value = encodeAdminSessionV3CookieValue(payload);
      const parsed = parseAdminSessionV3CookieValue(value);
      assert.ok(parsed);
      assert.equal(parsed!.adminId, "admin_1");
      assert.equal(parsed!.email, "ops@wexon.dev");
      assert.equal(parsed!.cloudflareSubject, "cf-sub-9");
      assert.equal(parsed!.expiresAt - parsed!.issuedAt, ADMIN_SESSION_TTL_MS);

      const viaAuth = parseAdminSessionCookieValue(value);
      assert.ok(viaAuth);
      assert.equal(viaAuth!.adminId, "admin_1");

      // v2/legacy shapes must never authorize.
      assert.equal(parseAdminSessionCookieValue("legacy.email.sig"), null);
      const tampered = value.replace(/\.[0-9a-f]+$/i, ".00deadbeef00deadbeef00deadbeef00deadbeef00deadbeef00deadbeef00dead");
      assert.equal(parseAdminSessionV3CookieValue(tampered), null);
      assert.equal(parseAdminSessionCookieValue(undefined), null);
    });
  });

  it("cookie option flags remain host-only Secure/HttpOnly/SameSite=Lax Path=/", () => {
    withEnv({ NODE_ENV: "production" }, () => {
      const options = adminSessionCookieOptions(new Date(Date.now() + ADMIN_SESSION_TTL_MS));
      assert.equal(options.httpOnly, true);
      assert.equal(options.sameSite, "lax");
      assert.equal(options.secure, true);
      assert.equal(options.path, "/");
      assert.equal(options.domain, undefined);
    });
  });
});
