#!/usr/bin/env node
/**
 * Plan or apply Cloudflare Access for admin.wexon.dev only.
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCESS_ADMIN_EMAILS
 *   CONFIRM_CLOUDFLARE_ACCESS_APPLY=true   (apply only)
 */

import {
  ACCESS_DOMAIN,
  APP_NAME,
  POLICY_NAME,
  assertAdminHostnameGuard,
  assertDnsProxied,
  assertNoForbiddenCoverage,
  buildApplicationPayload,
  buildPolicyPayload,
  cfRequest,
  findAdminApplication,
  findBypassPolicies,
  findForbiddenApplications,
  getAdminDnsRecord,
  listAccessApplications,
  listApplicationPolicies,
  planApplication,
  planPolicy,
  printRedactedSummary,
  requireApiToken,
  resolveContext,
  type AccessApplication,
  type AccessPolicy,
  CloudflareAccessError,
} from "./admin-access-lib";

const mode = process.argv.includes("--apply") ? "apply" : "plan";

function requireApplyConfirmation(): void {
  if (process.env.CONFIRM_CLOUDFLARE_ACCESS_APPLY?.trim() === "true") return;
  throw new CloudflareAccessError(
    "Apply blocked. Set CONFIRM_CLOUDFLARE_ACCESS_APPLY=true after reviewing the plan summary.",
  );
}

async function createApplication(token: string, accountId: string): Promise<AccessApplication> {
  assertAdminHostnameGuard(ACCESS_DOMAIN);
  const body = await cfRequest<AccessApplication>(token, `/accounts/${accountId}/access/apps`, {
    method: "POST",
    body: JSON.stringify(buildApplicationPayload()),
  });
  return body.result;
}

async function updateApplication(token: string, accountId: string, appId: string): Promise<AccessApplication> {
  assertAdminHostnameGuard(ACCESS_DOMAIN);
  const body = await cfRequest<AccessApplication>(token, `/accounts/${accountId}/access/apps/${appId}`, {
    method: "PUT",
    body: JSON.stringify(buildApplicationPayload()),
  });
  return body.result;
}

async function createPolicy(
  token: string,
  accountId: string,
  appId: string,
  emails: string[],
): Promise<AccessPolicy> {
  const body = await cfRequest<AccessPolicy>(token, `/accounts/${accountId}/access/apps/${appId}/policies`, {
    method: "POST",
    body: JSON.stringify(buildPolicyPayload(emails)),
  });
  return body.result;
}

async function updatePolicy(
  token: string,
  accountId: string,
  appId: string,
  policyId: string,
  emails: string[],
): Promise<AccessPolicy> {
  const body = await cfRequest<AccessPolicy>(
    token,
    `/accounts/${accountId}/access/apps/${appId}/policies/${policyId}`,
    {
      method: "PUT",
      body: JSON.stringify(buildPolicyPayload(emails)),
    },
  );
  return body.result;
}

function findAllowlistPolicy(policies: AccessPolicy[]): AccessPolicy | undefined {
  return policies.find((policy) => policy.name === POLICY_NAME && policy.decision === "allow");
}

async function main(): Promise<void> {
  const token = requireApiToken();
  const context = await resolveContext(token);

  const [dns, apps] = await Promise.all([
    getAdminDnsRecord(token, context.zoneId),
    listAccessApplications(token, context.accountId),
  ]);

  const forbiddenApps = findForbiddenApplications(apps);
  assertNoForbiddenCoverage(forbiddenApps);

  const adminApp = findAdminApplication(apps);
  const appPlan = planApplication(adminApp);

  let policies: AccessPolicy[] = [];
  if (adminApp) {
    policies = await listApplicationPolicies(token, context.accountId, adminApp.id);
  }

  const bypassPolicies = findBypassPolicies(policies);
  const allowlistPolicy = findAllowlistPolicy(policies);
  const policyPlan = planPolicy(allowlistPolicy, context.adminEmails);

  printRedactedSummary({
    mode,
    context,
    dns,
    appPlan,
    policyPlan,
    forbiddenApps,
    bypassPolicies,
  });

  if (!dns.proxied) {
    const message = dns.record
      ? `DNS for ${dns.record.name} is not proxied (orange cloud).`
      : `DNS record for admin host was not found.`;
    console.error(`${message} Access will not be applied until proxy is enabled.`);
    process.exit(1);
  }

  if (mode === "plan") {
    console.log("Plan complete. Review the summary, then run:");
    console.log('  $env:CONFIRM_CLOUDFLARE_ACCESS_APPLY="true"; npm run cloudflare:access:apply');
    return;
  }

  requireApplyConfirmation();
  assertDnsProxied(dns);

  let app = adminApp;
  if (appPlan.action === "create") {
    console.log(`Creating Access application "${APP_NAME}"...`);
    app = await createApplication(token, context.accountId);
  } else if (appPlan.action === "update" && appPlan.existingId) {
    console.log(`Updating Access application "${APP_NAME}"...`);
    app = await updateApplication(token, context.accountId, appPlan.existingId);
  } else {
    console.log(`Access application "${APP_NAME}" already matches desired state.`);
  }

  if (!app) {
    throw new CloudflareAccessError("Admin Access application is missing after apply step.");
  }

  const refreshedPolicies = await listApplicationPolicies(token, context.accountId, app.id);
  const refreshedBypass = findBypassPolicies(refreshedPolicies);
  if (refreshedBypass.length > 0) {
    throw new CloudflareAccessError(
      `Bypass policies exist on admin app (${refreshedBypass.map((policy) => policy.name).join(", ")}). Remove them manually; this script will not create bypass policies.`,
    );
  }

  const currentAllowlist = findAllowlistPolicy(refreshedPolicies);
  const refreshedPolicyPlan = planPolicy(currentAllowlist, context.adminEmails);

  if (refreshedPolicyPlan.action === "create") {
    console.log(`Creating allowlist policy "${POLICY_NAME}"...`);
    await createPolicy(token, context.accountId, app.id, context.adminEmails);
  } else if (refreshedPolicyPlan.action === "update" && refreshedPolicyPlan.existingId) {
    console.log(`Updating allowlist policy "${POLICY_NAME}"...`);
    await updatePolicy(token, context.accountId, app.id, refreshedPolicyPlan.existingId, context.adminEmails);
  } else {
    console.log(`Allowlist policy "${POLICY_NAME}" already matches desired state.`);
  }

  console.log("\nApply complete. Run `npm run cloudflare:access:verify` to validate production behavior.");
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
