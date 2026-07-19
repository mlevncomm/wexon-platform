import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOpaquePublicQrPath,
  buildPublicTableQrPath,
  buildPublicTableQrUrl,
  buildTableQrDownloadBasename,
  toQrFilenameSlug,
  WexPayPublicTableUrlError,
} from "@/lib/wexpay-public-table-url";

describe("buildPublicTableQrPath", () => {
  it("encodes qrCode and never embeds tenant ids", () => {
    const path = buildPublicTableQrPath("WEXPAY-real-test-MASA-01");
    assert.equal(path, "/wexpay/t/WEXPAY-real-test-MASA-01");
    assert.ok(!path.includes("organizationId"));
    assert.ok(!path.includes("branchId"));
    assert.ok(!path.includes("tableId"));
  });

  it("encodes special characters in qrCode", () => {
    assert.equal(buildPublicTableQrPath("WXP space"), "/wexpay/t/WXP%20space");
  });

  it("rejects empty or path-like codes", () => {
    assert.throws(() => buildPublicTableQrPath(""), WexPayPublicTableUrlError);
    assert.throws(() => buildPublicTableQrPath("../evil"), WexPayPublicTableUrlError);
    assert.throws(() => buildPublicTableQrPath("a/b"), WexPayPublicTableUrlError);
  });
});

describe("buildOpaquePublicQrPath", () => {
  it("builds /q/{token} without tenant ids", () => {
    const path = buildOpaquePublicQrPath("AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_");
    assert.equal(path, "/q/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_");
    assert.ok(!path.includes("organizationId"));
  });
});

describe("buildPublicTableQrUrl", () => {
  it("trims trailing slashes from NEXT_PUBLIC_APP_URL", () => {
    const url = buildPublicTableQrUrl("ABC-01", {
      NEXT_PUBLIC_APP_URL: "https://app.wexon.dev///",
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);
    assert.equal(url, "https://app.wexon.dev/wexpay/t/ABC-01");
  });

  it("rejects missing app URL", () => {
    assert.throws(
      () => buildPublicTableQrUrl("ABC-01", { NODE_ENV: "development" } as NodeJS.ProcessEnv),
      WexPayPublicTableUrlError,
    );
  });

  it("rejects localhost app URL on confirmed production", () => {
    assert.throws(
      () =>
        buildPublicTableQrUrl("ABC-01", {
          NEXT_PUBLIC_APP_URL: "http://localhost:3000",
          NODE_ENV: "production",
          VERCEL_ENV: "production",
        } as NodeJS.ProcessEnv),
      /https|localhost/i,
    );
    assert.throws(
      () =>
        buildPublicTableQrUrl("ABC-01", {
          NEXT_PUBLIC_APP_URL: "https://localhost:3000",
          NODE_ENV: "production",
          WEXON_E2E_CONFIRM_PRODUCTION: "true",
        } as NodeJS.ProcessEnv),
      /localhost/i,
    );
  });

  it("allows localhost with next start (NODE_ENV=production) for local E2E", () => {
    const url = buildPublicTableQrUrl("ABC-01", {
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    assert.equal(url, "http://localhost:3100/wexpay/t/ABC-01");
  });

  it("rejects non-https wexon.dev app URL", () => {
    assert.throws(
      () =>
        buildPublicTableQrUrl("ABC-01", {
          NEXT_PUBLIC_APP_URL: "http://app.wexon.dev",
          NODE_ENV: "production",
        } as NodeJS.ProcessEnv),
      /https/i,
    );
  });
});

describe("filename helpers", () => {
  it("normalizes labels for download basenames", () => {
    assert.equal(toQrFilenameSlug("Masa 01"), "masa-01");
    assert.equal(buildTableQrDownloadBasename("Masa 01"), "wexpay-masa-01-qr");
    assert.equal(buildTableQrDownloadBasename("@@@"), "wexpay-masa-qr");
  });
});
