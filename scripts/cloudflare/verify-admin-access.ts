#!/usr/bin/env node
/**
 * Verify Cloudflare Access is configured only for admin.wexon.dev.
 */

import {
  ACCESS_DOMAIN,
  ADMIN_HOSTNAME,
  APP_NAME,
  FORBIDDEN_PROTECTED_HOSTS,
  POLICY_NAME,
  assertNoForbiddenCoverage,
  findAdminApplication,
  findBypassPolicies,
  findForbiddenApplications,
  getAdminDnsRecord,
  listAccessApplications,
  listApplicationPolicies,
  policyEmails,
  requireApiToken,
  resolveContext,
  type AccessApplication,
  CloudflareAccessError,
} from "./admin-access-lib";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const checks: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}

function assertAdminAppDomains(app: AccessApplication): void {
  const domains = [app.domain, ...(app.self_hosted_domains ?? []), ...(app.destinations ?? []).map((d) => d.uri ?? "")];
  const valid = domains.filter(Boolean).every((domain) => domain === ACCESS_DOMAIN || domain === `${ADMIN_HOSTNAME}/*`);
  record(
    "admin app domain scope",
    valid,
    valid ? `scoped to ${ACCESS_DOMAIN}` : `unexpected domains: ${domains.filter(Boolean).join(", ")}`,
  );
}

async function verifyHttpChallenge(): Promise<void> {
  const response = await fetch(`https://${ADMIN_HOSTNAME}/`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const challenged =
    response.status === 302 ||
    response.status === 303 ||
    location.includes("cloudflareaccess.com") ||
    location.includes("/cdn-cgi/access/");

  record(
    "admin HTTP challenge",
    challenged,
    challenged
      ? `status ${response.status}${location ? ` -> ${location}` : ""}`
      : `expected Cloudflare Access redirect/challenge, got status ${response.status}`,
  );
}

async function main(): Promise<void> {
  const token = requireApiToken();
  const context = await resolveContext(token);

  const [dns, apps] = await Promise.all([
    getAdminDnsRecord(token, context.zoneId),
    listAccessApplications(token, context.accountId),
  ]);

  record("dns record present", Boolean(dns.record), dns.record ? `${dns.record.type} ${dns.record.name}` : "missing");
  record("dns proxied", dns.proxied, dns.proxied ? "orange cloud enabled" : "proxy disabled");

  try {
    assertNoForbiddenCoverage(findForbiddenApplications(apps));
    record("forbidden host coverage", true, "no Access apps on public/core/app hosts or wildcards");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record("forbidden host coverage", false, message);
  }

  const adminApp = findAdminApplication(apps);
  record("admin app exists", Boolean(adminApp), adminApp ? `${adminApp.name} (${adminApp.id})` : "not found");

  if (!adminApp) {
    printReport();
    process.exit(1);
  }

  assertAdminAppDomains(adminApp);
  record("admin app name", adminApp.name === APP_NAME, adminApp.name);
  record("admin app type", adminApp.type === "self_hosted", adminApp.type);
  record(
    "warp client auth disabled",
    adminApp.allow_authenticate_via_warp === false,
    String(adminApp.allow_authenticate_via_warp),
  );
  record(
    "instant auth disabled",
    adminApp.auto_redirect_to_identity === false,
    String(adminApp.auto_redirect_to_identity),
  );
  record(
    "browser rdp/ssh/vnc disabled",
    adminApp.type !== "rdp" && adminApp.type !== "ssh" && adminApp.type !== "vnc",
    adminApp.type,
  );

  const policies = await listApplicationPolicies(token, context.accountId, adminApp.id);
  const bypassPolicies = findBypassPolicies(policies);
  record("no bypass policies", bypassPolicies.length === 0, bypassPolicies.map((p) => p.name).join(", ") || "none");

  const allowlist = policies.find((policy) => policy.name === POLICY_NAME && policy.decision === "allow");
  record("allowlist policy exists", Boolean(allowlist), allowlist ? allowlist.id : "missing");

  if (allowlist) {
    const allowed = new Set(policyEmails(allowlist));
    const expected = new Set(context.adminEmails);
    const missing = context.adminEmails.filter((email) => !allowed.has(email));
    const unexpected = [...allowed].filter((email) => !expected.has(email));
    const emailsOk = missing.length === 0 && unexpected.length === 0;
    record(
      "allowlist emails",
      emailsOk,
      emailsOk ? `${expected.size} email(s) matched` : `missing=${missing.length}, unexpected=${unexpected.length}`,
    );
  }

  for (const host of FORBIDDEN_PROTECTED_HOSTS) {
    const response = await fetch(`https://${host}/`, { redirect: "manual" });
    const location = response.headers.get("location") ?? "";
    const accessProtected =
      location.includes("cloudflareaccess.com") || location.includes("/cdn-cgi/access/");
    record(`public host not access-gated (${host})`, !accessProtected, `status ${response.status}`);
  }

  await verifyHttpChallenge();

  printReport();
  const failed = checks.some((check) => !check.ok);
  process.exit(failed ? 1 : 0);
}

function printReport(): void {
  console.log("\nCloudflare Access verification");
  console.log("─".repeat(48));
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}`);
    console.log(`      ${check.detail}`);
  }
  console.log("");
}

main().catch((error: unknown) => {
  if (error instanceof CloudflareAccessError) {
    console.error(`Error: ${error.message}`);
    if (error.missingPermissions.length > 0) {
      console.error(`Missing token permission(s): ${[...new Set(error.missingPermissions)].join(", ")}`);
    }
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});
