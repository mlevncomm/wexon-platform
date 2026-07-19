import { createHash, randomBytes } from "node:crypto";
import {
  TableQrTokenStatus,
  type Prisma,
  type PrismaClient,
  type TableQrToken,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";

/** Minimum entropy for opaque public QR tokens (256-bit). */
export const TABLE_QR_TOKEN_BYTES = 32;
export const TABLE_QR_TOKEN_PREFIX_LENGTH = 10;

type DbClient = PrismaClient | Prisma.TransactionClient;

export class TableQrTokenError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TableQrTokenError";
    this.code = code;
  }
}

export type GeneratedTableQrToken = {
  plaintext: string;
  tokenHash: string;
  tokenPrefix: string;
};

/** Build opaque base64url token + hash. Raw token must never be persisted. */
export function generateSecureTableQrTokenMaterial(): GeneratedTableQrToken {
  const bytes = randomBytes(TABLE_QR_TOKEN_BYTES);
  if (bytes.length < TABLE_QR_TOKEN_BYTES) {
    throw new TableQrTokenError("ENTROPY", "Yetersiz rastgele entropi.");
  }
  const plaintext = bytes.toString("base64url");
  const tokenHash = hashTableQrToken(plaintext);
  const tokenPrefix = plaintext.slice(0, TABLE_QR_TOKEN_PREFIX_LENGTH);
  return { plaintext, tokenHash, tokenPrefix };
}

export function hashTableQrToken(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    throw new TableQrTokenError("EMPTY_TOKEN", "Token boş olamaz.");
  }
  return createHash("sha256").update(trimmed, "utf8").digest("hex");
}

export function buildOpaquePublicQrPath(plaintext: string): string {
  return `/q/${encodeURIComponent(plaintext.trim())}`;
}

/** Audit-safe metadata — never include raw token. */
export function sanitizeTableQrTokenAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const blocked = new Set([
    "token",
    "plaintext",
    "rawToken",
    "opaqueToken",
    "qrToken",
    "secret",
  ]);
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.has(key)));
}

export type IssueTableQrTokenResult = {
  token: TableQrToken;
  /** Returned once — caller may render QR; never log or persist. */
  plaintext: string;
  publicPath: string;
};

async function assertTableOwnedByOrganization(
  client: DbClient,
  tableId: string,
  organizationId: string,
) {
  const table = await client.restaurantTable.findFirst({
    where: {
      id: tableId,
      branch: { restaurant: { organizationId } },
    },
    select: { id: true },
  });
  if (!table) {
    throw new TableQrTokenError("TABLE_NOT_FOUND", "Masa bulunamadı veya yetkisiz.");
  }
}

/**
 * Create the first ACTIVE token for a table (fails if one already exists).
 * Prefer rotateTableQrToken when replacing.
 */
export async function issueTableQrToken(input: {
  tableId: string;
  organizationId: string;
  actorUserId?: string | null;
}): Promise<IssueTableQrTokenResult> {
  return prisma.$transaction(async (tx) => {
    await assertTableOwnedByOrganization(tx, input.tableId, input.organizationId);

    const existingActive = await tx.tableQrToken.findFirst({
      where: { tableId: input.tableId, status: TableQrTokenStatus.ACTIVE },
      select: { id: true },
    });
    if (existingActive) {
      throw new TableQrTokenError("ACTIVE_EXISTS", "Masada zaten aktif bir QR token var. Rotate kullanın.");
    }

    const material = generateSecureTableQrTokenMaterial();
    const token = await tx.tableQrToken.create({
      data: {
        tableId: input.tableId,
        tokenHash: material.tokenHash,
        tokenPrefix: material.tokenPrefix,
        status: TableQrTokenStatus.ACTIVE,
      },
    });

    await writeAuditLog(
      {
        action: "wexpay.qr.issued",
        organizationId: input.organizationId,
        userId: input.actorUserId ?? null,
        entityType: "TableQrToken",
        entityId: token.id,
        source: "table_qr_token",
        message: "Güvenli masa QR token oluşturuldu.",
        metadata: sanitizeTableQrTokenAuditMetadata({
          tableId: input.tableId,
          tokenPrefix: material.tokenPrefix,
          tokenId: token.id,
        }),
      },
      tx,
    );

    return {
      token,
      plaintext: material.plaintext,
      publicPath: buildOpaquePublicQrPath(material.plaintext),
    };
  });
}

