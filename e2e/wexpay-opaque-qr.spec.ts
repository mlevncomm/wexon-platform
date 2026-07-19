import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash, randomBytes } from "node:crypto";
import { loadFixtures } from "./helpers";

function hashToken(plaintext: string) {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/**
 * Secure opaque QR lifecycle against isolated DB — never logs plaintext tokens.
 */
test.describe.serial("wexpay opaque QR", () => {
  const fixtures = loadFixtures();

  test("issue/rotate/revoke opaque token and keep legacy working", async ({ page, request }) => {
    test.setTimeout(180_000);
    test.skip(!fixtures.dbAvailable || !fixtures.fixturesReady || !fixtures.qrCode || !fixtures.realOrgId, "fixtures required");

    const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    if (!databaseUrl) test.skip(true, "DATABASE_URL required");

    const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });
    const table = await prisma.restaurantTable.findFirst({
      where: { qrCode: fixtures.qrCode! },
      select: { id: true },
    });
    expect(table).toBeTruthy();

    const plaintext = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(plaintext);
    const tokenPrefix = plaintext.slice(0, 10);

    // Revoke any prior ACTIVE tokens for this table (idempotent fixture hygiene).
    await prisma.tableQrToken.updateMany({
      where: { tableId: table!.id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    const created = await prisma.tableQrToken.create({
      data: {
        tableId: table!.id,
        tokenHash,
        tokenPrefix,
        status: "ACTIVE",
      },
    });

    try {
      const menu = await request.get(`/api/wexpay/public/${encodeURIComponent(plaintext)}`);
      expect(menu.status()).toBe(200);
      const menuJson = await menu.json();
      expect(menuJson.table?.label).toBeTruthy();
      expect(JSON.stringify(menuJson)).not.toContain(plaintext);

      await page.goto(`/q/${encodeURIComponent(plaintext)}`);
      await expect(page.getByTestId("qr-error-state")).toHaveCount(0);
      await expect(page.getByTestId("qr-cta-order")).toBeVisible();
      await expect(page.getByTestId("qr-cta-order")).toContainText(/Menüyü İncele/i);

      const rotatedPlain = randomBytes(32).toString("base64url");
      await prisma.tableQrToken.update({
        where: { id: created.id },
        data: { status: "REVOKED", revokedAt: new Date(), rotatedAt: new Date() },
      });
      await prisma.tableQrToken.create({
        data: {
          tableId: table!.id,
          tokenHash: hashToken(rotatedPlain),
          tokenPrefix: rotatedPlain.slice(0, 10),
          status: "ACTIVE",
        },
      });

      expect((await request.get(`/api/wexpay/public/${encodeURIComponent(plaintext)}`)).status()).toBe(404);
      expect((await request.get(`/api/wexpay/public/${encodeURIComponent(rotatedPlain)}`)).status()).toBe(200);

      await prisma.tableQrToken.updateMany({
        where: { tableId: table!.id, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      expect((await request.get(`/api/wexpay/public/${encodeURIComponent(rotatedPlain)}`)).status()).toBe(404);

      // Legacy path remains available when journey ACTIVE.
      expect((await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`)).status()).toBe(200);
      expect((await request.get(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`)).status()).toBe(200);

      const audits = await prisma.auditLog.findMany({
        where: {
          organizationId: fixtures.realOrgId!,
          action: { startsWith: "wexpay." },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      for (const audit of audits) {
        const blob = JSON.stringify(audit.metadataJson ?? {});
        expect(blob).not.toContain(plaintext);
        expect(blob).not.toContain(rotatedPlain);
      }
    } finally {
      await prisma.tableQrToken.deleteMany({ where: { tableId: table!.id } });
      await prisma.$disconnect();
    }
  });
});
