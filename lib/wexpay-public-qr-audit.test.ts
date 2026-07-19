import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPublicQrAuditReference,
  hashPublicQrKey,
  inferPublicQrKeyKind,
} from "./wexpay-public-qr-audit";
import { buildPublicCheckoutRedirectUrls } from "./wexpay-public-checkout";
import { generateSecureTableQrTokenMaterial } from "./wexpay-table-qr-token";

describe("public QR audit allowlist", () => {
  it("never echoes plaintext public keys in metadata", () => {
    const material = generateSecureTableQrTokenMaterial();
    const meta = buildPublicQrAuditReference({
      publicKey: material.plaintext,
      keyKind: "opaque",
      tableId: "t1",
      tokenId: "tok1",
      tokenPrefix: material.tokenPrefix,
      kind: "menu",
    });
    const polluted = { ...meta, qrCode: material.plaintext, plaintext: material.plaintext };
    // Allowlist builder itself must not include leak keys:
    const blob = JSON.stringify(meta);
    assert.ok(!blob.includes(material.plaintext));
    assert.equal(meta.publicKeyHash, hashPublicQrKey(material.plaintext));
    assert.equal(meta.keyKind, "opaque");
    assert.equal(meta.tableId, "t1");
    assert.equal((meta as Record<string, unknown>).qrCode, undefined);
    // Polluted object is a counter-example that callers must not write:
    assert.ok(JSON.stringify(polluted).includes(material.plaintext));
  });

  it("infers legacy vs opaque kinds", () => {
    assert.equal(inferPublicQrKeyKind("WEXPAY-real-test-MASA-01"), "legacy");
    assert.equal(inferPublicQrKeyKind("WXP-abc"), "legacy");
    assert.equal(inferPublicQrKeyKind(generateSecureTableQrTokenMaterial().plaintext), "opaque");
  });
});

describe("checkout return URLs", () => {
  it("keeps legacy path and uses opaque /q path", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.wexon.dev";
    try {
      const legacy = buildPublicCheckoutRedirectUrls("/wexpay/t/WEXPAY-real-test-MASA-01", "pay1");
      assert.match(legacy.successUrl, /\/wexpay\/t\/WEXPAY-real-test-MASA-01\?paytr=success/);
      assert.match(legacy.failUrl, /\/wexpay\/t\/WEXPAY-real-test-MASA-01\?paytr=failed/);

      const opaque = buildPublicCheckoutRedirectUrls("/q/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcde", "pay2");
      assert.match(opaque.successUrl, /\/q\/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcde\?paytr=success/);
      assert.ok(!opaque.successUrl.includes("/wexpay/t/"));
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });
});
