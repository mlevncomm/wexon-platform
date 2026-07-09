/**
 * Shared Cloudflare Access helpers for admin.wexon.dev automation.
 * Never log CLOUDFLARE_API_TOKEN or secret values.
 */

export const ZONE_NAME = "wexon.dev";
export const ADMIN_HOSTNAME = "admin.wexon.dev";
export const ACCESS_PATH = "/*";
export const ACCESS_DOMAIN = `${ADMIN_HOSTNAME}${ACCESS_PATH}`;
export const APP_NAME = "Wexon Admin";
export const POLICY_NAME = "Wexon Admin Allowlist";
export const SESSION_DURATION = "8h";

export const FORBIDDEN_PROTECTED_HOSTS = [
  "www.wexon.dev",
  "wexon.dev",
  "core.wexon.dev",
  "app.wexon.dev",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CloudflareApiError = {
  code: number;
  message: string;
};

export type CloudflareResponse<T> = {
  success: boolean;
  errors: CloudflareApiError[];
  messages: CloudflareApiError[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    total_count: number;
    count: number;
    total_pages: number;
  };
};

export type TokenVerifyResult = {
  id: string;
  status: "active" | "disabled" | "expired";
};

export type ZoneResult = {
  id: string;
  name: string;
  account: { id: string; name?: string };
  status: string;
};

export type DnsRecord = {
  id: string;
  type: string;
  name: string;
  proxied?: boolean;
  content: string;
};

export type AccessDestination = {
  type: string;
  uri?: string;
};

export type AccessApplication = {
  id: string;
  name: string;
  domain: string;
  type: string;
  session_duration?: string;
  allow_authenticate_via_warp?: boolean;
  auto_redirect_to_identity?: boolean;
  self_hosted_domains?: string[];
  destinations?: AccessDestination[];
};

export type AccessPolicyRule = {
  email?: { email: string };
  email_domain?: { domain: string };
};

export type AccessPolicy = {
  id: string;
  name: string;
  decision: string;
  precedence?: number;
  include?: AccessPolicyRule[];
  exclude?: AccessPolicyRule[];
};

export type ResolvedContext = {
  accountId: string;
  zoneId: string;
  zoneName: string;
  adminEmails: string[];
};

export type DnsCheck = {
  record: DnsRecord | null;
  proxied: boolean;
};

export type AppPlan = {
  action: "create" | "update" | "noop";
  existingId?: string;
  reasons: string[];
};

export type PolicyPlan = {
  action: "create" | "update" | "noop";
  existingId?: string;
  reasons: string[];
};

export class CloudflareAccessError extends Error {
  readonly code?: number;
  readonly missingPermissions: string[];

  constructor(message: string, options?: { code?: number; missingPermissions?: string[] }) {
    super(message);
    this.name = "CloudflareAccessError";
    this.code = options?.code;
    this.missingPermissions = options?.missingPermissions ?? [];
  }
}

export function requireApiToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    throw new CloudflareAccessError(
      "CLOUDFLARE_API_TOKEN is required. Set it in the shell before running this script.",
    );
  }
  return token;
}

export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    throw new CloudflareAccessError(
      "CLOUDFLARE_ACCESS_ADMIN_EMAILS is required (comma-separated exact admin emails).",
    );
  }

  const emails = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    throw new CloudflareAccessError("CLOUDFLARE_ACCESS_ADMIN_EMAILS must include at least one email.");
  }

  const invalid = emails.filter((email) => !EMAIL_RE.test(email));
  if (invalid.length > 0) {
    throw new CloudflareAccessError(`Invalid email(s) in CLOUDFLARE_ACCESS_ADMIN_EMAILS: ${invalid.join(", ")}`);
  }

  return [...new Set(emails)];
}

export function domainHasWildcard(domain: string): boolean {
  return domain.includes("*");
}

export function hostFromAccessDomain(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  const withoutPath = trimmed.split("/")[0] ?? trimmed;
  return withoutPath;
}

export function isExactAdminAccessDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase().replace(/\/\*$/, "").replace(/\/$/, "");
  if (domainHasWildcard(normalized) && !normalized.endsWith("/*")) {
    return false;
  }
  const host = hostFromAccessDomain(normalized);
  return host === ADMIN_HOSTNAME;
}

