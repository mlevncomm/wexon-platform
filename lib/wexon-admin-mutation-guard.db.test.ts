import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/lib/wexon-admin-auth";
import { normalizePlatformAdminEmail } from "@/lib/wexon-platform-admin";
import { runAdminMutation, getSafeAdminActionErrorMessage } from "@/lib/wexon-admin-mutation-guard";
import { AdminMutationGuardError } from "@/lib/wexon-admin-mutation-errors";
import { enforceAdminMutationRateLimit } from "@/lib/wexon-admin-mutation-rate-limit";
import { generateAdminMutationKey } from "@/lib/wexon-admin-mutation-idempotency";
import { evaluateInvoiceStatusTransition } from "@/lib/wexon-admin-finance-policy";
import { isHostedDeploymentCleanupForbidden } from "@/lib/wexon-admin-mutation-policy";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);
const actorEmail = `padmin-pr5-${suffix}@wexon.dev`;
const actorSubject = `cf-sub-pr5-${suffix}`;

const ids: {
  platformAdmin?: string;
  orgA?: string;
  orgB?: string;
  product?: string;
  plan?: string;
  license?: string;
  subscription?: string;
} = {};

let actor: AdminSession;

before(async () => {
  const admin = await prisma.platformAdmin.create({
    data: {
      email: actorEmail,
      emailNormalized: normalizePlatformAdminEmail(actorEmail),
      displayName: "PR5 Admin",
      isActive: true,
      cloudflareSubject: actorSubject,
    },
  });
  ids.platformAdmin = admin.id;
  actor = {
    adminId: admin.id,
    email: normalizePlatformAdminEmail(actorEmail),
    cloudflareSubject: actorSubject,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  const product =
    (await prisma.product.findFirst({ where: { key: "wexpay" } })) ??
    (await prisma.product.create({
      data: { key: `wexpay-pr5-${suffix}`, name: "WexPay PR5", status: "ACTIVE", isActive: true },
    }));
  ids.product = product.id;

  const plan = await prisma.plan.create({
    data: {
      productId: product.id,
      key: `essential-pr5-${suffix}`,
      name: "Essential PR5",
      tierKey: "essential",
      sortOrder: 1,
      isActive: true,
      priceMonthly: 100,
      currency: "TRY",
      billingInterval: "MONTHLY",
    },
  });
  ids.plan = plan.id;

  const orgA = await prisma.organization.create({
    data: {
      name: `PR5 Org A ${suffix}`,
      slug: `pr5-org-a-${suffix}`,
      isActive: true,
      isDemo: true,
    },
  });
  ids.orgA = orgA.id;

  const orgB = await prisma.organization.create({
    data: {
      name: `PR5 Org B ${suffix}`,
      slug: `pr5-org-b-${suffix}`,
      isActive: true,
      isDemo: true,
    },
  });
  ids.orgB = orgB.id;

  const license = await prisma.license.create({
    data: {
      organizationId: orgA.id,
      productId: product.id,
      planId: plan.id,
      status: "ACTIVE",
      licenseType: "MONTHLY",
    },
  });
  ids.license = license.id;

  const subscription = await prisma.subscription.create({
    data: {
      organizationId: orgA.id,
      licenseId: license.id,
      planId: plan.id,
      status: "ACTIVE",
      interval: "MONTHLY",
      provider: "admin_manual",
      currentPeriodStart: new Date(),
    },
  });
  ids.subscription = subscription.id;
});

after(async () => {
  if (ids.orgA) {
    await prisma.billingPayment.deleteMany({ where: { organizationId: ids.orgA } });
    await prisma.invoice.deleteMany({ where: { organizationId: ids.orgA } });
    await prisma.subscription.deleteMany({ where: { organizationId: ids.orgA } });
    await prisma.license.deleteMany({ where: { organizationId: ids.orgA } });
    await prisma.organization.delete({ where: { id: ids.orgA } }).catch(() => undefined);
  }
  if (ids.orgB) {
    await prisma.invoice.deleteMany({ where: { organizationId: ids.orgB } });
    await prisma.organization.delete({ where: { id: ids.orgB } }).catch(() => undefined);
  }
  if (ids.plan) await prisma.plan.delete({ where: { id: ids.plan } }).catch(() => undefined);
  if (ids.platformAdmin) {
    await prisma.adminMutationIdempotency.deleteMany({ where: { adminId: ids.platformAdmin } });
    await prisma.adminMutationRateLimit.deleteMany({
      where: { bucketKey: { contains: ids.platformAdmin } },
    });
    await prisma.platformAdmin.delete({ where: { id: ids.platformAdmin } }).catch(() => undefined);
  }
  await prisma.platformAdmin.deleteMany({
    where: { emailNormalized: { contains: `padmin-pr5-` } },
  }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("PR5 admin mutation hardening DB", () => {
  async function mintActor(label: string): Promise<AdminSession> {
    const email = `padmin-pr5-${label}-${suffix}@wexon.dev`;
    const subject = `cf-sub-pr5-${label}-${suffix}`;
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        emailNormalized: normalizePlatformAdminEmail(email),
        displayName: `PR5 ${label}`,
        isActive: true,
        cloudflareSubject: subject,
      },
    });
    return {
      adminId: admin.id,
      email: normalizePlatformAdminEmail(email),
      cloudflareSubject: subject,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }

  it("atomically increments rate-limit buckets under concurrency", async () => {
    const adminId = `rl-stress-${suffix}`;
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        enforceAdminMutationRateLimit({
          adminId,
          riskClass: "FINANCIAL",
          organizationId: ids.orgA!,
          ipAddress: "127.0.0.1",
        }),
      ),
    );
    const limited = results.filter((r) => !r.ok);
    assert.ok(limited.length >= 1, "expected some requests to hit FINANCIAL short limit (8/min)");
  });

  it("creates a single invoice under concurrent identical idempotency keys", async () => {
    const mutationId = generateAdminMutationKey();
    const invoiceNo = `INV-PR5-${suffix}-conc`;
    const payload = {
      organizationId: ids.orgA!,
      subscriptionId: ids.subscription!,
      invoiceNo,
      status: "ISSUED" as const,
      subtotal: 100,
      tax: 20,
      total: 120,
      currency: "TRY",
    };

    const run = () =>
      runAdminMutation({
        action: "invoice.create",
        actor,
        organizationId: ids.orgA!,
        entityType: "Invoice",
        mutationId,
        confirmed: true,
        reason: "eşzamanlı fatura kanıtı",
        requestHashPayload: payload,
        execute: async ({ tx }) => {
          const invoice = await tx.invoice.create({
            data: {
              organizationId: payload.organizationId,
              subscriptionId: payload.subscriptionId,
              invoiceNo: payload.invoiceNo,
              status: payload.status,
              subtotal: payload.subtotal,
              tax: payload.tax,
              total: payload.total,
              currency: payload.currency,
              issuedAt: new Date(),
            },
          });
          return {
            organizationId: ids.orgA!,
            entityId: invoice.id,
            replayResult: { invoiceId: invoice.id },
          };
        },
      });

    const settled = await Promise.allSettled([run(), run()]);
    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    assert.ok(fulfilled.length >= 1);
    const count = await prisma.invoice.count({ where: { invoiceNo } });
    assert.equal(count, 1);
  });

  it("rejects same idempotency key with different payload", async () => {
    const mutationId = generateAdminMutationKey();
    await runAdminMutation({
      action: "invoice.create",
      actor,
      organizationId: ids.orgA!,
      entityType: "Invoice",
      mutationId,
      confirmed: true,
      reason: "ilk fatura payload",
      requestHashPayload: { n: 1 },
      execute: async ({ tx }) => {
        const invoice = await tx.invoice.create({
          data: {
            organizationId: ids.orgA!,
            invoiceNo: `INV-PR5-${suffix}-a`,
            status: "DRAFT",
            subtotal: 10,
            tax: 0,
            total: 10,
            currency: "TRY",
          },
        });
        return { entityId: invoice.id, organizationId: ids.orgA!, replayResult: { invoiceId: invoice.id } };
      },
    });

    await assert.rejects(
      () =>
        runAdminMutation({
          action: "invoice.create",
          actor,
          organizationId: ids.orgA!,
          entityType: "Invoice",
          mutationId,
          confirmed: true,
          reason: "farklı fatura payload",
          requestHashPayload: { n: 2 },
          execute: async () => ({ entityId: "x" }),
        }),
      (error: unknown) =>
        error instanceof AdminMutationGuardError && error.code === "idempotency_conflict",
    );
  });

  it("keeps PAID invoice terminal under concurrent transitions", async () => {
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ids.orgA!,
        invoiceNo: `INV-PR5-${suffix}-paid`,
        status: "ISSUED",
        subtotal: 50,
        tax: 0,
        total: 50,
        currency: "TRY",
        issuedAt: new Date(),
      },
    });

    const toPaid = () =>
      runAdminMutation({
        action: "invoice.status_change",
        actor,
        organizationId: ids.orgA!,
        entityType: "Invoice",
        entityId: invoice.id,
        confirmed: true,
        reason: "ödeme geçişi kanıtı",
        execute: async ({ tx }) => {
          const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
          const transition = evaluateInvoiceStatusTransition(current.status, "PAID");
          if (!transition.ok) throw new AdminMutationGuardError("invalid_state_transition", transition.message);
          if (transition.kind === "noop") {
            return { entityId: invoice.id, organizationId: ids.orgA!, transition: "noop" };
          }
          const updated = await tx.invoice.updateMany({
            where: { id: invoice.id, status: current.status },
            data: { status: "PAID", paidAt: current.paidAt ?? new Date() },
          });
          if (updated.count === 0) {
            throw new AdminMutationGuardError("stale_version", "stale");
          }
          return {
            entityId: invoice.id,
            organizationId: ids.orgA!,
            before: { status: current.status },
            after: { status: "PAID" },
            transition: `${current.status}->PAID`,
          };
        },
      });

    await Promise.allSettled([toPaid(), toPaid()]);
    const final = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(final.status, "PAID");
    assert.ok(final.paidAt);

    await assert.rejects(
      () =>
        runAdminMutation({
          action: "invoice.status_change",
          actor,
          organizationId: ids.orgA!,
          entityType: "Invoice",
          entityId: invoice.id,
          confirmed: true,
          reason: "terminal ihlali denemesi",
          execute: async () => {
            const transition = evaluateInvoiceStatusTransition("PAID", "DRAFT");
            if (!transition.ok) throw new AdminMutationGuardError("invalid_state_transition", transition.message);
            return { entityId: invoice.id };
          },
        }),
      (error: unknown) =>
        error instanceof AdminMutationGuardError && error.code === "invalid_state_transition",
    );
  });

  it("rejects cross-tenant invoice subscription binding", async () => {
    await assert.rejects(
      () =>
        runAdminMutation({
          action: "invoice.create",
          actor,
          organizationId: ids.orgB!,
          entityType: "Invoice",
          mutationId: generateAdminMutationKey(),
          confirmed: true,
          reason: "cross tenant denemesi",
          requestHashPayload: { org: ids.orgB, sub: ids.subscription },
          execute: async ({ tx }) => {
            const subscription = await tx.subscription.findUnique({ where: { id: ids.subscription! } });
            if (!subscription || subscription.organizationId !== ids.orgB) {
              throw new AdminMutationGuardError("tenant_mismatch", "Abonelik bu organizasyona ait değil.");
            }
            return { entityId: "x" };
          },
        }),
      (error: unknown) => error instanceof AdminMutationGuardError && error.code === "tenant_mismatch",
    );
  });

  it("rolls back mutation when success audit fails", async () => {
    const before = await prisma.invoice.count({ where: { organizationId: ids.orgA! } });
    await assert.rejects(async () => {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.create({
          data: {
            organizationId: ids.orgA!,
            invoiceNo: `INV-PR5-${suffix}-audit-fail`,
            status: "DRAFT",
            subtotal: 1,
            tax: 0,
            total: 1,
            currency: "TRY",
          },
        });
        throw new Error("forced audit failure");
      });
    });
    const after = await prisma.invoice.count({ where: { organizationId: ids.orgA! } });
    assert.equal(after, before);
  });

  it("fails closed when PlatformAdmin deactivated mid-transaction", async () => {
    await assert.rejects(
      () =>
        runAdminMutation({
          action: "invoice.status_change",
          actor: { ...actor, adminId: "missing-admin-id" },
          organizationId: ids.orgA!,
          entityType: "Invoice",
          confirmed: true,
          reason: "pasif admin denemesi",
          execute: async () => ({ entityId: "x" }),
        }),
      (error: unknown) =>
        error instanceof AdminMutationGuardError && error.code === "inactive_admin",
    );
  });

  it("does not leak internal errors to safe UI mapper", () => {
    const msg = getSafeAdminActionErrorMessage(
      new Error('PrismaClientKnownRequestError: Unique constraint failed on the fields: (`invoiceNo`)'),
    );
    assert.match(msg, /sayfayı yenileyip tekrar deneyin/i);
    assert.ok(!msg.includes("Prisma"));
    assert.ok(!msg.includes("invoiceNo"));
  });

  it("keeps hosted cleanup fail-closed", () => {
    assert.equal(isHostedDeploymentCleanupForbidden({ VERCEL_ENV: "preview" }), true);
    assert.equal(isHostedDeploymentCleanupForbidden({ VERCEL_ENV: "production" }), true);
  });

  it("writes denied audit path for confirmation missing without mutation", async () => {
    const beforeInvoices = await prisma.invoice.count({ where: { organizationId: ids.orgA! } });
    await assert.rejects(
      () =>
        runAdminMutation({
          action: "invoice.create",
          actor,
          organizationId: ids.orgA!,
          entityType: "Invoice",
          mutationId: generateAdminMutationKey(),
          confirmed: false,
          reason: "yetersiz",
          requestHashPayload: { x: 1 },
          execute: async () => ({ entityId: "should-not-run" }),
        }),
      (error: unknown) =>
        error instanceof AdminMutationGuardError && error.code === "confirmation_missing",
    );
    const afterInvoices = await prisma.invoice.count({ where: { organizationId: ids.orgA! } });
    assert.equal(afterInvoices, beforeInvoices);
  });

  it("persists FAILED idempotency row after known mutation failure", async () => {
    const localActor = await mintActor("fail-finalizer");
    const mutationId = generateAdminMutationKey();
    await assert.rejects(
      () =>
        runAdminMutation({
          action: "invoice.create",
          actor: localActor,
          organizationId: ids.orgA!,
          entityType: "Invoice",
          mutationId,
          confirmed: true,
          reason: "bilinen hata finalizer kanıtı",
          requestHashPayload: { fail: true },
          execute: async () => {
            throw new AdminMutationGuardError("finance_invariant_failed", "bilinçli hata");
          },
        }),
      (error: unknown) =>
        error instanceof AdminMutationGuardError && error.code === "finance_invariant_failed",
    );

    const row = await prisma.adminMutationIdempotency.findUnique({
      where: {
        adminId_action_mutationKey: {
          adminId: localActor.adminId,
          action: "invoice.create",
          mutationKey: mutationId,
        },
      },
    });
    assert.ok(row);
    assert.equal(row!.status, "FAILED");
    assert.equal(row!.denyCode, "finance_invariant_failed");

    // Same key + same payload may retry after FAILED.
    const invoiceNo = `INV-PR5-${suffix}-retry`;
    const ok = await runAdminMutation({
      action: "invoice.create",
      actor: localActor,
      organizationId: ids.orgA!,
      entityType: "Invoice",
      mutationId,
      confirmed: true,
      reason: "failed sonrası retry",
      requestHashPayload: { fail: true },
      execute: async ({ tx }) => {
        const invoice = await tx.invoice.create({
          data: {
            organizationId: ids.orgA!,
            invoiceNo,
            status: "DRAFT",
            subtotal: 5,
            tax: 0,
            total: 5,
            currency: "TRY",
          },
        });
        return { entityId: invoice.id, organizationId: ids.orgA!, replayResult: { invoiceId: invoice.id } };
      },
    });
    assert.ok(ok.entityId);
    const after = await prisma.adminMutationIdempotency.findUniqueOrThrow({
      where: {
        adminId_action_mutationKey: {
          adminId: localActor.adminId,
          action: "invoice.create",
          mutationKey: mutationId,
        },
      },
    });
    assert.equal(after.status, "SUCCEEDED");
  });

  it("does not auto-PAID invoice on partial payment; settles on full outstanding", async () => {
    const localActor = await mintActor("coverage");
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ids.orgA!,
        invoiceNo: `INV-PR5-${suffix}-cov`,
        status: "ISSUED",
        subtotal: 100,
        tax: 0,
        total: 100,
        currency: "TRY",
        issuedAt: new Date(),
      },
    });

    await runAdminMutation({
      action: "billing_payment.create",
      actor: localActor,
      organizationId: ids.orgA!,
      entityType: "BillingPayment",
      mutationId: generateAdminMutationKey(),
      confirmed: true,
      reason: "kısmi tahsilat kanıtı",
      requestHashPayload: { invoiceId: invoice.id, amount: 40 },
      execute: async ({ tx }) => {
        const paidAgg = await tx.billingPayment.aggregate({
          where: { invoiceId: invoice.id, status: "PAID" },
          _sum: { amount: true },
        });
        const { evaluateInvoicePaymentCoverage, toMinorUnits } = await import(
          "@/lib/wexon-admin-finance-policy"
        );
        const coverage = evaluateInvoicePaymentCoverage({
          invoiceTotal: 100,
          paidCoverageMinor: toMinorUnits(Number(paidAgg._sum.amount ?? 0)),
          newPaymentAmount: 40,
        });
        assert.equal(coverage.invoiceAutoPaid, false);
        const payment = await tx.billingPayment.create({
          data: {
            organizationId: ids.orgA!,
            invoiceId: invoice.id,
            amount: 40,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            paidAt: new Date(),
          },
        });
        return {
          entityId: payment.id,
          organizationId: ids.orgA!,
          metadata: {
            outstandingBefore: coverage.outstandingBeforeMinor / 100,
            paidCoverageAfter: coverage.paidCoverageAfterMinor / 100,
            invoiceAutoPaid: coverage.invoiceAutoPaid,
          },
          replayResult: { paymentId: payment.id },
        };
      },
    });

    let current = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(current.status, "ISSUED");

    await runAdminMutation({
      action: "billing_payment.create",
      actor: localActor,
      organizationId: ids.orgA!,
      entityType: "BillingPayment",
      mutationId: generateAdminMutationKey(),
      confirmed: true,
      reason: "kalan bakiyeyi kapatan tahsilat",
      requestHashPayload: { invoiceId: invoice.id, amount: 60 },
      execute: async ({ tx }) => {
        const paidAgg = await tx.billingPayment.aggregate({
          where: { invoiceId: invoice.id, status: "PAID" },
          _sum: { amount: true },
        });
        const { evaluateInvoicePaymentCoverage, toMinorUnits, evaluateInvoiceStatusTransition } =
          await import("@/lib/wexon-admin-finance-policy");
        const coverage = evaluateInvoicePaymentCoverage({
          invoiceTotal: 100,
          paidCoverageMinor: toMinorUnits(Number(paidAgg._sum.amount ?? 0)),
          newPaymentAmount: 60,
        });
        assert.equal(coverage.invoiceAutoPaid, true);
        const payment = await tx.billingPayment.create({
          data: {
            organizationId: ids.orgA!,
            invoiceId: invoice.id,
            amount: 60,
            currency: "TRY",
            status: "PAID",
            provider: "admin_manual",
            paidAt: new Date(),
          },
        });
        const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
        const transition = evaluateInvoiceStatusTransition(inv.status, "PAID");
        if (transition.ok && transition.kind === "apply") {
          await tx.invoice.updateMany({
            where: { id: invoice.id, status: inv.status },
            data: { status: "PAID", paidAt: inv.paidAt ?? new Date() },
          });
        }
        return {
          entityId: payment.id,
          organizationId: ids.orgA!,
          metadata: { invoiceAutoPaid: true },
          replayResult: { paymentId: payment.id },
        };
      },
    });

    current = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(current.status, "PAID");
  });

  it("denies invoice PAID status without sufficient PAID coverage", async () => {
    const localActor = await mintActor("nocov");
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ids.orgA!,
        invoiceNo: `INV-PR5-${suffix}-nocov`,
        status: "ISSUED",
        subtotal: 80,
        tax: 0,
        total: 80,
        currency: "TRY",
        issuedAt: new Date(),
      },
    });
    await assert.rejects(
      () =>
        runAdminMutation({
          action: "invoice.status_change",
          actor: localActor,
          organizationId: ids.orgA!,
          entityType: "Invoice",
          entityId: invoice.id,
          confirmed: true,
          reason: "coverage olmadan paid denemesi",
          execute: async ({ tx }) => {
            const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
            const paidAgg = await tx.billingPayment.aggregate({
              where: { invoiceId: inv.id, status: "PAID" },
              _sum: { amount: true },
            });
            const { assertInvoicePaidCoverageSufficient, toMinorUnits } = await import(
              "@/lib/wexon-admin-finance-policy"
            );
            const coverage = assertInvoicePaidCoverageSufficient({
              invoiceTotal: Number(inv.total),
              paidCoverageMinor: toMinorUnits(Number(paidAgg._sum.amount ?? 0)),
            });
            if (!coverage.ok) {
              throw new AdminMutationGuardError("finance_invariant_failed", coverage.message);
            }
            return { entityId: inv.id };
          },
        }),
      (error: unknown) =>
        error instanceof AdminMutationGuardError &&
        error.code === "finance_invariant_failed" &&
        /yeterli PAID tahsilat/i.test(error.safeMessage),
    );
  });

  it("enforces global rate limit across different IPs for same admin", async () => {
    const adminId = `global-rl-${suffix}`;
    const results = await Promise.all(
      Array.from({ length: 62 }, (_, i) =>
        enforceAdminMutationRateLimit({
          adminId,
          riskClass: "NORMAL",
          organizationId: null,
          ipAddress: `10.0.0.${(i % 50) + 1}`,
        }),
      ),
    );
    const limited = results.filter((r) => !r.ok);
    assert.ok(limited.length >= 1, "expected global 60/min backstop to deny some requests");
    const firstDeny = limited.find((r) => !r.ok && "shouldAuditDeny" in r && r.shouldAuditDeny);
    assert.ok(firstDeny, "expected coalesced first-deny audit marker");
  });
});
