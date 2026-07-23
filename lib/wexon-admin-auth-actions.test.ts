import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Deterministic hard-deny evidence for the deprecated shared-password Server Action.
 * Source-contract test (no Next/Prisma runtime): loginAdminAction must never consult
 * shared password / allowlist envs and must redirect with the generic deny.
 */
describe("loginAdminAction shared-password hard deny", () => {
  const sourcePath = fileURLToPath(new URL("./wexon-admin-auth-actions.ts", import.meta.url));
  const source = readFileSync(sourcePath, "utf8");

  function loginAdminActionSource() {
    const start = source.indexOf("export async function loginAdminAction");
    assert.ok(start >= 0, "loginAdminAction must exist");
    const nextExport = source.indexOf("\nexport async function", start + 1);
    const end = nextExport >= 0 ? nextExport : source.length;
    return source.slice(start, end);
  }

  it("hard-denies without consulting ADMIN_LOGIN_PASSWORD or ADMIN_EMAILS", () => {
    const body = loginAdminActionSource();
    assert.match(body, /shared_password_removed/);
    assert.match(body, /admin\.auth\.login_failed/);
    assert.match(body, /redirect\(/);
    assert.match(body, /ADMIN_LOGIN_GENERIC_ERROR/);
    assert.doesNotMatch(body, /ADMIN_LOGIN_PASSWORD/);
    assert.doesNotMatch(body, /ADMIN_EMAILS/);
    assert.doesNotMatch(body, /securePasswordEqual/);
    assert.doesNotMatch(body, /isAdminEmailAllowed/);
    assert.doesNotMatch(body, /establishAdminSession/);
    assert.doesNotMatch(body, /setAdminSession/);
    // Form credentials must be ignored (void), never read for auth.
    assert.match(body, /void formData/);
  });
});