export function isForbiddenAccessDomain(domain: string): boolean {
  const value = domain.trim().toLowerCase();
  const host = hostFromAccessDomain(value);

  if (domainHasWildcard(value)) {
    if (value.startsWith("*.") || host.startsWith("*.") || value.includes("*.wexon.dev")) {
      return true;
    }
  }

  for (const forbidden of FORBIDDEN_PROTECTED_HOSTS) {
    if (host === forbidden || value === forbidden || value.startsWith(`${forbidden}/`)) {
      return true;
    }
  }

  return false;
}

export function assertAdminHostnameGuard(domain: string): void {
  if (domainHasWildcard(domain) && !domain.startsWith(`${ADMIN_HOSTNAME}/`)) {
    throw new CloudflareAccessError(
      `Refusing to continue: wildcard Access domain "${domain}" is not allowed. Only exact ${ACCESS_DOMAIN} is permitted.`,
    );
  }

  if (!isExactAdminAccessDomain(domain)) {
    throw new CloudflareAccessError(
      `Refusing to continue: hostname must be exactly ${ADMIN_HOSTNAME} (path ${ACCESS_PATH}). Got "${domain}".`,
    );
  }
}

export function extractApplicationDomains(app: AccessApplication): string[] {
  const domains = new Set<string>();
  if (app.domain) domains.add(app.domain);
  for (const item of app.self_hosted_domains ?? []) domains.add(item);
  for (const destination of app.destinations ?? []) {
    if (destination.uri) domains.add(destination.uri);
  }
  return [...domains];
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${visible}@${domain}`;
}

export function buildEmailIncludeRules(emails: string[]): AccessPolicyRule[] {
  return emails.map((email) => ({ email: { email } }));
}

export function policyEmails(policy: AccessPolicy): string[] {
  const emails: string[] = [];
  for (const rule of policy.include ?? []) {
    if (rule.email?.email) emails.push(rule.email.email.toLowerCase());
  }
  return emails;
}

export function buildApplicationPayload() {
  return {
    name: APP_NAME,
    type: "self_hosted",
    domain: ACCESS_DOMAIN,
    destinations: [{ type: "public", uri: ACCESS_DOMAIN }],
    session_duration: SESSION_DURATION,
    allow_authenticate_via_warp: false,
    auto_redirect_to_identity: false,
    app_launcher_visible: false,
  };
}

export function buildPolicyPayload(emails: string[], precedence = 1) {
  return {
    name: POLICY_NAME,
    decision: "allow",
    precedence,
    include: buildEmailIncludeRules(emails),
  };
}

export function applicationNeedsUpdate(app: AccessApplication): string[] {
  const reasons: string[] = [];
  if (app.name !== APP_NAME) reasons.push(`name is "${app.name}"`);
  if (app.type !== "self_hosted") reasons.push(`type is "${app.type}"`);
  if (!isExactAdminAccessDomain(app.domain)) reasons.push(`domain is "${app.domain}"`);
  if (app.session_duration !== SESSION_DURATION) reasons.push(`session_duration is "${app.session_duration ?? "unset"}"`);
  if (app.allow_authenticate_via_warp !== false) reasons.push("allow_authenticate_via_warp is not false");
  if (app.auto_redirect_to_identity !== false) reasons.push("auto_redirect_to_identity is not false");
  if (app.type === "rdp" || app.type === "ssh" || app.type === "vnc") {
    reasons.push(`browser ${app.type} application type must not be used`);
  }
  return reasons;
}

export function policyNeedsUpdate(policy: AccessPolicy, emails: string[]): string[] {
  const reasons: string[] = [];
  if (policy.decision !== "allow") reasons.push(`decision is "${policy.decision}"`);
  const existing = new Set(policyEmails(policy));
  const expected = new Set(emails);
  for (const email of expected) {
    if (!existing.has(email)) reasons.push(`missing allow email ${redactEmail(email)}`);
  }
  for (const email of existing) {
    if (!expected.has(email)) reasons.push(`unexpected allow email ${redactEmail(email)}`);
  }
  return reasons;
}

export function findAdminApplication(apps: AccessApplication[]): AccessApplication | undefined {
  return apps.find((app) => {
    if (app.name === APP_NAME) return true;
    return extractApplicationDomains(app).some((domain) => isExactAdminAccessDomain(domain));
  });
}

export function findForbiddenApplications(apps: AccessApplication[]): Array<{ app: AccessApplication; domain: string }> {
  const matches: Array<{ app: AccessApplication; domain: string }> = [];
  for (const app of apps) {
    for (const domain of extractApplicationDomains(app)) {
      if (isForbiddenAccessDomain(domain)) {
        matches.push({ app, domain });
      }
    }
  }
  return matches;
}

export function findBypassPolicies(policies: AccessPolicy[]): AccessPolicy[] {
  return policies.filter((policy) => policy.decision === "bypass");
}

export async function cfRequest<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<CloudflareResponse<T>> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as CloudflareResponse<T>;
  if (!response.ok || !body.success) {
    const messages = body.errors?.map((error) => error.message).join("; ") || response.statusText;
    const permissionHints = inferMissingPermissions(messages, path, init?.method ?? "GET");
    throw new CloudflareAccessError(`Cloudflare API ${init?.method ?? "GET"} ${path} failed: ${messages}`, {
      code: body.errors?.[0]?.code,
      missingPermissions: permissionHints,
    });
  }

  return body;
}

function inferMissingPermissions(message: string, path: string, method: string): string[] {
  const lower = message.toLowerCase();
  const hints: string[] = [];

  if (lower.includes("permission") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    if (path.includes("/access/")) {
      if (method === "GET") hints.push("Access: Apps and Policies Read");
      else hints.push("Access: Apps and Policies Write");
    }
    if (path.includes("/zones")) {
      hints.push("Zone Read");
      if (path.includes("/dns_records")) hints.push("DNS Read");
    }
    if (path.includes("/user/tokens/verify")) hints.push("API Tokens Read");
  }

  return hints;
}

export async function verifyToken(token: string): Promise<TokenVerifyResult> {
  const body = await cfRequest<TokenVerifyResult>(token, "/user/tokens/verify", { method: "GET" });
  if (body.result.status !== "active") {
    throw new CloudflareAccessError(`CLOUDFLARE_API_TOKEN status is "${body.result.status}" (expected active).`);
  }
  return body.result;
}

export async function resolveZoneContext(token: string): Promise<{ accountId: string; zoneId: string; zoneName: string }> {
  const body = await cfRequest<ZoneResult[]>(
    token,
    `/zones?name=${encodeURIComponent(ZONE_NAME)}&status=active`,
    { method: "GET" },
  );

  const zone = body.result[0];
  if (!zone) {
    throw new CloudflareAccessError(`Zone "${ZONE_NAME}" not found or not active for this token.`);
  }

  return {
    accountId: zone.account.id,
    zoneId: zone.id,
    zoneName: zone.name,
  };
}

export async function listAccessApplications(token: string, accountId: string): Promise<AccessApplication[]> {
  const apps: AccessApplication[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const body = await cfRequest<AccessApplication[]>(
      token,
      `/accounts/${accountId}/access/apps?page=${page}&per_page=50`,
      { method: "GET" },
    );
    apps.push(...body.result);
    totalPages = body.result_info?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return apps;
}

export async function listApplicationPolicies(
  token: string,
  accountId: string,
  appId: string,
): Promise<AccessPolicy[]> {
  const body = await cfRequest<AccessPolicy[]>(
    token,
    `/accounts/${accountId}/access/apps/${appId}/policies`,
    { method: "GET" },
  );
  return body.result;
}

export async function getAdminDnsRecord(token: string, zoneId: string): Promise<DnsCheck> {
  const body = await cfRequest<DnsRecord[]>(
    token,
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(ADMIN_HOSTNAME)}`,
    { method: "GET" },
  );

  const record = body.result[0] ?? null;
  return {
    record,
    proxied: Boolean(record?.proxied),
  };
}

