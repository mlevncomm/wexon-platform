import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAdminEdgeBasicAuthorized,
  isAdminEdgeProtectedSurface,
  isProductionAdminEdgeAuthEnabled,
  parseBasicAuthorizationHeader,
} from "./wexon-admin-edge-basic-auth";

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

describe("isProductionAdminEdgeAuthEnabled", () => {
  it("is enabled in production by default", () => {
    assert.equal(isProductionAdminEdgeAuthEnabled({ NODE_ENV: "production" }), true);
    assert.equal(isProductionAdminEdgeAuthEnabled({ VERCEL_ENV: "production" }), true);
  });

  it("is disabled locally and can be explicitly disabled", () => {
    assert.equal(isProductionAdminEdgeAuthEnabled({ NODE_ENV: "development" }), false);
    assert.equal(
      isProductionAdminEdgeAuthEnabled({
        NODE_ENV: "production",
        ADMIN_EDGE_BASIC_AUTH_DISABLED: "true",
      }),
      false,
    );
  });
});

describe("parseBasicAuthorizationHeader", () => {
  it("parses a valid basic authorization header", () => {
    assert.deepEqual(parseBasicAuthorizationHeader(basic("admin@wexon.dev", "secret")), {
      username: "admin@wexon.dev",
      password: "secret",
    });
  });

  it("returns null for missing or malformed headers", () => {
    assert.equal(parseBasicAuthorizationHeader(null), null);
    assert.equal(parseBasicAuthorizationHeader("Bearer token"), null);
    assert.equal(parseBasicAuthorizationHeader("Basic !!!"), null);
    assert.equal(parseBasicAuthorizationHeader(`Basic ${Buffer.from("no-separator").toString("base64")}`), null);
  });
});

describe("isAdminEdgeBasicAuthorized", () => {
  const emails = "owner@wexon.dev, admin@wexon.dev";
  const password = "Wexon-Admin-Strong";

  it("allows correct email and password", () => {
    assert.equal(isAdminEdgeBasicAuthorized(basic("owner@wexon.dev", password), emails, password), true);
  });

  it("allows the second comma-separated admin email", () => {
    assert.equal(isAdminEdgeBasicAuthorized(basic("admin@wexon.dev", password), emails, password), true);
  });

  it("rejects wrong email", () => {
    assert.equal(isAdminEdgeBasicAuthorized(basic("other@wexon.dev", password), emails, password), false);
  });

  it("rejects wrong password", () => {
    assert.equal(isAdminEdgeBasicAuthorized(basic("owner@wexon.dev", "wrong"), emails, password), false);
  });

  it("rejects missing config fail closed", () => {
    assert.equal(isAdminEdgeBasicAuthorized(basic("owner@wexon.dev", password), "", password), false);
    assert.equal(isAdminEdgeBasicAuthorized(basic("owner@wexon.dev", password), emails, ""), false);
  });
});

describe("isAdminEdgeProtectedSurface", () => {
  it("protects admin hosts", () => {
    assert.equal(isAdminEdgeProtectedSurface("admin.wexon.dev", "/login"), true);
    assert.equal(isAdminEdgeProtectedSurface("admin.example.com", "/"), true);
  });

  it("protects public /admin paths", () => {
    assert.equal(isAdminEdgeProtectedSurface("www.wexon.dev", "/admin"), true);
    assert.equal(isAdminEdgeProtectedSurface("www.wexon.dev", "/admin/settings"), true);
  });

  it("does not protect normal public paths", () => {
    assert.equal(isAdminEdgeProtectedSurface("www.wexon.dev", "/"), false);
    assert.equal(isAdminEdgeProtectedSurface("www.wexon.dev", "/login"), false);
  });
});