/**
 * Atomically revoke current ACTIVE token (if any) and issue a new ACTIVE token.
 */
export async function rotateTableQrToken(input: {
  tableId: string;
  organizationId: string;
  actorUserId?: string | null;
}): Promise<IssueTableQrTokenResult> {
  return prisma.$transaction(async (tx) => {
    await assertTableOwnedByOrganization(tx, input.tableId, input.organizationId);

    const now = new Date();
    const previous = await tx.tableQrToken.findFirst({
      where: { tableId: input.tableId, status: TableQrTokenStatus.ACTIVE },
    });

    if (previous) {
      await tx.tableQrToken.update({
        where: { id: previous.id },
        data: {
          status: TableQrTokenStatus.REVOKED,
          revokedAt: now,
          rotatedAt: now,
        },
      });
    }

    const material = generateSecureTableQrTokenMaterial();
    const token = await tx.tableQrToken.create({
      data: {
        tableId: input.tableId,
        tokenHash: material.tokenHash,
        tokenPrefix: material.tokenPrefix,
        status: TableQrTokenStatus.ACTIVE,
        rotatedAt: previous ? now : null,
      },
    });

    await writeAuditLog(
      {
        action: "wexpay.qr.rotated",
        organizationId: input.organizationId,
        userId: input.actorUserId ?? null,
        entityType: "TableQrToken",
        entityId: token.id,
        source: "table_qr_token",
        message: "Masa QR token döndürüldü.",
        metadata: sanitizeTableQrTokenAuditMetadata({
          tableId: input.tableId,
          tokenPrefix: material.tokenPrefix,
          tokenId: token.id,
          previousTokenId: previous?.id ?? null,
          previousTokenPrefix: previous?.tokenPrefix ?? null,
        }),
      },
      tx,
    );

    return {
      token,
      plaintext: material.plaintext,
      publicPath: buildOpaquePublicQrPath(material.plaintext),
    };
  });
}

/**
 * Revoke the ACTIVE token for a table (idempotent if already none).
 */
export async function revokeTableQrToken(input: {
  tableId: string;
  organizationId: string;
  actorUserId?: string | null;
}): Promise<{ revoked: boolean; tokenId: string | null }> {
  return prisma.$transaction(async (tx) => {
    await assertTableOwnedByOrganization(tx, input.tableId, input.organizationId);

    const active = await tx.tableQrToken.findFirst({
      where: { tableId: input.tableId, status: TableQrTokenStatus.ACTIVE },
    });
    if (!active) {
      return { revoked: false, tokenId: null };
    }

    await tx.tableQrToken.update({
      where: { id: active.id },
      data: {
        status: TableQrTokenStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await writeAuditLog(
      {
        action: "wexpay.qr.revoked",
        organizationId: input.organizationId,
        userId: input.actorUserId ?? null,
        entityType: "TableQrToken",
        entityId: active.id,
        source: "table_qr_token",
        message: "Masa QR token iptal edildi.",
        metadata: sanitizeTableQrTokenAuditMetadata({
          tableId: input.tableId,
          tokenPrefix: active.tokenPrefix,
          tokenId: active.id,
        }),
      },
      tx,
    );

    return { revoked: true, tokenId: active.id };
  });
}

/** Resolve ACTIVE token by opaque plaintext (hash lookup). Never log plaintext. */
export async function findActiveTableQrTokenByPlaintext(
  plaintext: string,
  client: DbClient = prisma,
): Promise<TableQrToken | null> {
  const tokenHash = hashTableQrToken(plaintext);
  return client.tableQrToken.findFirst({
    where: { tokenHash, status: TableQrTokenStatus.ACTIVE },
  });
}

export async function touchTableQrTokenLastUsed(
  tokenId: string,
  client: DbClient = prisma,
): Promise<void> {
  // Throttle writes: only bump when never set or older than 5 minutes.
  const threshold = new Date(Date.now() - 5 * 60 * 1000);
  await client.tableQrToken.updateMany({
    where: {
      id: tokenId,
      status: TableQrTokenStatus.ACTIVE,
      OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: threshold } }],
    },
    data: { lastUsedAt: new Date() },
  });
}
