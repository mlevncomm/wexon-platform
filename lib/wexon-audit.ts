import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

/**
 * Minimal Prisma-compatible client surface so audit writes can run either on
 * the root `prisma` client or inside a `$transaction` (tx) callback.
 */
export type AuditClient = {
  auditLog: {
    create: (args: Parameters<typeof prisma.auditLog.create>[0]) => ReturnType<typeof prisma.auditLog.create>;
  };
};

export type AuditLogLevel = "INFO" | "WARN" | "ERROR";
export type AuditLogStatus = "SUCCESS" | "FAILURE";

export type AuditLogInput = {
  action: string;
  organizationId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
  ipAddress?: string | null;
  source?: string;
  level?: AuditLogLevel;
  status?: AuditLogStatus;
  message?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Shared AuditLog writer. Use for every meaningful create/update/delete/reset
 * mutation across products and surfaces so the audit trail stays complete.
 */
export async function writeAuditLog(input: AuditLogInput, client: AuditClient = prisma) {
  return client.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress ?? null,
      level: input.level ?? "INFO",
      status: input.status ?? "SUCCESS",
      message: input.message ?? null,
      metadataJson: {
        ...(input.source ? { source: input.source } : {}),
        ...(input.metadata ?? {}),
      },
    },
  });
}

/**
 * Fire-and-forget audit writer for failures and diagnostics. Never blocks UX.
 */
export function writeAuditFailure(input: AuditLogInput) {
  void writeAuditLog({
    ...input,
    level: input.level ?? "WARN",
    status: input.status ?? "FAILURE",
  }).catch((error) => {
    console.error("[wexon-audit] failure log write error", error);
  });
}

/**
 * Best-effort client IP extraction from a Fetch `Request` for audit context.
 */
export function getRequestIpAddress(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }

  return request.headers.get("x-real-ip");
}

/** Best-effort IP extraction for Server Actions (login, etc.). */
export async function getServerActionIpAddress(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }

  return headerList.get("x-real-ip") ?? "unknown";
}
