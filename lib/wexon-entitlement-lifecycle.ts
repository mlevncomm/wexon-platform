/**
 * Admin entitlement soft-deactivation. Never physically deletes entitlement rows.
 */

import { prisma } from "@/lib/prisma";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import type { AdminSession } from "@/lib/wexon-admin-auth";

export type EntitlementActiveMutationInput = {
  actor: AdminSession | null;
  planId: string;
  entitlementId: string;
  /** true = reactivate, false = deactivate */
  isActive: boolean;
  note?: string | null;
};

export type EntitlementActiveMutationResult = {
  id: string;
  planId: string;
  key: string;
  previousIsActive: boolean;
  nextIsActive: boolean;
};

function requireActor(actor: AdminSession | null): AdminSession {
  if (!actor?.email) {
    throw new AdminValidationError("Yetkisiz işlem: admin oturumu gerekli.");
  }
  return actor;
}

export async function setEntitlementActiveState(
  input: EntitlementActiveMutationInput,
): Promise<EntitlementActiveMutationResult> {
  const actor = requireActor(input.actor);
  const note = (input.note ?? "").trim() || null;
  const nextIsActive = input.isActive;

  return prisma.$transaction(async (tx) => {
    const entitlement = await tx.entitlement.findFirst({
      where: { id: input.entitlementId, planId: input.planId },
      include: { plan: { select: { id: true, key: true, name: true } } },
    });
    if (!entitlement) {
      throw new AdminValidationError("Limit kaydı bulunamadı.");
    }

    const previousIsActive = entitlement.isActive;
    if (previousIsActive === nextIsActive) {
      return {
        id: entitlement.id,
        planId: entitlement.planId,
        key: entitlement.key,
        previousIsActive,
        nextIsActive,
      };
    }

    const updated = await tx.entitlement.update({
      where: { id: entitlement.id },
      data: {
        isActive: nextIsActive,
        deactivatedAt: nextIsActive ? null : new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: null,
        userId: null,
        action: nextIsActive ? "admin.entitlement.reactivated" : "admin.entitlement.deactivated",
        entityType: "Entitlement",
        entityId: entitlement.id,
        metadataJson: {
          actor: { type: "admin_session", email: actor.email },
          source: "admin_entitlement_lifecycle",
          planId: entitlement.planId,
          planKey: entitlement.plan.key,
          planName: entitlement.plan.name,
          entitlementKey: entitlement.key,
          previousIsActive,
          nextIsActive: updated.isActive,
          previousValue: {
            valueType: entitlement.valueType,
            valueBool: entitlement.valueBool,
            valueInt: entitlement.valueInt,
            valueString: entitlement.valueString,
            isActive: previousIsActive,
            deactivatedAt: entitlement.deactivatedAt,
          },
          nextValue: {
            valueType: updated.valueType,
            valueBool: updated.valueBool,
            valueInt: updated.valueInt,
            valueString: updated.valueString,
            isActive: updated.isActive,
            deactivatedAt: updated.deactivatedAt,
          },
          note,
          at: new Date().toISOString(),
        },
      },
    });

    return {
      id: updated.id,
      planId: updated.planId,
      key: updated.key,
      previousIsActive,
      nextIsActive: updated.isActive,
    };
  });
}

/** Physical delete is intentionally unsupported in production admin flows. */
export function assertEntitlementPhysicalDeleteForbidden(): never {
  throw new AdminValidationError("Entitlement satırları silinemez; devre dışı bırakın.");
}
