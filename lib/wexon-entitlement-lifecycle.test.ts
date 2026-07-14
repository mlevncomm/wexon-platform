import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import { isEntitlementEnabled } from "@/lib/wexon-core-access";
import {
  assertEntitlementPhysicalDeleteForbidden,
  setEntitlementActiveState,
} from "@/lib/wexon-entitlement-lifecycle";
import { prisma } from "@/lib/prisma";

describe("wexon entitlement lifecycle", () => {
  let planId = "";
  let entitlementId = "";
  const actor = { email: "lifecycle-test@wexon.dev" };

  before(async () => {
    const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
    if (!product) throw new Error("Seed required: wexpay product");

    const plan = await prisma.plan.findFirst({
      where: {
        productId: product.id,
        OR: [{ tierKey: "essential" }, { key: "wexpay_essential" }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!plan) throw new Error("Seed required: essential plan");
    planId = plan.id;

    const entitlement = await prisma.entitlement.create({
      data: {
        planId,
        key: `lifecycle_test_${Date.now()}`,
        valueType: "BOOLEAN",
        valueBool: true,
        isActive: true,
      },
    });
    entitlementId = entitlement.id;
  });

  after(async () => {
    if (entitlementId) {
      await prisma.auditLog
        .deleteMany({ where: { entityType: "Entitlement", entityId: entitlementId } })
        .catch(() => undefined);
      await prisma.entitlement.delete({ where: { id: entitlementId } }).catch(() => undefined);
    }
  });

  it("rejects unauthorized lifecycle mutation", async () => {
    await assert.rejects(
      () =>
        setEntitlementActiveState({
          actor: null,
          planId,
          entitlementId,
          isActive: false,
        }),
      (error: unknown) => error instanceof AdminValidationError,
    );
  });

  it("deactivates and reactivates entitlement with audit trail", async () => {
    const deactivated = await setEntitlementActiveState({
      actor,
      planId,
      entitlementId,
      isActive: false,
      note: "test deactivate",
    });
    assert.equal(deactivated.previousIsActive, true);
    assert.equal(deactivated.nextIsActive, false);

    const row = await prisma.entitlement.findUnique({ where: { id: entitlementId } });
    assert.equal(row?.isActive, false);
    assert.ok(row?.deactivatedAt);

    const reactivated = await setEntitlementActiveState({
      actor,
      planId,
      entitlementId,
      isActive: true,
      note: "test reactivate",
    });
    assert.equal(reactivated.previousIsActive, false);
    assert.equal(reactivated.nextIsActive, true);

    const auditCount = await prisma.auditLog.count({
      where: {
        entityType: "Entitlement",
        entityId: entitlementId,
        action: { in: ["admin.entitlement.deactivated", "admin.entitlement.reactivated"] },
      },
    });
    assert.ok(auditCount >= 2);
  });

  it("forbids physical delete helper", () => {
    assert.throws(() => assertEntitlementPhysicalDeleteForbidden(), AdminValidationError);
  });

  it("treats inactive entitlements as disabled in resolver", async () => {
    await setEntitlementActiveState({
      actor,
      planId,
      entitlementId,
      isActive: false,
    });

    const entitlement = await prisma.entitlement.findUnique({ where: { id: entitlementId } });
    assert.equal(entitlement?.isActive, false);

    const activeOnly = await prisma.entitlement.findMany({
      where: { planId, isActive: true, id: entitlementId },
    });
    assert.equal(activeOnly.length, 0);
    assert.equal(isEntitlementEnabled({}, entitlement?.key ?? "missing"), false);

    await setEntitlementActiveState({
      actor,
      planId,
      entitlementId,
      isActive: true,
    });
  });
});
