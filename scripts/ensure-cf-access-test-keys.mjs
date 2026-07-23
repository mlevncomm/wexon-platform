#!/usr/bin/env node
/**
 * Ensure local/CI Cloudflare Access test key material exists.
 * Never run / never load on Vercel production.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { exportJWK, generateKeyPair } from "jose";

const cachePath = resolve(process.cwd(), "e2e", ".cf-access-test-keys.json");

function assertNotHostedProduction() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to mint Cloudflare Access test keys on Vercel production.");
  }
}

async function generateMaterial() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  privateJwk.alg = "RS256";
  privateJwk.use = "sig";
  privateJwk.kid = "wexon-cf-access-test";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  publicJwk.kid = "wexon-cf-access-test";
  return {
    teamDomain: "wexon-cf-access-test.example.invalid",
    audience: "wexon-admin-test-aud",
    privateJwk,
    publicJwks: { keys: [publicJwk] },
  };
}

async function main() {
  assertNotHostedProduction();

  let material;
  if (existsSync(cachePath)) {
    material = JSON.parse(readFileSync(cachePath, "utf8"));
  } else {
    material = await generateMaterial();
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(material, null, 2), "utf8");
  }

  const env = {
    WEXON_CF_ACCESS_TEST_MODE: "1",
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: material.teamDomain,
    CLOUDFLARE_ACCESS_AUD: material.audience,
    WEXON_CF_ACCESS_TEST_PRIVATE_JWK: JSON.stringify(material.privateJwk),
    WEXON_CF_ACCESS_TEST_PUBLIC_JWKS: JSON.stringify(material.publicJwks),
  };

  // Print JSON for playwright.config / orchestrators to merge into process.env.
  process.stdout.write(JSON.stringify(env));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
