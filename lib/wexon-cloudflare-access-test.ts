/**
 * Test-only Cloudflare Access JWT/JWKS helpers (local + CI).
 * Must never activate on Vercel production (see isCloudflareAccessTestMode).
 */

import { exportJWK, generateKeyPair, SignJWT, type JWK, type JSONWebKeySet } from "jose";
import { isCloudflareAccessTestMode, resolveCloudflareAccessConfig } from "@/lib/wexon-cloudflare-access-config";

export type CloudflareAccessTestKeyMaterial = {
  privateJwk: JWK;
  publicJwks: JSONWebKeySet;
};

export async function generateCloudflareAccessTestKeys(): Promise<CloudflareAccessTestKeyMaterial> {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  privateJwk.alg = "RS256";
  privateJwk.use = "sig";
  privateJwk.kid = privateJwk.kid ?? "wexon-cf-access-test";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  publicJwk.kid = privateJwk.kid;
  return {
    privateJwk,
    publicJwks: { keys: [publicJwk] },
  };
}

export async function mintCloudflareAccessTestJwt(input: {
  email: string;
  subject: string;
  privateJwk?: JWK;
  audience?: string;
  issuer?: string;
  expiresInSeconds?: number;
  notBeforeSeconds?: number;
  issuedAtSeconds?: number;
  algorithm?: string;
}): Promise<string> {
  if (!isCloudflareAccessTestMode()) {
    throw new Error("Cloudflare Access test JWT minting is disabled outside test mode.");
  }

  const resolved = resolveCloudflareAccessConfig();
  if (!resolved.ok && (!input.issuer || !input.audience)) {
    throw new Error("Cloudflare Access test config missing.");
  }

  const issuer = input.issuer ?? (resolved.ok ? resolved.config.issuer : "");
  const audience = input.audience ?? (resolved.ok ? resolved.config.audience : "");
  if (!issuer || !audience) {
    throw new Error("Cloudflare Access test issuer/audience missing.");
  }
  const privateJwk =
    input.privateJwk ??
    (JSON.parse((process.env.WEXON_CF_ACCESS_TEST_PRIVATE_JWK ?? "").trim() || "null") as JWK | null);

  if (!privateJwk) {
    throw new Error("WEXON_CF_ACCESS_TEST_PRIVATE_JWK is required to mint test JWTs.");
  }

  const now = Math.floor(Date.now() / 1000);
  const iat = input.issuedAtSeconds ?? now;
  const exp = iat + (input.expiresInSeconds ?? 60 * 60);
  const nbf = input.notBeforeSeconds != null ? iat + input.notBeforeSeconds : iat;

  const { importJWK } = await import("jose");
  const key = await importJWK(privateJwk, input.algorithm ?? "RS256");

  return new SignJWT({ email: input.email })
    .setProtectedHeader({
      alg: input.algorithm ?? "RS256",
      kid: typeof privateJwk.kid === "string" ? privateJwk.kid : undefined,
      typ: "JWT",
    })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(input.subject)
    .setIssuedAt(iat)
    .setNotBefore(nbf)
    .setExpirationTime(exp)
    .sign(key);
}

/** Build env map fragment for isolated E2E / unit tests (never for Vercel production). */
export function cloudflareAccessTestEnvFragment(material: CloudflareAccessTestKeyMaterial, input?: {
  teamDomain?: string;
  audience?: string;
}) {
  const teamDomain = input?.teamDomain ?? "wexon-cf-access-test.example.invalid";
  const audience = input?.audience ?? "wexon-admin-test-aud";
  return {
    WEXON_CF_ACCESS_TEST_MODE: "1",
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: teamDomain,
    CLOUDFLARE_ACCESS_AUD: audience,
    WEXON_CF_ACCESS_TEST_PRIVATE_JWK: JSON.stringify(material.privateJwk),
    WEXON_CF_ACCESS_TEST_PUBLIC_JWKS: JSON.stringify(material.publicJwks),
  } as const;
}
