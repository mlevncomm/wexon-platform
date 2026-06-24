import type { Branch, Restaurant } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { type AuditClient, getRequestIpAddress, writeAuditLog } from "@/lib/wexon-audit";
import {
  type AllowedProductAccess,
  type CoreEntitlementMap,
  requireProductAccess,
} from "@/lib/wexon-core-access";
import { errorResponse } from "./_utils";

/**
 * WexPay DEMO access guard.
 *
 * These endpoints are DEMO-ONLY. They are intentionally scoped to a single,
 * deterministically resolved demo organization and must never make a real
 * (global-fallback) access decision. The final allow/deny decision is always
 * delegated to Wexon Core via `requireProductAccess`.
 */

const DEMO_RESTAURANT_SLUG = "mavi-bahce-restaurant";
const DEMO_BRANCH_SLUG = "merkez-sube";
const WEXPAY_PRODUCT_KEY = "wexpay";

export type WexPayDemoContext = {
  organizationId: string;
  restaurant: Restaurant;
  branch: Branch;
  coreAccess: AllowedProductAccess;
  entitlementMap: CoreEntitlementMap;
};

type DemoConfigDenial = {
  ok: false;
  status: number;
  message: string;
  reason: "demo_not_configured";
};

type DemoCoreDenial = {
  ok: false;
  status: number;
  message: string;
  reason: string;
};

export type ResolveWexPayDemoResult =
  | ({ ok: true } & WexPayDemoContext)
  | DemoConfigDenial
  | DemoCoreDenial;

/**
 * Resolve the demo tenant strictly from the configured demo restaurant slug.
 * No `findFirst({ isActive })` fallback: if the demo restaurant is missing or
 * not linked to an organization, the demo is simply "not configured".
 */
export async function resolveWexPayDemoContext(): Promise<ResolveWexPayDemoResult> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: DEMO_RESTAURANT_SLUG },
  });

  if (!restaurant || !restaurant.isActive || !restaurant.organizationId) {
    return {
      ok: false,
      status: 404,
      message: "Demo restoran bulunamadı.",
      reason: "demo_not_configured",
    };
  }

  const branch = await prisma.branch.findFirst({
    where: {
      restaurantId: restaurant.id,
      slug: DEMO_BRANCH_SLUG,
      isActive: true,
    },
  });

  if (!branch) {
    return {
      ok: false,
      status: 404,
      message: "Demo restoran bulunamadı.",
      reason: "demo_not_configured",
    };
  }

  const decision = await requireProductAccess({
    organizationId: restaurant.organizationId,
    productKey: WEXPAY_PRODUCT_KEY,
  });

  if (!decision.ok) {
    return {
      ok: false,
      status: decision.status,
      message: decision.message,
      reason: decision.reason,
    };
  }

  if (!decision.organization.isDemo) {
    return {
      ok: false,
      status: 403,
      message: "Bu endpoint yalnızca demo tenant için kullanılabilir.",
      reason: "demo_not_configured",
    };
  }

  return {
    ok: true,
    organizationId: restaurant.organizationId,
    restaurant,
    branch,
    coreAccess: decision,
    entitlementMap: decision.entitlementMap,
  };
}

export type RequireWexPayDemoResult =
  | ({ ok: true } & WexPayDemoContext)
  | { ok: false; response: Response };

/**
 * Guard for demo route handlers. Returns the resolved demo context or a ready
 * `Response` (403 on Core denial, 404 when the demo is not configured).
 */
export async function requireWexPayDemoContext(): Promise<RequireWexPayDemoResult> {
  const result = await resolveWexPayDemoContext();

  if (!result.ok) {
    return { ok: false, response: errorResponse(result.message, result.status) };
  }

  return result;
}

type WexPayDemoAuditInput = {
  request: Request;
  organizationId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Audit writer for demo mutations. Demo actions are namespaced `wexpay.demo.*`
 * and carry no user (public demo). Pass a transaction client to keep the audit
 * atomic with the mutation.
 */
export async function writeWexPayDemoAudit(input: WexPayDemoAuditInput, client?: AuditClient) {
  return writeAuditLog(
    {
      action: input.action,
      organizationId: input.organizationId,
      userId: null,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: getRequestIpAddress(input.request),
      source: "wexpay_demo",
      metadata: { demo: true, ...(input.metadata ?? {}) },
    },
    client,
  );
}
