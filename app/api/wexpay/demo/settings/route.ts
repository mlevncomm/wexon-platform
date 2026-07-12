import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../_access";
import { errorResponse } from "../_utils";

type DemoOpsSettings = {
  serviceFeeRate: number;
  qrOrderEnabled: boolean;
  qrPaymentEnabled: boolean;
  receiptRequestEnabled: boolean;
};

const DEFAULT_OPS: DemoOpsSettings = {
  serviceFeeRate: 0,
  qrOrderEnabled: true,
  qrPaymentEnabled: true,
  receiptRequestEnabled: true,
};

function readOpsSettings(settingsJson: unknown): DemoOpsSettings {
  if (!settingsJson || typeof settingsJson !== "object") return { ...DEFAULT_OPS };
  const source = settingsJson as Record<string, unknown>;
  const rate = Number(source.serviceFeeRate);
  return {
    serviceFeeRate: Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_OPS.serviceFeeRate,
    qrOrderEnabled:
      typeof source.qrOrderEnabled === "boolean" ? source.qrOrderEnabled : DEFAULT_OPS.qrOrderEnabled,
    qrPaymentEnabled:
      typeof source.qrPaymentEnabled === "boolean"
        ? source.qrPaymentEnabled
        : DEFAULT_OPS.qrPaymentEnabled,
    receiptRequestEnabled:
      typeof source.receiptRequestEnabled === "boolean"
        ? source.receiptRequestEnabled
        : DEFAULT_OPS.receiptRequestEnabled,
  };
}

export async function GET() {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const organization = await prisma.organization.findUnique({
      where: { id: demo.organizationId },
      select: { id: true, name: true, phone: true, email: true },
    });

    const ops = readOpsSettings(demo.coreAccess.installation.settingsJson);

    return Response.json({
      restaurant: {
        id: demo.restaurant.id,
        name: demo.restaurant.name,
        slug: demo.restaurant.slug,
      },
      branch: {
        id: demo.branch.id,
        name: demo.branch.name,
        slug: demo.branch.slug,
        address: demo.branch.address,
      },
      organization: {
        id: organization?.id ?? demo.organizationId,
        name: organization?.name ?? demo.restaurant.name,
        phone: organization?.phone ?? null,
        email: organization?.email ?? null,
      },
      operations: ops,
    });
  } catch {
    return errorResponse("İşletme ayarları alınırken bir sorun oluştu.", 500);
  }
}

type PatchBody = {
  restaurantName?: unknown;
  branchName?: unknown;
  address?: unknown;
  phone?: unknown;
  serviceFeeRate?: unknown;
  qrOrderEnabled?: unknown;
  qrPaymentEnabled?: unknown;
  receiptRequestEnabled?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as PatchBody;
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const restaurantName =
      typeof body.restaurantName === "string" ? body.restaurantName.trim() : null;
    const branchName = typeof body.branchName === "string" ? body.branchName.trim() : null;
    const address = typeof body.address === "string" ? body.address.trim() : null;
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;

    if (restaurantName !== null && restaurantName.length === 0) {
      return errorResponse("Restoran adı boş olamaz.", 400);
    }
    if (branchName !== null && branchName.length === 0) {
      return errorResponse("Şube adı boş olamaz.", 400);
    }

    const currentOps = readOpsSettings(demo.coreAccess.installation.settingsJson);
    const nextOps: DemoOpsSettings = {
      serviceFeeRate:
        body.serviceFeeRate === undefined
          ? currentOps.serviceFeeRate
          : Number(body.serviceFeeRate),
      qrOrderEnabled:
        typeof body.qrOrderEnabled === "boolean" ? body.qrOrderEnabled : currentOps.qrOrderEnabled,
      qrPaymentEnabled:
        typeof body.qrPaymentEnabled === "boolean"
          ? body.qrPaymentEnabled
          : currentOps.qrPaymentEnabled,
      receiptRequestEnabled:
        typeof body.receiptRequestEnabled === "boolean"
          ? body.receiptRequestEnabled
          : currentOps.receiptRequestEnabled,
    };

    if (!Number.isFinite(nextOps.serviceFeeRate) || nextOps.serviceFeeRate < 0 || nextOps.serviceFeeRate > 100) {
      return errorResponse("Servis ücreti 0-100 arasında olmalıdır.", 400);
    }

    const organization = await prisma.$transaction(async (tx) => {
      if (restaurantName) {
        await tx.restaurant.update({
          where: { id: demo.restaurant.id },
          data: { name: restaurantName },
        });
      }

      if (branchName !== null || address !== null) {
        await tx.branch.update({
          where: { id: demo.branch.id },
          data: {
            ...(branchName ? { name: branchName } : {}),
            ...(address !== null ? { address: address || null } : {}),
          },
        });
      }

      if (phone !== null) {
        await tx.organization.update({
          where: { id: demo.organizationId },
          data: { phone: phone || null },
        });
      }

      const existing = demo.coreAccess.installation.settingsJson;
      const merged =
        existing && typeof existing === "object" && !Array.isArray(existing)
          ? { ...(existing as Record<string, unknown>), ...nextOps }
          : { ...nextOps };

      await tx.appInstallation.update({
        where: { id: demo.coreAccess.installation.id },
        data: { settingsJson: merged },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.settings.updated",
          entityType: "AppInstallation",
          entityId: demo.coreAccess.installation.id,
          metadata: {
            restaurantName,
            branchName,
            address,
            phone,
            operations: nextOps,
          },
        },
        tx,
      );

      return tx.organization.findUnique({
        where: { id: demo.organizationId },
        select: { id: true, name: true, phone: true, email: true },
      });
    });

    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: demo.restaurant.id },
    });
    const branch = await prisma.branch.findUniqueOrThrow({
      where: { id: demo.branch.id },
    });

    return Response.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      branch: {
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
        address: branch.address,
      },
      organization: {
        id: organization?.id ?? demo.organizationId,
        name: organization?.name ?? restaurant.name,
        phone: organization?.phone ?? null,
        email: organization?.email ?? null,
      },
      operations: nextOps,
    });
  } catch {
    return errorResponse("İşletme ayarları kaydedilirken bir sorun oluştu.", 500);
  }
}