export function planApplication(app: AccessApplication | undefined): AppPlan {
  if (!app) {
    return { action: "create", reasons: ["application does not exist"] };
  }

  const reasons = applicationNeedsUpdate(app);
  if (reasons.length === 0) {
    return { action: "noop", existingId: app.id, reasons: [] };
  }

  return { action: "update", existingId: app.id, reasons };
}

export function planPolicy(policy: AccessPolicy | undefined, emails: string[]): PolicyPlan {
  if (!policy) {
    return { action: "create", reasons: ["allowlist policy does not exist"] };
  }

  const reasons = policyNeedsUpdate(policy, emails);
  if (reasons.length === 0) {
    return { action: "noop", existingId: policy.id, reasons: [] };
  }

  return { action: "update", existingId: policy.id, reasons };
}

export function printRedactedSummary(input: {
  mode: "plan" | "apply";
  context: ResolvedContext;
  dns: DnsCheck;
  appPlan: AppPlan;
  policyPlan: PolicyPlan;
  forbiddenApps: Array<{ app: AccessApplication; domain: string }>;
  bypassPolicies: AccessPolicy[];
}) {
  const { mode, context, dns, appPlan, policyPlan, forbiddenApps, bypassPolicies } = input;

  console.log(`\nCloudflare Access ${mode === "plan" ? "plan" : "apply"} summary`);
  console.log("─".repeat(48));
  console.log(`Zone:              ${context.zoneName} (${context.zoneId})`);
  console.log(`Account:           ${context.accountId}`);
  console.log(`Target hostname:   ${ADMIN_HOSTNAME}`);
  console.log(`Target path:       ${ACCESS_PATH}`);
  console.log(`Access domain:     ${ACCESS_DOMAIN}`);
  console.log(`App name:          ${APP_NAME}`);
  console.log(`App type:          self_hosted`);
  console.log(`Session duration:  ${SESSION_DURATION}`);
  console.log(`WARP client auth:  disabled`);
  console.log(`Instant auth:      disabled`);
  console.log(`Browser RDP/SSH/VNC: not enabled (self_hosted only)`);
  console.log(`Bypass policy:     will not be created`);
  console.log(`Admin emails:      ${context.adminEmails.map(redactEmail).join(", ")}`);
  console.log(`DNS record:        ${dns.record ? `${dns.record.type} ${dns.record.name}` : "missing"}`);
  console.log(`DNS proxied:       ${dns.proxied ? "yes (orange cloud)" : "no"}`);
  console.log(`Application:       ${appPlan.action}${appPlan.existingId ? ` (${appPlan.existingId})` : ""}`);
  if (appPlan.reasons.length > 0) console.log(`  reasons: ${appPlan.reasons.join("; ")}`);
  console.log(`Allowlist policy:  ${policyPlan.action}${policyPlan.existingId ? ` (${policyPlan.existingId})` : ""}`);
  if (policyPlan.reasons.length > 0) console.log(`  reasons: ${policyPlan.reasons.join("; ")}`);

  if (forbiddenApps.length > 0) {
    console.log("\nForbidden Access coverage detected:");
    for (const match of forbiddenApps) {
      console.log(`  - app "${match.app.name}" covers ${match.domain}`);
    }
  }

  if (bypassPolicies.length > 0) {
    console.log("\nBypass policies detected on admin app:");
    for (const policy of bypassPolicies) {
      console.log(`  - ${policy.name} (${policy.id})`);
    }
  }

  console.log("");
}

