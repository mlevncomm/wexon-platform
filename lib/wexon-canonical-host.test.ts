import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductionSubdomainUrl,
  isAdminHost,
  isMaintenanceExemptRoute,
  publicPanelCanonicalTarget,
  publicWwwCanonicalRedirect,
  resolveUnauthenticatedLoginRedirect,
  resolvePostLoginDestination,
  sessionCookieClearOptions,
  sessionCookieOptions,
  subdomainPrefixedCanonicalPath,
} from "./wexon-canonical-host";

function withEnv(snapshot: Record<string, string | undefined>, fn: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(snapshot)) {
    previous.set(key, process.env[key]);
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("publicWwwCanonicalRedirect", () => {
  it("redirects apex host to www", () => {
    assert.equal(publicWwwCanonicalRedirect("wexon.dev", "/contact", ""), "https://www.wexon.dev/contact");
    assert.equal(publicWwwCanonicalRedirect("wexon.dev", "/products/wexpay", "?ref=ig"), "https://www.wexon.dev/products/wexpay?ref=ig");
  });

  it("does not redirect www or subdomains", () => {
    assert.equal(publicWwwCanonicalRedirect("www.wexon.dev", "/contact", ""), null);
    assert.equal(publicWwwCanonicalRedirect("app.wexon.dev", "/tables", ""), null);
  });
});

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

  it("defaults admin login to applications in production", () => {
    assert.equal(
      resolvePostLoginDestination(undefined, { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/applications",
    );
    assert.equal(
      resolvePostLoginDestination("/", { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/applications",
    );
    assert.equal(
      resolvePostLoginDestination("/admin", { isAdmin: true, productionWexon: true }),
      "https://admin.wexon.dev/applications",
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

describe("resolveUnauthenticatedLoginRedirect", () => {
  it("sends local admin paths to local admin login", () => {
    assert.equal(
      resolveUnauthenticatedLoginRedirect("localhost", "public", "/admin", ""),
      "/admin/login?next=%2Fadmin",
    );
  });
});

describe("sessionCookieOptions", () => {
  it("sets shared domain in production Wexon deployment", () => {
    withEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://app.wexon.dev",
      },
      () => {
        const expires = new Date("2030-01-01T00:00:00.000Z");
        assert.deepEqual(sessionCookieOptions(expires), {
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          path: "/",
          expires,
          domain: ".wexon.dev",
        });
      },
    );
  });

  it("sets shared domain on session clear in production Wexon deployment", () => {
    withEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://app.wexon.dev",
      },
      () => {
        const options = sessionCookieClearOptions();
        assert.equal(options.domain, ".wexon.dev");
        assert.equal(options.path, "/");
        assert.equal(options.httpOnly, true);
        assert.equal(options.sameSite, "lax");
        assert.equal(options.secure, true);
        assert.equal(options.expires.getTime(), 0);
      },
    );
  });

  it("omits domain in local development", () => {
    withEnv(
      {
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      },
      () => {
        const expires = new Date("2030-01-01T00:00:00.000Z");
        const options = sessionCookieOptions(expires);
        assert.equal("domain" in options, false);
        assert.equal(options.secure, false);
        assert.equal(options.path, "/");

        const clearOptions = sessionCookieClearOptions();
        assert.equal("domain" in clearOptions, false);
        assert.equal(clearOptions.path, "/");
      },
    );
  });
});
