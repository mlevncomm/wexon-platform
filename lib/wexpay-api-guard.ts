import { prisma } from "@/lib/prisma";
import { apiKeyHashCandidates } from "@/lib/wexon-api-key-hash";
import { getRequestIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { canAccessWexPay, canManageWexPay } from "@/lib/wexpay-auth";
import {
  type AllowedProductAccess,
  type CoreEntitlementMap,
  requireProductAccess,
} from "@/lib/wexon-core-access";
import { getCustomerSession } from "@/lib/wexon-customer-auth";
import type { WexPayMutationContext } from "@/lib/wexpay-service";
import { WexPayValidationError } from "@/lib/wexpay-validation";
import { WexPayProviderNotConfiguredError } from "@/lib/wexpay-payment-provider";
import { WexPayAccessError } from "@/lib/wexpay-tenant";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";

/**
 * Tenant-aware guard for the PRODUCTION WexPay API (distinct from the demo
 * guard). It resolves the organization from a real tenant signal - an API key
 * or an authenticated customer session - then delegates the final access
 * decision to Wexon Core via `requireProductAccess`. There is never a global
 * fallback: a request that cannot be tied to a tenant is rejected.
 *
 * This is intentionally a reusable helper + reference contract; it is not a
 * full production API surface.
 */

const WEXPAY_PRODUCT_KEY = "wexpay";

export type WexPayApiActor =
  | { type: "api_key"; apiKeyId: string; organizationId: string; scopes: string[] }
  | { type: "customer_session"; userId: string; email: string; role: string };

export type WexPayApiContext = {
  organizationId: string;
  actor: WexPayApiActor;
  role: string | null;
  canManage: boolean;
  coreAccess: AllowedProductAccess;
  entitlementMap: CoreEntitlementMap;
  ipAddress: string | null;
};

export type RequireWexPayApiResult =
  | ({ ok: true } & WexPayApiContext)
  | { ok: false; response: Response };

export type RequireWexPayApiOptions = {
  /** Require management-level access (mutations). Defaults to false (read). */
  manage?: boolean;
  /** API key scope required for this operation, e.g. "wexpay:write". */
  requiredScope?: string;
  /** Explicit organization for session callers that belong to many orgs. */
  organizationId?: string;
};

type ApiFailureLogContext = {
  organizationId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
};

function jsonError(message: string, status: number, reason?: string, logContext?: ApiFailureLogContext) {
  writeAuditFailure({
    action: reason ? `api.access.${reason}` : "api.access.denied",
    message,
    organizationId: logContext?.organizationId,
    userId: logContext?.userId,
    ipAddress: logContext?.ipAddress,
    level: status >= 500 ? "ERROR" : "WARN",
    source: "wexpay_api",
    metadata: {
      httpStatus: status,
      reason,
      ...(logContext?.metadata ?? {}),
    },
  });
  return Response.json({ error: message, reason }, { status });
}

function readBearerOrApiKey(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }

  const apiKeyHeader = request.headers.get("x-api-key");
  return apiKeyHeader?.trim() || null;
}

async function resolveApiKeyActor(
  rawKey: string,
  requiredScope?: string,
): Promise<{ ok: true; actor: WexPayApiActor; organizationId: string } | { ok: false; response: Response }> {
  const { hmac, legacy } = apiKeyHashCandidates(rawKey);
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      revokedAt: null,
      OR: [{ hashedKey: hmac }, { hashedKey: legacy }],
    },
    include: { product: true },
  });

  if (!apiKey) {
    return { ok: false, response: jsonError("Geçersiz API anahtarı.", 401, "invalid_api_key") };
  }

  if (apiKey.product && apiKey.product.key !== WEXPAY_PRODUCT_KEY) {
    return {
      ok: false,
      response: jsonError("API anahtarı bu ürün için yetkili değil.", 403, "scope", {
        organizationId: apiKey.organizationId,
        metadata: { apiKeyId: apiKey.id },
      }),
    };
  }

  if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: jsonError("API anahtarı bu işlem için yetkili değil.", 403, "scope", {
        organizationId: apiKey.organizationId,
        metadata: { apiKeyId: apiKey.id, requiredScope },
      }),
    };
  }

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  return {
    ok: true,
    organizationId: apiKey.organizationId,
    actor: {
      type: "api_key",
      apiKeyId: apiKey.id,
      organizationId: apiKey.organizationId,
      scopes: apiKey.scopes,
    },
  };
}

