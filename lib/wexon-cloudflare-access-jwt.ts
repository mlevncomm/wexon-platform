/**
 * Cloudflare Access JWT verification (PR2B).
 *
 * Verifies Cf-Access-Jwt-Assertion with jose (JWKS signature, issuer, audience, exp, nbf).
 * Never trusts Cf-Access-Authenticated-User-Email alone.
 * Never logs raw JWT, subject, or full email.
 */

import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors as JoseErrors,
  jwtVerify,
  type JWTPayload,
  type JSONWebKeySet,
} from "jose";
import {
  ADMIN_ACCESS_GENERIC_CONFIG,
  ADMIN_ACCESS_GENERIC_DENIED,
  CF_ACCESS_EMAIL_HEADER,
  CF_ACCESS_JWT_HEADER,
  isCloudflareAccessTestMode,
  resolveCloudflareAccessConfig,
  type CloudflareAccessConfig,
} from "@/lib/wexon-cloudflare-access-config";
import { maskPlatformAdminEmail, normalizePlatformAdminEmail } from "@/lib/wexon-platform-admin";

export {
  ADMIN_ACCESS_GENERIC_CONFIG,
  ADMIN_ACCESS_GENERIC_DENIED,
  CF_ACCESS_EMAIL_HEADER,
  CF_ACCESS_JWT_HEADER,
  isCloudflareAccessTestMode,
  resolveCloudflareAccessConfig,
};

export type VerifiedCloudflareAccessIdentity = {
  email: string;
  emailNormalized: string;
  subject: string;
  expiresAt: number;
};

export class CloudflareAccessJwtError extends Error {
  readonly code:
    | "missing_config"
    | "missing_token"
    | "invalid_token"
    | "expired"
    | "not_yet_valid"
    | "wrong_issuer"
    | "wrong_audience"
    | "bad_signature"
    | "alg_rejected"
    | "jwks_error"
    | "missing_claims";

  constructor(code: CloudflareAccessJwtError["code"], message = ADMIN_ACCESS_GENERIC_DENIED) {
    super(message);
    this.name = "CloudflareAccessJwtError";
    this.code = code;
  }
}

type JwksResolver = (config: CloudflareAccessConfig) => Promise<ReturnType<typeof createRemoteJWKSet> | ReturnType<typeof createLocalJWKSet>>;

/** Process-local remote JWKS cache (jose caches keys; we cache the resolver). */
const remoteJwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
let testJwks: ReturnType<typeof createLocalJWKSet> | null = null;
let testJwksFingerprint: string | null = null;

