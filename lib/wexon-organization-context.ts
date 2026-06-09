import { cookies, headers } from "next/headers";
import type { DashboardOrganizationSelector } from "@/lib/wexon-core-dashboard";

export const ACTIVE_ORGANIZATION_COOKIE = "wexon_active_organization_id";
export const ACTIVE_ORGANIZATION_HEADER = "x-wexon-active-organization-id";

export type PlatformOrganizationSelector = DashboardOrganizationSelector;

export async function readActiveOrganizationIdFromHeader() {
  const headerStore = await headers();
  return headerStore.get(ACTIVE_ORGANIZATION_HEADER)?.trim() ?? null;
}

export async function readActiveOrganizationIdFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null;
}

/** Resolves the active organization id: request header first, then cookie. */
export async function readActiveOrganizationId() {
  const organizationIdFromHeader = await readActiveOrganizationIdFromHeader();
  if (organizationIdFromHeader) {
    return organizationIdFromHeader;
  }

  return readActiveOrganizationIdFromCookie();
}

export async function resolvePlatformOrganizationSelector(
  explicit?: PlatformOrganizationSelector,
): Promise<PlatformOrganizationSelector | undefined> {
  if (explicit?.organizationId?.trim() || explicit?.organizationSlug?.trim()) {
    return {
      organizationId: explicit.organizationId?.trim(),
      organizationSlug: explicit.organizationSlug?.trim(),
    };
  }

  const organizationIdFromHeader = await readActiveOrganizationIdFromHeader();
  if (organizationIdFromHeader) {
    return { organizationId: organizationIdFromHeader };
  }

  const organizationIdFromCookie = await readActiveOrganizationIdFromCookie();
  if (organizationIdFromCookie) {
    return { organizationId: organizationIdFromCookie };
  }

  return undefined;
}

export function buildOrganizationSearchParams(selector?: PlatformOrganizationSelector, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (selector?.organizationId) {
    params.set("organizationId", selector.organizationId);
  } else if (selector?.organizationSlug) {
    params.set("organizationSlug", selector.organizationSlug);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return params;
}

export function platformHref(path: string, selector?: PlatformOrganizationSelector, extra?: Record<string, string>) {
  const params = buildOrganizationSearchParams(selector, extra);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function adminOrganizationHref(organizationId: string) {
  return `/admin/organizations/${organizationId}`;
}

export function dashboardPreviewHref(organizationId: string, path = "/dashboard") {
  return platformHref(path, { organizationId });
}

export function wexpayHref(path = "/apps/wexpay", organizationId?: string | null, branchId?: string | null) {
  return platformHref(path, organizationId ? { organizationId } : undefined, branchId ? { branchId } : undefined);
}
