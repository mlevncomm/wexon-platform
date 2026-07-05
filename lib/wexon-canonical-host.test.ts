import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductionSubdomainUrl,
  isAdminHost,
  isMaintenanceExemptRoute,
  publicPanelCanonicalTarget,
  resolvePostLoginDestination,
  subdomainPrefixedCanonicalPath,
} from "./wexon-canonical-host";

describe("publicPanelCanonicalTarget", () => {
  it("redirects public /admin to admin host", () => {
    const target = publicPanelCanonicalTarget("www.wexon.dev", "/admin");
    assert.deepEqual(target, { kind: "subdomain", subdomain: "admin", pathname: "/" });
    assert.equal(buildProductionSubdomainUrl("admin", "/"), "https://admin.wexon.dev/");
  });

  it("redirects public /admin/organizations to admin host path", () => {
    const target = publicPanelCanonicalTarget("wexon.dev", "/admin/organizations");
    assert.deepEqual(target, { kind: "subdomain", subdomain: "admin", pathname: "/organizations" });
  });

  it("redirects public /admin/login to admin host login", () => {
    const target = publicPanelCanonicalTarget("www.wexon.dev", "/admin/login");
    assert.deepEqual(target, { kind: "subdomain", subdomain: "admin", pathname: "/login" });
    assert.equal(buildProductionSubdomainUrl("admin", "/login"), "https://admin.wexon.dev/login");
  });

  it("redirects public /dashboard to core host", () => {
    const target = publicPanelCanonicalTarget("www.wexon.dev", "/dashboard");
    assert.deepEqual(target, { kind: "subdomain", subdomain: "core", pathname: "/" });
  });

  it("redirects public /apps/wexpay to app host", () => {
    const target = publicPanelCanonicalTarget("www.wexon.dev", "/apps/wexpay/tables");
    assert.deepEqual(target, { kind: "subdomain", subdomain: "app", pathname: "/tables" });
  });

  it("does not redirect public /login", () => {
    assert.equal(publicPanelCanonicalTarget("www.wexon.dev", "/login"), null);
  });

  it("redirects public /dashboard/login to unified login", () => {
    assert.deepEqual(publicPanelCanonicalTarget("www.wexon.dev", "/dashboard/login"), { kind: "unified-login" });
  });
});

describe("subdomainPrefixedCanonicalPath", () => {
  it("redirects admin host /admin to /", () => {
    assert.equal(subdomainPrefixedCanonicalPath("admin", "/admin"), "/");
  });

  it("redirects admin host /admin/login to /login", () => {
    assert.equal(subdomainPrefixedCanonicalPath("admin", "/admin/login"), "/login");
  });

  it("redirects core host /dashboard to /", () => {
    assert.equal(subdomainPrefixedCanonicalPath("core", "/dashboard"), "/");
  });

  it("redirects app host /apps/wexpay to /", () => {
    assert.equal(subdomainPrefixedCanonicalPath("app", "/apps/wexpay"), "/");
  });
});

describe("resolvePostLoginDestination", () => {
  it("maps next /apps/wexpay to app host in production", () => {
    assert.equal(
      resolvePostLoginDestination("/apps/wexpay/tables", { isAdmin: false, productionWexon: true }),
      "https://app.wexon.dev/tables",
    );
  });

  it("maps next /dashboard to core host in production", () => {
    assert.equal(
      resolvePostLoginDestination("/dashboard/billing", { isAdmin: false, productionWexon: true }),
      "https://core.wexon.dev/billing",
    );
  });

  it("maps next /admin to admin host in production", () => {
    assert.equal(
      resolvePostLoginDestination("/admin/organizations", { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/organizations",
    );
  });

  it("defaults admin login to admin host root in production", () => {
    assert.equal(
      resolvePostLoginDestination(undefined, { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/",
    );
  });

  it("maps admin subdomain relative next paths in production", () => {
    assert.equal(
      resolvePostLoginDestination("/applications", { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/applications",
    );
  });

  it("defaults customer login to core host root in production", () => {
    assert.equal(
      resolvePostLoginDestination(undefined, { isAdmin: false, productionWexon: true }),
      "https://core.wexon.dev/",
    );
  });

  it("keeps relative paths in local development", () => {
    assert.equal(resolvePostLoginDestination("/dashboard", { isAdmin: false, productionWexon: false }), "/dashboard");
    assert.equal(resolvePostLoginDestination("/admin", { isAdmin: true, productionWexon: false }), "/admin");
  });
});

describe("isMaintenanceExemptRoute", () => {
  it("exempts admin subdomain routes", () => {
    assert.equal(isMaintenanceExemptRoute("admin", "/"), true);
    assert.equal(isMaintenanceExemptRoute("admin", "/login"), true);
    assert.equal(isMaintenanceExemptRoute("admin", "/applications"), true);
  });

  it("exempts admin login paths on public host", () => {
    assert.equal(isMaintenanceExemptRoute("public", "/login"), true);
    assert.equal(isMaintenanceExemptRoute("public", "/admin"), true);
    assert.equal(isMaintenanceExemptRoute("public", "/admin/login"), true);
    assert.equal(isMaintenanceExemptRoute("public", "/admin/applications"), true);
  });

  it("does not exempt public marketing routes", () => {
    assert.equal(isMaintenanceExemptRoute("public", "/"), false);
    assert.equal(isMaintenanceExemptRoute("public", "/contact"), false);
    assert.equal(isMaintenanceExemptRoute("public", "/on-basvuru"), true);
  });
});

describe("isAdminHost", () => {
  it("matches production admin subdomain", () => {
    assert.equal(isAdminHost("admin.wexon.dev"), true);
    assert.equal(isAdminHost("www.wexon.dev"), false);
    assert.equal(isAdminHost("wexon.dev"), false);
  });
});