function readTestPublicJwks(): JSONWebKeySet | null {
  const raw = (process.env.WEXON_CF_ACCESS_TEST_PUBLIC_JWKS ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as JSONWebKeySet;
    if (!parsed || !Array.isArray(parsed.keys)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function defaultJwksResolver(config: CloudflareAccessConfig) {
  if (isCloudflareAccessTestMode()) {
    const jwks = readTestPublicJwks();
    if (!jwks) {
      throw new CloudflareAccessJwtError("jwks_error", ADMIN_ACCESS_GENERIC_CONFIG);
    }
    const fingerprint = JSON.stringify(jwks);
    if (!testJwks || testJwksFingerprint !== fingerprint) {
      testJwks = createLocalJWKSet(jwks);
      testJwksFingerprint = fingerprint;
    }
    return testJwks;
  }

  const cached = remoteJwksByIssuer.get(config.issuer);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(config.jwksUrl);
  remoteJwksByIssuer.set(config.issuer, jwks);
  return jwks;
}

let jwksResolver: JwksResolver = defaultJwksResolver;

/** Test-only: swap JWKS resolver (unit tests). */
export function setCloudflareAccessJwksResolverForTests(resolver: JwksResolver | null) {
  jwksResolver = resolver ?? defaultJwksResolver;
  if (!resolver) {
    remoteJwksByIssuer.clear();
    testJwks = null;
    testJwksFingerprint = null;
  }
}

function readJwtFromHeaders(headerStore: Headers | { get(name: string): string | null }) {
  const raw =
    headerStore.get(CF_ACCESS_JWT_HEADER) ??
    headerStore.get("Cf-Access-Jwt-Assertion") ??
    headerStore.get("CF-Access-JWT-Assertion");
  return typeof raw === "string" ? raw.trim() : "";
}

function mapJoseError(error: unknown): CloudflareAccessJwtError {
  if (error instanceof CloudflareAccessJwtError) return error;
  if (error instanceof JoseErrors.JWTExpired) {
    return new CloudflareAccessJwtError("expired");
  }
  if (error instanceof JoseErrors.JWTClaimValidationFailed) {
    const claim = (error as { claim?: string; reason?: string }).claim;
    const reason = (error as { reason?: string }).reason ?? "";
    if (claim === "nbf" || /nbf|not.yet/i.test(reason)) {
      return new CloudflareAccessJwtError("not_yet_valid");
    }
    if (claim === "iss" || /issuer/i.test(reason)) {
      return new CloudflareAccessJwtError("wrong_issuer");
    }
    if (claim === "aud" || /audience/i.test(reason)) {
      return new CloudflareAccessJwtError("wrong_audience");
    }
    return new CloudflareAccessJwtError("invalid_token");
  }
  if (error instanceof JoseErrors.JWSSignatureVerificationFailed) {
    return new CloudflareAccessJwtError("bad_signature");
  }
  if (error instanceof JoseErrors.JOSEAlgNotAllowed || error instanceof JoseErrors.JOSENotSupported) {
    return new CloudflareAccessJwtError("alg_rejected");
  }
  if (error instanceof JoseErrors.JWKSNoMatchingKey || error instanceof JoseErrors.JWKSInvalid) {
    return new CloudflareAccessJwtError("jwks_error");
  }
  return new CloudflareAccessJwtError("invalid_token");
}

function extractIdentity(payload: JWTPayload): VerifiedCloudflareAccessIdentity {
  const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const emailRaw =
    typeof payload.email === "string"
      ? payload.email
      : typeof (payload as { preferred_username?: unknown }).preferred_username === "string"
        ? String((payload as { preferred_username: string }).preferred_username)
        : "";
  const emailNormalized = normalizePlatformAdminEmail(emailRaw);
  if (!subject || !emailNormalized || !emailNormalized.includes("@")) {
    throw new CloudflareAccessJwtError("missing_claims");
  }

  const expiresAt =
    typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : 0;
  if (!expiresAt) {
    throw new CloudflareAccessJwtError("missing_claims");
  }

  return {
    email: emailRaw.trim(),
    emailNormalized,
    subject,
    expiresAt,
  };
}

/**
 * Verify Cloudflare Access JWT from request headers.
 * Fail-closed on missing config / token / JWKS / claim errors.
 */
export async function verifyCloudflareAccessJwtFromHeaders(
  headerStore: Headers | { get(name: string): string | null },
): Promise<VerifiedCloudflareAccessIdentity> {
  const resolved = resolveCloudflareAccessConfig();
  if (!resolved.ok) {
    throw new CloudflareAccessJwtError(
      resolved.reason === "missing_config" ? "missing_config" : "missing_config",
      ADMIN_ACCESS_GENERIC_CONFIG,
    );
  }

  const token = readJwtFromHeaders(headerStore);
  if (!token) {
    throw new CloudflareAccessJwtError("missing_token");
  }

  // Accept RS256 only — reject RS384/RS512/ES* / none before jose.
  const headerPart = token.split(".")[0] ?? "";
  try {
    const headerJson = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as {
      alg?: string;
    };
    if (!headerJson.alg || headerJson.alg !== "RS256") {
      throw new CloudflareAccessJwtError("alg_rejected");
    }
  } catch (error) {
    if (error instanceof CloudflareAccessJwtError) throw error;
    throw new CloudflareAccessJwtError("invalid_token");
  }

  try {
    const jwks = await jwksResolver(resolved.config);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: resolved.config.issuer,
      audience: resolved.config.audience,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });
    return extractIdentity(payload);
  } catch (error) {
    throw mapJoseError(error);
  }
}

/** Sanitize audit/debug metadata — never include JWT, subject, or full email. */
export function cloudflareAccessAuditSafeMeta(input: {
  reason?: string;
  emailNormalized?: string;
  hasToken?: boolean;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.reason) out.reason = input.reason;
  if (input.hasToken != null) out.hasToken = input.hasToken;
  if (input.emailNormalized) {
    out.emailMasked = maskPlatformAdminEmail(input.emailNormalized);
  }
  return out;
}

/** Explicitly document that the email spoof header must be ignored for auth. */
export function mustIgnoreCloudflareEmailHeaderAlone(): true {
  void CF_ACCESS_EMAIL_HEADER;
  return true;
}