export async function resolveContext(token: string): Promise<ResolvedContext> {
  await verifyToken(token);
  const zone = await resolveZoneContext(token);
  const adminEmails = parseAdminEmails(process.env.CLOUDFLARE_ACCESS_ADMIN_EMAILS);

  return {
    accountId: zone.accountId,
    zoneId: zone.zoneId,
    zoneName: zone.zoneName,
    adminEmails,
  };
}

export function assertNoForbiddenCoverage(matches: Array<{ app: AccessApplication; domain: string }>): void {
  if (matches.length === 0) return;
  const details = matches.map((match) => `${match.app.name} -> ${match.domain}`).join(", ");
  throw new CloudflareAccessError(
    `Forbidden Cloudflare Access coverage detected (${details}). Remove wildcard or public-host apps before continuing.`,
  );
}

export function assertDnsProxied(dns: DnsCheck): void {
  if (!dns.record) {
    throw new CloudflareAccessError(
      `DNS record for ${ADMIN_HOSTNAME} was not found in zone ${ZONE_NAME}. Create a proxied record before applying Access.`,
    );
  }
  if (!dns.proxied) {
    throw new CloudflareAccessError(
      `DNS record ${dns.record.name} is not proxied (orange cloud). Enable Cloudflare proxy on ${ADMIN_HOSTNAME} before applying Access.`,
    );
  }
}