async function resolveSessionActor(
  organizationId: string | undefined,
  manage: boolean,
): Promise<{ ok: true; actor: WexPayApiActor; organizationId: string } | { ok: false; response: Response }> {
  const session = await getCustomerSession();
  if (!session) {
    return { ok: false, response: jsonError("Kimlik doğrulaması gerekli.", 401, "unauthenticated") };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user || !user.isActive || user.memberships.length === 0) {
    return {
      ok: false,
      response: jsonError("Aktif üyelik bulunamadı.", 403, "missing_membership", {
        userId: session.userId,
        metadata: { email: user?.email },
      }),
    };
  }

  const membership = organizationId
    ? user.memberships.find((item) => item.organizationId === organizationId)
    : user.memberships[0];

  if (!membership) {
    return {
      ok: false,
      response: jsonError("Bu organizasyona erişiminiz yok.", 403, "forbidden", {
        userId: user.id,
        organizationId,
        metadata: { email: user.email },
      }),
    };
  }

  if (!canAccessWexPay(membership.role)) {
    return {
      ok: false,
      response: jsonError("WexPay erişim yetkiniz yok.", 403, "role", {
        userId: user.id,
        organizationId: membership.organizationId,
        metadata: { email: user.email, role: membership.role },
      }),
    };
  }

  if (manage && !canManageWexPay(membership.role)) {
    return {
      ok: false,
      response: jsonError("Bu işlem için yetkiniz yok.", 403, "role", {
        userId: user.id,
        organizationId: membership.organizationId,
        metadata: { email: user.email, role: membership.role },
      }),
    };
  }

  return {
    ok: true,
    organizationId: membership.organizationId,
    actor: {
      type: "customer_session",
      userId: user.id,
      email: user.email,
      role: membership.role,
    },
  };
}

export async function requireWexPayApiContext(
  request: Request,
  options: RequireWexPayApiOptions = {},
): Promise<RequireWexPayApiResult> {
  const ipAddress = getRequestIpAddress(request) ?? "unknown";
  const rateLimit = enforceRateLimit("wexpay.api", ipAddress, RATE_LIMITS.wexpayApi);
  if (!rateLimit.ok) {
    return {
      ok: false,
      response: jsonError("Çok fazla istek. Lütfen kısa bir süre sonra tekrar deneyin.", 429, "rate_limited", {
        ipAddress,
        metadata: { retryAfterSeconds: rateLimit.retryAfterSeconds },
      }),
    };
  }

  const manage = options.manage ?? false;
  const requiredScope = options.requiredScope ?? (manage ? "wexpay:write" : undefined);
  const rawKey = readBearerOrApiKey(request);

  const resolved = rawKey
    ? await resolveApiKeyActor(rawKey, requiredScope)
    : await resolveSessionActor(options.organizationId, manage);

  if (!resolved.ok) return resolved;

  const decision = await requireProductAccess({
    organizationId: resolved.organizationId,
    productKey: WEXPAY_PRODUCT_KEY,
  });

  const actorUserId = resolved.actor.type === "customer_session" ? resolved.actor.userId : null;

  if (!decision.ok) {
    return {
      ok: false,
      response: jsonError(decision.message, decision.status, decision.reason, {
        organizationId: resolved.organizationId,
        userId: actorUserId,
        ipAddress,
      }),
    };
  }

  if (decision.organization.isDemo) {
    return {
      ok: false,
      response: jsonError("Gercek WexPay API demo tenant ile kullanilamaz.", 403, "demo_tenant", {
        organizationId: resolved.organizationId,
        userId: actorUserId,
        ipAddress,
      }),
    };
  }

  const role = resolved.actor.type === "customer_session" ? resolved.actor.role : null;
  const canManage =
    resolved.actor.type === "api_key"
      ? resolved.actor.scopes.includes("wexpay:write")
      : canManageWexPay(resolved.actor.role);

  return {
    ok: true,
    organizationId: resolved.organizationId,
    actor: resolved.actor,
    role,
    canManage,
    coreAccess: decision,
    entitlementMap: decision.entitlementMap,
    ipAddress,
  };
}

