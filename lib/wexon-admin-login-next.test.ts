import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultAdminPostLoginPath, safeAdminNextPath } from "./wexon-admin-login-next";
import { resolvePostLoginDestination, safeNextPath } from "./wexon-canonical-host";

describe("defaultAdminPostLoginPath", () => {
  it("uses / in production and /admin locally", () => {
    assert.equal(defaultAdminPostLoginPath(true), "/");
    assert.equal(defaultAdminPostLoginPath(false), "/admin");
  });
});

describe("safeAdminNextPath", () => {
  it("/login with no next falls back to admin root", () => {
    assert.equal(safeAdminNextPath("", true), "/");
    assert.equal(safeAdminNextPath("   ", true), "/");
    assert.equal(safeAdminNextPath("", false), "/admin");
  });

  it("preserves safe next=/applications", () => {
    assert.equal(safeAdminNextPath("/applications", true), "/applications");
    assert.equal(safeAdminNextPath("/applications", false), "/admin/applications");
    assert.equal(safeAdminNextPath("/admin/applications", false), "/admin/applications");
  });

  it("logout-style revisit without next does not carry /applications", () => {
    // Direct login after logout has empty next — must not sticky-default to applications.
    assert.equal(safeAdminNextPath("", true), "/");
    assert.notEqual(safeAdminNextPath("", true), "/applications");
  });

  it("rejects external, protocol-relative, and encoded open redirects", () => {
    assert.equal(safeAdminNextPath("https://evil.example", true), "/");
    assert.equal(safeAdminNextPath("//evil.example", true), "/");
    assert.equal(safeAdminNextPath("/%2f%2fevil.example", true), "/");
    assert.equal(safeAdminNextPath("/\\evil.example", true), "/");
    assert.equal(safeAdminNextPath("https://www.wexon.dev/", true), "/");
    assert.equal(safeAdminNextPath("https://core.wexon.dev/dashboard", true), "/");
  });

  it("rejects cross-surface next values", () => {
    assert.equal(safeAdminNextPath("/apps/wexpay", true), "/");
    assert.equal(safeAdminNextPath("/dashboard", true), "/");
    assert.equal(safeAdminNextPath("/dashboard/billing", true), "/");
  });

  it("maps login paths to root to avoid redirect loops", () => {
    assert.equal(safeAdminNextPath("/login", true), "/");
    assert.equal(safeAdminNextPath("/login?x=1", true), "/");
    assert.equal(safeAdminNextPath("/admin/login", true), "/");
    assert.equal(safeAdminNextPath("/admin/login", false), "/admin");
  });

  it("composes to post-login destinations without loops", () => {
    assert.equal(
      resolvePostLoginDestination(safeAdminNextPath("", true), { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/",
    );
    assert.equal(
      resolvePostLoginDestination(safeAdminNextPath("/applications", true), {
        isAdmin: true,
        productionWexon: true,
      }),
      "https://admin.wexon.dev/applications",
    );
    assert.equal(
      resolvePostLoginDestination(safeAdminNextPath("/login", true), { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/",
    );
    assert.equal(
      resolvePostLoginDestination(safeAdminNextPath("//evil", true), { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/",
    );
  });
});

describe("safeNextPath encoded open redirect hardening", () => {
  it("rejects encoded protocol-relative paths", () => {
    assert.equal(safeNextPath("/%2f%2fevil.example", "/"), "/");
    assert.equal(safeNextPath("/%2F%2Fevil.example", "/fallback"), "/fallback");
  });

  it("keeps legitimate relative paths", () => {
    assert.equal(safeNextPath("/applications", "/"), "/applications");
    assert.equal(safeNextPath("/organizations?tab=1", "/"), "/organizations?tab=1");
  });
});
