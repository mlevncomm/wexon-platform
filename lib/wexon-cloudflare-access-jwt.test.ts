import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  CF_ACCESS_JWT_HEADER,
  cloudflareAccessAuditSafeMeta,
  isCloudflareAccessTestMode,
  mustIgnoreCloudflareEmailHeaderAlone,
  resolveCloudflareAccessConfig,
  setCloudflareAccessJwksResolverForTests,
  verifyCloudflareAccessJwtFromHeaders,
  CloudflareAccessJwtError,
} from "./wexon-cloudflare-access-jwt";
import {
  cloudflareAccessTestEnvFragment,
  generateCloudflareAccessTestKeys,
  mintCloudflareAccessTestJwt,
} from "./wexon-cloudflare-access-test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";

function withEnv(snapshot: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(snapshot)) {
    previous.set(key, process.env[key]);
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(() => fn())
    .finally(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

describe("Cloudflare Access JWT verification", () => {
  let material: Awaited<ReturnType<typeof generateCloudflareAccessTestKeys>>;
  let baseEnv: Record<string, string>;

  before(async () => {
    material = await generateCloudflareAccessTestKeys();
    baseEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: undefined as unknown as string,
      ...cloudflareAccessTestEnvFragment(material),
    };
    delete (baseEnv as { VERCEL_ENV?: string }).VERCEL_ENV;
  });

  after(() => {
    setCloudflareAccessJwksResolverForTests(null);
  });

  it("accepts a valid RS256 JWT with issuer/audience/exp/nbf", async () => {
    await withEnv(baseEnv, async () => {
      setCloudflareAccessJwksResolverForTests(async () => createLocalJWKSet(material.publicJwks));
      const token = await mintCloudflareAccessTestJwt({
        email: "Ops@Wexon.dev",
        subject: "cf-sub-1",
        privateJwk: material.privateJwk,
      });
      const headers = new Headers({ [CF_ACCESS_JWT_HEADER]: token });
      const identity = await verifyCloudflareAccessJwtFromHeaders(headers);
      assert.equal(identity.emailNormalized, "ops@wexon.dev");
      assert.equal(identity.subject, "cf-sub-1");
    });
  });

  it("rejects RS512 signed tokens (RS256 only)", async () => {
    await withEnv(baseEnv, async () => {
      const { privateKey, publicKey } = await generateKeyPair("RS512", { extractable: true });
      const privateJwk = await exportJWK(privateKey);
      const publicJwk = await exportJWK(publicKey);
      privateJwk.alg = "RS512";
      privateJwk.kid = "rs512-test";
      publicJwk.alg = "RS512";
      publicJwk.kid = "rs512-test";
      setCloudflareAccessJwksResolverForTests(async () => createLocalJWKSet({ keys: [publicJwk] }));

      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({ email: "ops@wexon.dev" })
        .setProtectedHeader({ alg: "RS512", kid: "rs512-test", typ: "JWT" })
        .setIssuer(`https://${baseEnv.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`)
        .setAudience(baseEnv.CLOUDFLARE_ACCESS_AUD)
        .setSubject("cf-sub-rs512")
        .setIssuedAt(now)
        .setNotBefore(now)
        .setExpirationTime(now + 3600)
        .sign(privateKey);

      await assert.rejects(
        () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: token })),
        (error: unknown) => error instanceof CloudflareAccessJwtError && error.code === "alg_rejected",
      );
    });
  });

  it("rejects ES256 signed tokens (RS256 only)", async () => {
    await withEnv(baseEnv, async () => {
      const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
      const privateJwk = await exportJWK(privateKey);
      const publicJwk = await exportJWK(publicKey);
      privateJwk.alg = "ES256";
      privateJwk.kid = "es256-test";
      publicJwk.alg = "ES256";
      publicJwk.kid = "es256-test";
      setCloudflareAccessJwksResolverForTests(async () => createLocalJWKSet({ keys: [publicJwk] }));

      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({ email: "ops@wexon.dev" })
        .setProtectedHeader({ alg: "ES256", kid: "es256-test", typ: "JWT" })
        .setIssuer(`https://${baseEnv.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`)
        .setAudience(baseEnv.CLOUDFLARE_ACCESS_AUD)
        .setSubject("cf-sub-es256")
        .setIssuedAt(now)
        .setNotBefore(now)
        .setExpirationTime(now + 3600)
        .sign(privateKey);

      await assert.rejects(
        () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: token })),
        (error: unknown) => error instanceof CloudflareAccessJwtError && error.code === "alg_rejected",
      );
    });
  });

  it("rejects Cloudflare Access test mode on Vercel preview", async () => {
    await withEnv(
      {
        ...baseEnv,
        NODE_ENV: "development",
        VERCEL_ENV: "preview",
        WEXON_CF_ACCESS_TEST_MODE: "1",
      },
      () => {
        assert.equal(isCloudflareAccessTestMode(), false);
      },
    );
  });

  it("rejects Cloudflare Access test mode on Vercel production", async () => {
    await withEnv(
      {
        ...baseEnv,
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        WEXON_CF_ACCESS_TEST_MODE: "1",
      },
      () => {
        assert.equal(isCloudflareAccessTestMode(), false);
      },
    );
  });

  it("rejects fake/non-Cloudflare team domain in production", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        WEXON_CF_ACCESS_TEST_MODE: undefined,
        CLOUDFLARE_ACCESS_TEAM_DOMAIN: "evil.example.com",
        CLOUDFLARE_ACCESS_AUD: "aud",
        WEXON_CF_ACCESS_TEST_PUBLIC_JWKS: undefined,
      },
      () => {
        assert.equal(isCloudflareAccessTestMode(), false);
        const resolved = resolveCloudflareAccessConfig();
        assert.equal(resolved.ok, false);
        if (!resolved.ok) assert.equal(resolved.reason, "invalid_team_domain");
      },
    );
  });

  it("rejects expired tokens", async () => {
    await withEnv(baseEnv, async () => {
      setCloudflareAccessJwksResolverForTests(async () => createLocalJWKSet(material.publicJwks));
      const token = await mintCloudflareAccessTestJwt({
        email: "ops@wexon.dev",
        subject: "cf-sub-1",
        privateJwk: material.privateJwk,
        issuedAtSeconds: Math.floor(Date.now() / 1000) - 3600,
        expiresInSeconds: -10,
      });
      await assert.rejects(
        () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: token })),
        (error: unknown) => error instanceof CloudflareAccessJwtError && error.code === "expired",
      );
    });
  });

  it("rejects nbf in the future", async () => {
    await withEnv(baseEnv, async () => {
      setCloudflareAccessJwksResolverForTests(async () => createLocalJWKSet(material.publicJwks));
      const token = await mintCloudflareAccessTestJwt({
        email: "ops@wexon.dev",
        subject: "cf-sub-1",
        privateJwk: material.privateJwk,
        notBeforeSeconds: 3600,
      });
      await assert.rejects(
        () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: token })),
        (error: unknown) =>
          error instanceof CloudflareAccessJwtError &&
          (error.code === "not_yet_valid" || error.code === "invalid_token"),
      );
    });
  });

  it("rejects wrong issuer", async () => {
    await withEnv(baseEnv, async () => {
      setCloudflareAccessJwksResolverForTests(async () => createLocalJWKSet(material.publicJwks));
      const token = await mintCloudflareAccessTestJwt({
        email: "ops@wexon.dev",
        subject: "cf-sub-1",
        privateJwk: material.privateJwk,
        issuer: "https://evil.example.invalid",
      });
      await assert.rejects(
        () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: token })),
        (error: unknown) =>
          error instanceof CloudflareAccessJwtError &&
          (error.code === "wrong_issuer" || error.code === "invalid_token"),
      );
    });
  });

  it("rejects wrong audience", async () => {
    await withEnv(baseEnv, async () => {
      setCloudflareAccessJwksResolverForTests(async () => createLocalJWKSet(material.publicJwks));
      const token = await mintCloudflareAccessTestJwt({
        email: "ops@wexon.dev",
        subject: "cf-sub-1",
        privateJwk: material.privateJwk,
        audience: "wrong-aud",
      });
      await assert.rejects(
        () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: token })),
        (error: unknown) =>
          error instanceof CloudflareAccessJwtError &&
          (error.code === "wrong_audience" || error.code === "invalid_token"),
      );
    });
  });

  it("rejects bad signatures", async () => {
    await withEnv(baseEnv, async () => {
      setCloudflareAccessJwksResolverForTests(async () => createLocalJWKSet(material.publicJwks));
      const other = await generateCloudflareAccessTestKeys();
      const token = await mintCloudflareAccessTestJwt({
        email: "ops@wexon.dev",
        subject: "cf-sub-1",
        privateJwk: other.privateJwk,
      });
      await assert.rejects(
        () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: token })),
        (error: unknown) =>
          error instanceof CloudflareAccessJwtError &&
          (error.code === "bad_signature" || error.code === "jwks_error" || error.code === "invalid_token"),
      );
    });
  });

  it("rejects alg=none bypass payloads", async () => {
    await withEnv(baseEnv, async () => {
      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          email: "ops@wexon.dev",
          sub: "cf-sub-1",
          iss: `https://${baseEnv.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`,
          aud: baseEnv.CLOUDFLARE_ACCESS_AUD,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url");
      const token = `${header}.${payload}.`;
      await assert.rejects(
        () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: token })),
        (error: unknown) => error instanceof CloudflareAccessJwtError && error.code === "alg_rejected",
      );
    });
  });

  it("does not authorize from spoof email header alone", async () => {
    await withEnv(baseEnv, async () => {
      assert.equal(mustIgnoreCloudflareEmailHeaderAlone(), true);
      await assert.rejects(
        () =>
          verifyCloudflareAccessJwtFromHeaders(
            new Headers({ "cf-access-authenticated-user-email": "ops@wexon.dev" }),
          ),
        (error: unknown) => error instanceof CloudflareAccessJwtError && error.code === "missing_token",
      );
    });
  });

  it("fails closed on missing runtime config", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        CLOUDFLARE_ACCESS_TEAM_DOMAIN: undefined,
        CLOUDFLARE_ACCESS_AUD: undefined,
        WEXON_CF_ACCESS_TEST_MODE: "1",
      },
      async () => {
        await assert.rejects(
          () => verifyCloudflareAccessJwtFromHeaders(new Headers({ [CF_ACCESS_JWT_HEADER]: "x.y.z" })),
          (error: unknown) => error instanceof CloudflareAccessJwtError && error.code === "missing_config",
        );
      },
    );
  });

  it("audit helper never includes raw email/jwt/subject", () => {
    const meta = cloudflareAccessAuditSafeMeta({
      reason: "denied",
      emailNormalized: "ops@wexon.dev",
      hasToken: true,
    });
    assert.equal(meta.emailMasked, "o***@wexon.dev");
    assert.equal("email" in meta, false);
    assert.equal("jwt" in meta, false);
    assert.equal("subject" in meta, false);
    assert.equal("cloudflareSubject" in meta, false);
  });

  it("generic error messages stay Turkish and non-technical", () => {
    const err = new CloudflareAccessJwtError("bad_signature");
    assert.match(err.message, /erişim reddedildi/i);
    assert.doesNotMatch(err.message, /jwt|jwks|signature|issuer|audience|ADMIN_/i);
  });
});