/**
 * Adapt a resolved API context into the service-layer mutation context so
 * production routes reuse the exact same tenant/entitlement/audit logic as the
 * operator server actions.
 */
export function toWexPayApiErrorLogContext(
  context: Extract<RequireWexPayApiResult, { ok: true }>,
  route?: string,
): WexPayApiErrorLogContext {
  return {
    organizationId: context.organizationId,
    userId: context.actor.type === "customer_session" ? context.actor.userId : undefined,
    ipAddress: context.ipAddress,
    route,
  };
}

export function toWexPayMutationContext(context: Extract<RequireWexPayApiResult, { ok: true }>): WexPayMutationContext {
  const actor: WexPayMutationContext["actor"] =
    context.actor.type === "api_key"
      ? { type: "api_key", apiKeyId: context.actor.apiKeyId, scopes: context.actor.scopes }
      : { type: "customer_session", userId: context.actor.userId, email: context.actor.email, role: context.actor.role };

  return {
    organizationId: context.organizationId,
    actor,
    entitlementMap: context.entitlementMap,
    canManage: context.canManage,
    ipAddress: context.ipAddress,
  };
}

/** Read a JSON body, returning a 400 Response on parse failure. */
export async function readJsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    writeAuditFailure({
      action: "api.invalid_json",
      message: "Geçersiz JSON gövdesi.",
      level: "WARN",
      source: "wexpay_api",
      ipAddress: getRequestIpAddress(request),
    });
    return { ok: false, response: Response.json({ error: "Geçersiz JSON gövdesi.", reason: "invalid_json" }, { status: 400 }) };
  }
}

export type WexPayApiErrorLogContext = {
  organizationId?: string;
  userId?: string;
  ipAddress?: string | null;
  route?: string;
};

/** Map a service/domain error to a clean JSON API response. */
export function wexpayApiErrorResponse(error: unknown, context?: WexPayApiErrorLogContext): Response {
  if (error instanceof WexPayValidationError) {
    writeAuditFailure({
      action: "wexpay.api.validation",
      message: error.message,
      level: "WARN",
      organizationId: context?.organizationId,
      userId: context?.userId,
      ipAddress: context?.ipAddress,
      source: "wexpay_api",
      metadata: { route: context?.route, reason: "validation" },
    });
    return Response.json({ error: error.message, reason: "validation" }, { status: 400 });
  }
  if (error instanceof WexPayProviderNotConfiguredError) {
    writeAuditFailure({
      action: "wexpay.api.provider_not_configured",
      message: error.message,
      level: "WARN",
      organizationId: context?.organizationId,
      userId: context?.userId,
      ipAddress: context?.ipAddress,
      source: "wexpay_api",
      metadata: { route: context?.route, reason: "provider_not_configured", provider: error.provider },
    });
    return Response.json({ error: error.message, reason: "provider_not_configured" }, { status: 501 });
  }
  if (error instanceof WexPayAccessError) {
    writeAuditFailure({
      action: "wexpay.api.access",
      message: error.message,
      level: "WARN",
      organizationId: context?.organizationId,
      userId: context?.userId,
      ipAddress: context?.ipAddress,
      source: "wexpay_api",
      metadata: { route: context?.route, reason: error.reason },
    });
    return Response.json({ error: error.message, reason: error.reason }, { status: 403 });
  }
  writeAuditFailure({
    action: "wexpay.api.internal",
    message: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
    level: "ERROR",
    organizationId: context?.organizationId,
    userId: context?.userId,
    ipAddress: context?.ipAddress,
    source: "wexpay_api",
    metadata: { route: context?.route, reason: "internal" },
  });
  return Response.json({ error: "Beklenmeyen bir hata oluştu.", reason: "internal" }, { status: 500 });
}
