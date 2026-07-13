import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPublicMarketingPath,
  publicUrl,
  resolveNavigationHref,
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
    assert.equal(isPublicMarketingPath("/gizlilik"), true);
    assert.equal(isPublicMarketingPath("/gizlilik-politikasi"), true);
    assert.equal(isPublicMarketingPath("/dashboard"), false);
    assert.equal(isPublicMarketingPath("/apps/wexpay"), false);
  });
});

describe("resolveNavigationHref", () => {
  it("routes panel paths through unified login locally", () => {
    assert.equal(resolveNavigationHref("/dashboard/billing"), "/login?next=%2Fdashboard%2Fbilling");
    assert.equal(resolveNavigationHref("/admin/organizations"), "/login?next=%2Fadmin%2Forganizations");
    assert.equal(resolveNavigationHref("/apps/wexpay/tables"), "/login?next=%2Fapps%2Fwexpay%2Ftables");
  });

  it("maps public paths through publicUrl locally", () => {
    assert.equal(resolveNavigationHref("/contact"), "/contact");
    assert.equal(resolveNavigationHref("/legal/privacy"), "/legal/privacy");
    assert.equal(resolveNavigationHref("/kvkk"), "/kvkk");
    assert.equal(resolveNavigationHref("/#pricing"), "/#pricing");
  });
});
