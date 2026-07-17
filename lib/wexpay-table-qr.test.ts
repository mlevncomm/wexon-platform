import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafeTableQrSvg,
  buildTableQrFilenames,
  escapeHtml,
  generateTableQrSvg,
  sanitizeTableQrSvg,
} from "@/lib/wexpay-table-qr";

describe("wexpay table QR generation", () => {
  it("produces distinct SVG payloads for different URLs", async () => {
    const a = await generateTableQrSvg("https://app.wexon.dev/wexpay/t/A");
    const b = await generateTableQrSvg("https://app.wexon.dev/wexpay/t/B");
    assert.notEqual(a, b);
    assert.ok(a.includes("<svg"));
    assert.ok(b.includes("<svg"));
  });

  it("returns valid SVG without script or external refs", async () => {
    const svg = await generateTableQrSvg("https://app.wexon.dev/wexpay/t/WEXPAY-real-test-MASA-01");
    assertSafeTableQrSvg(svg);
    assert.ok(!/<script/i.test(svg));
    assert.ok(!/\shref=["']https?:/i.test(svg));
    assert.ok(!svg.toLowerCase().includes("organizationid"));
    assert.ok(!svg.toLowerCase().includes("tableid"));
  });

  it("sanitize strips script tags", () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>`;
    const clean = sanitizeTableQrSvg(dirty);
    assert.ok(!/<script/i.test(clean));
    assertSafeTableQrSvg(clean);
  });

  it("builds safe download filenames", () => {
    assert.deepEqual(buildTableQrFilenames("Masa 01"), {
      png: "wexpay-masa-01-qr.png",
      svg: "wexpay-masa-01-qr.svg",
    });
  });

  it("escapes HTML for print template", () => {
    assert.equal(escapeHtml(`<"x"&'>`), `&lt;&quot;x&quot;&amp;&#39;&gt;`);
  });
});
