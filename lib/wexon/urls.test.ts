import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPublicMarketingPath,
  publicUrl,
  resolveNavigationHref,
  shouldDisableLinkPrefetch,
  unifiedLoginUrl,
} from "./urls";

describe("publicUrl", () => {
  it("returns relative paths in local development", () => {
    assert.equal(publicUrl("/contact"), "/contact");
    assert.equal(publicUrl("legal/cookies"), "/legal/cookies");
  });
});

describe("unifiedLoginUrl", () => {
  it("returns local login path without next", () => {
    assert.equal(unifiedLoginUrl(), "/login");
  });

  it("appends next query in local development", () => {
    assert.equal(unifiedLoginUrl("/dashboard"), "/login?next=%2Fdashboard");
  });
});

describe("isPublicMarketingPath", () => {
  it("matches legal and contact routes", () => {
    assert.equal(isPublicMarketingPath("/legal/cookies"), true);
    assert.equal(isPublicMarketingPath("/contact"), true);
    assert.equal(isPublicMarketingPath("/iletisim"), true);
    assert.equal(isPublicMarketingPath("/kvkk"), true);
    assert.equal(isPublicMarketingPath("/gizlilik-politikasi"), true);
    assert.equal(isPublicMarketingPath("/dashboard"), false);
    assert.equal(isPublicMarketingPath("/apps/wexpay"), false);
  });
});

describe("resolveNavigationHref", () => {
  it("keeps panel paths relative locally", () => {
    assert.equal(resolveNavigationHref("/dashboard/billing"), "/dashboard/billing");
    assert.equal(resolveNavigationHref("/admin/organizations"), "/admin/organizations");
  });

  it("maps public paths through publicUrl locally", () => {
    assert.equal(resolveNavigationHref("/contact"), "/contact");
    assert.equal(resolveNavigationHref("/legal/privacy"), "/legal/privacy");
    assert.equal(resolveNavigationHref("/kvkk"), "/kvkk");
    assert.equal(resolveNavigationHref("/#pricing"), "/#pricing");
  });
});

describe("shouldDisableLinkPrefetch", () => {
  it("disables prefetch for protected panel routes", () => {
    assert.equal(shouldDisableLinkPrefetch("/admin"), true);
    assert.equal(shouldDisableLinkPrefetch("/admin/login"), true);
    assert.equal(shouldDisableLinkPrefetch("/dashboard"), true);
    assert.equal(shouldDisableLinkPrefetch("/dashboard/login"), true);
    assert.equal(shouldDisableLinkPrefetch("/apps/wexpay"), true);
    assert.equal(shouldDisableLinkPrefetch("https://admin.wexon.dev/login"), true);
  });

  it("allows prefetch for public marketing routes", () => {
    assert.equal(shouldDisableLinkPrefetch("/"), false);
    assert.equal(shouldDisableLinkPrefetch("/products/wexpay"), false);
    assert.equal(shouldDisableLinkPrefetch("/demo-request"), false);
    assert.equal(shouldDisableLinkPrefetch("/login"), false);
  });
});
