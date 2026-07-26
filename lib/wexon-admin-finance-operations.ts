/**
 * Server-only admin finance / commercial create operations.
 *
 * Actions are thin adapters; DB tests call these helpers inside runAdminMutation
 * so concurrency proofs exercise production settlement logic.
 *
 * Lock order (inside runAdminMutation transaction):
 * 1) PlatformAdmin FOR UPDATE (guard)
 * 2) Idempotency row FOR UPDATE (idempotent creates)
 * 3) Invoice advisory OR org+product commercial-create advisory
 * 4) Post-lock domain reads → validation → mutation → success audit → commit
 */

import type { InvoiceStatus, Prisma } from ".prisma/client";
import type { AdminMutationExecuteResult } from "@/lib/wexon-admin-mutation-guard";
import { AdminMutationGuardError } from "@/lib/wexon-admin-mutation-errors";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import {
  assertInvoicePaidCoverageSufficient,
  evaluateBillingPaymentStatusTransition,
  evaluateInvoicePaymentCoverage,
  evaluateInvoiceStatusTransition,
  toMinorUnits,
} from "@/lib/wexon-admin-finance-policy";
import { syncSubscriptionAccessState } from "@/lib/wexon-subscription-lifecycle";

export type FinanceTx = Prisma.TransactionClient;

export const ADMIN_INVOICE_MUTATION_LOCK_NAMESPACE = "admin:invoice-mutation";
export const ADMIN_ORG_PRODUCT_COMMERCIAL_CREATE_LOCK_NAMESPACE =
  "admin:organization-product-commercial-create";

/** Non-terminal licenses that block a second active commercial seat for org+product. */
export const NON_TERMINAL_LICENSE_STATUSES = ["ACTIVE", "TRIAL", "PAST_DUE"] as const;

/** Subscription create may only start in these statuses. */
export const SUBSCRIPTION_CREATE_STATUSES = ["ACTIVE", "TRIALING"] as const;
export type SubscriptionCreateStatus = (typeof SUBSCRIPTION_CREATE_STATUSES)[number];

const RECONCILIATION_REQUIRED_MESSAGE =
  "Bu iade fatura PAID bakiyesini bozar. Önce reconciliation / credit-note akışını tamamlayın.";

const LICENSE_PLAN_MISMATCH_MESSAGE =
  "Mevcut lisans farklı bir pakete bağlı. Önce paket değişikliği işlemini tamamlayın.";

const DUPLICATE_LICENSE_MESSAGE =
  "Bu organizasyon ve ürün için zaten aktif (veya deneme/gecikmiş) bir lisans var.";

export async function lockAdminInvoiceForMutation(tx: FinanceTx, invoiceId: string): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${ADMIN_INVOICE_MUTATION_LOCK_NAMESPACE}),
      hashtext(${invoiceId})
    )
  `;
}

export async function lockAdminOrganizationProductCommercialCreate(
  tx: FinanceTx,
  organizationId: string,
  productId: string,
): Promise<void> {
  const entity = `${organizationId}:${productId}`;
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${ADMIN_ORG_PRODUCT_COMMERCIAL_CREATE_LOCK_NAMESPACE}),
      hashtext(${entity})
    )
  `;
}

export function assertSubscriptionCreateStatus(
  status: string,
): asserts status is SubscriptionCreateStatus {
  if (!(SUBSCRIPTION_CREATE_STATUSES as readonly string[]).includes(status)) {
    throw new AdminValidationError(
      "Yeni abonelik yalnız Deneme (TRIALING) veya Aktif (ACTIVE) durumunda oluşturulabilir.",
    );
  }
}

export function mapSubscriptionCreateStatusToLicenseStatus(
  status: SubscriptionCreateStatus,
): "ACTIVE" | "TRIAL" {
  return status === "TRIALING" ? "TRIAL" : "ACTIVE";
}

async function sumPaidCoverageMinor(
  tx: FinanceTx,
  invoiceId: string,
  excludePaymentId?: string,
): Promise<number> {
  const paidAgg = await tx.billingPayment.aggregate({
    where: {
      invoiceId,
      status: "PAID",
      ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
    },
    _sum: { amount: true },
  });
  return toMinorUnits(Number(paidAgg._sum.amount ?? 0));
}

async function maybeAutoSettleInvoice(
  tx: FinanceTx,
  invoice: { id: string; status: InvoiceStatus; total: Prisma.Decimal | number; paidAt: Date | null },
  coverage: ReturnType<typeof evaluateInvoicePaymentCoverage>,
): Promise<boolean> {
  if (!coverage.invoiceAutoPaid) return false;
  if (invoice.status === "PAID") return false;
  const transition = evaluateInvoiceStatusTransition(invoice.status, "PAID");
  if (!transition.ok) {
    throw new AdminMutationGuardError("invalid_state_transition", transition.message);
  }
  if (transition.kind === "noop") return false;
  const settled = await tx.invoice.updateMany({
    where: { id: invoice.id, status: invoice.status },
    data: { status: "PAID", paidAt: invoice.paidAt ?? new Date() },
  });
  if (settled.count === 0) {
    throw new AdminMutationGuardError(
      "stale_version",
      "Fatura durumu başka bir işlem tarafından değiştirilmiş. Sayfayı yenileyin.",
    );
  }
  return true;
}

export type CreateBillingPaymentInput = {
  organizationId: string;
  invoiceId: string | null;
  subscriptionId: string | null;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  provider: string | null;
  providerRef: string | null;
};

export async function executeCreateBillingPayment(
  tx: FinanceTx,
  payload: CreateBillingPaymentInput,
): Promise<AdminMutationExecuteResult> {
  let coverageMeta: Record<string, unknown> | null = null;

  if (payload.subscriptionId) {
    const subscription = await tx.subscription.findUnique({ where: { id: payload.subscriptionId } });
    if (!subscription || subscription.organizationId !== payload.organizationId) {
      throw new AdminMutationGuardError("tenant_mismatch", "Abonelik bu organizasyona ait değil.");
    }
  }

  if (payload.invoiceId) {
    await lockAdminInvoiceForMutation(tx, payload.invoiceId);
    const invoice = await tx.invoice.findUnique({ where: { id: payload.invoiceId } });
    if (!invoice || invoice.organizationId !== payload.organizationId) {
      throw new AdminMutationGuardError("tenant_mismatch", "Fatura bu organizasyona ait değil.");
    }
    if (invoice.currency !== payload.currency) {
      throw new AdminValidationError("Tahsilat para birimi fatura ile uyuşmalıdır.");
    }

    if (payload.status === "PAID") {
      const paidCoverageMinor = await sumPaidCoverageMinor(tx, payload.invoiceId);
      const coverage = evaluateInvoicePaymentCoverage({
        invoiceTotal: Number(invoice.total),
        paidCoverageMinor,
        newPaymentAmount: Number(payload.amount),
      });
      coverageMeta = {
        outstandingBefore: coverage.outstandingBeforeMinor / 100,
        paidCoverageAfter: coverage.paidCoverageAfterMinor / 100,
        invoiceAutoPaid: coverage.invoiceAutoPaid,
      };
      if (coverage.overpayment) {
        throw new AdminMutationGuardError(
          "finance_invariant_failed",
          "Tahsilat tutarı fatura kalan bakiyesini aşıyor.",
        );
      }

      const payment = await tx.billingPayment.create({
        data: {
          organizationId: payload.organizationId,
          invoiceId: payload.invoiceId,
          subscriptionId: payload.subscriptionId,
          amount: payload.amount,
          currency: payload.currency,
          status: payload.status,
          provider: payload.provider,
          providerRef: payload.providerRef,
          paidAt: new Date(),
        },
      });

      const settled = await maybeAutoSettleInvoice(tx, invoice, coverage);
      coverageMeta = { ...coverageMeta, invoiceAutoPaid: settled || coverage.invoiceAutoPaid };

      return {
        organizationId: payload.organizationId,
        entityId: payment.id,
        after: {
          amount: String(payment.amount),
          status: payment.status,
          invoiceId: payment.invoiceId,
          provider: payment.provider,
        },
        metadata: {
          providerRefMasked: payment.providerRef ? `${payment.providerRef.slice(0, 4)}…` : null,
          ...coverageMeta,
        },
        replayResult: { paymentId: payment.id },
      };
    }
  }

  const payment = await tx.billingPayment.create({
    data: {
      organizationId: payload.organizationId,
      invoiceId: payload.invoiceId,
      subscriptionId: payload.subscriptionId,
      amount: payload.amount,
      currency: payload.currency,
      status: payload.status,
      provider: payload.provider,
      providerRef: payload.providerRef,
      paidAt: payload.status === "PAID" ? new Date() : null,
    },
  });

  return {
    organizationId: payload.organizationId,
    entityId: payment.id,
    after: {
      amount: String(payment.amount),
      status: payment.status,
      invoiceId: payment.invoiceId,
      provider: payment.provider,
    },
    metadata: {
      providerRefMasked: payment.providerRef ? `${payment.providerRef.slice(0, 4)}…` : null,
      ...(coverageMeta ?? {}),
    },
    replayResult: { paymentId: payment.id },
  };
}

export async function executeUpdateBillingPaymentStatus(
  tx: FinanceTx,
  paymentId: string,
  nextStatus: string,
): Promise<AdminMutationExecuteResult> {
  const payment = await tx.billingPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AdminValidationError("Tahsilat bulunamadı.");

  const transition = evaluateBillingPaymentStatusTransition(payment.status, nextStatus);
  if (!transition.ok) {
    throw new AdminMutationGuardError("invalid_state_transition", transition.message);
  }
  if (transition.kind === "noop") {
    return {
      organizationId: payment.organizationId,
      entityId: payment.id,
      before: { status: payment.status },
      after: { status: payment.status },
      transition: "noop",
    };
  }

  let coverageMeta: Record<string, unknown> | null = null;

  if (payment.invoiceId) {
    await lockAdminInvoiceForMutation(tx, payment.invoiceId);
    const freshPayment = await tx.billingPayment.findUniqueOrThrow({ where: { id: paymentId } });
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });

    if (freshPayment.status !== payment.status) {
      throw new AdminMutationGuardError(
        "stale_version",
        "Tahsilat durumu başka bir işlem tarafından değiştirilmiş. Sayfayı yenileyin.",
      );
    }

    if (payment.status === "PENDING" && nextStatus === "PAID") {
      const paidCoverageMinor = await sumPaidCoverageMinor(tx, payment.invoiceId, paymentId);
      const coverage = evaluateInvoicePaymentCoverage({
        invoiceTotal: Number(invoice.total),
        paidCoverageMinor,
        newPaymentAmount: Number(freshPayment.amount),
      });
      if (coverage.overpayment) {
        throw new AdminMutationGuardError(
          "finance_invariant_failed",
          "Tahsilat tutarı fatura kalan bakiyesini aşıyor.",
        );
      }
      coverageMeta = {
        outstandingBefore: coverage.outstandingBeforeMinor / 100,
        paidCoverageAfter: coverage.paidCoverageAfterMinor / 100,
        invoiceAutoPaid: coverage.invoiceAutoPaid,
      };

      const updated = await tx.billingPayment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: { status: "PAID", paidAt: freshPayment.paidAt ?? new Date() },
      });
      if (updated.count === 0) {
        throw new AdminMutationGuardError(
          "stale_version",
          "Tahsilat durumu başka bir işlem tarafından değiştirilmiş. Sayfayı yenileyin.",
        );
      }

      const settled = await maybeAutoSettleInvoice(tx, invoice, coverage);
      coverageMeta = { ...coverageMeta, invoiceAutoPaid: settled || coverage.invoiceAutoPaid };

      return {
        organizationId: payment.organizationId,
        entityId: payment.id,
        before: { status: payment.status },
        after: { status: nextStatus },
        transition: `${payment.status}->${nextStatus}`,
        metadata: coverageMeta,
      };
    }

    if (payment.status === "PAID" && nextStatus === "REFUNDED") {
      const remainingCoverageMinor = await sumPaidCoverageMinor(tx, payment.invoiceId, paymentId);
      const totalMinor = toMinorUnits(Number(invoice.total));
      if (invoice.status === "PAID" && remainingCoverageMinor < totalMinor) {
        throw new AdminMutationGuardError("finance_invariant_failed", RECONCILIATION_REQUIRED_MESSAGE);
      }
      coverageMeta = {
        outstandingBefore: Math.max(0, totalMinor - (remainingCoverageMinor + toMinorUnits(Number(freshPayment.amount)))) / 100,
        paidCoverageAfter: remainingCoverageMinor / 100,
        invoiceAutoPaid: invoice.status === "PAID" && remainingCoverageMinor >= totalMinor,
      };
    }
  }

  const updated = await tx.billingPayment.updateMany({
    where: { id: paymentId, status: payment.status },
    data: {
      status: nextStatus as "PENDING" | "PAID" | "FAILED" | "REFUNDED",
      paidAt: nextStatus === "PAID" ? payment.paidAt ?? new Date() : payment.paidAt,
    },
  });
  if (updated.count === 0) {
    throw new AdminMutationGuardError(
      "stale_version",
      "Tahsilat durumu başka bir işlem tarafından değiştirilmiş. Sayfayı yenileyin.",
    );
  }

  return {
    organizationId: payment.organizationId,
    entityId: payment.id,
    before: { status: payment.status },
    after: { status: nextStatus },
    transition: `${payment.status}->${nextStatus}`,
    metadata: coverageMeta ?? undefined,
  };
}

export async function executeUpdateInvoiceStatus(
  tx: FinanceTx,
  invoiceId: string,
  nextStatus: string,
): Promise<AdminMutationExecuteResult> {
  await lockAdminInvoiceForMutation(tx, invoiceId);
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new AdminValidationError("Fatura bulunamadı.");

  const transition = evaluateInvoiceStatusTransition(invoice.status, nextStatus);
  if (!transition.ok) {
    throw new AdminMutationGuardError("invalid_state_transition", transition.message);
  }
  if (transition.kind === "noop") {
    return {
      organizationId: invoice.organizationId,
      entityId: invoice.id,
      before: { status: invoice.status },
      after: { status: invoice.status },
      transition: "noop",
    };
  }

  if (nextStatus === "PAID") {
    const paidCoverageMinor = await sumPaidCoverageMinor(tx, invoice.id);
    const coverage = assertInvoicePaidCoverageSufficient({
      invoiceTotal: Number(invoice.total),
      paidCoverageMinor,
    });
    if (!coverage.ok) {
      throw new AdminMutationGuardError("finance_invariant_failed", coverage.message);
    }
  }

  const paidAt = nextStatus === "PAID" ? invoice.paidAt ?? new Date() : invoice.paidAt;
  const issuedAt =
    nextStatus === "ISSUED" || nextStatus === "PAID" || nextStatus === "OVERDUE"
      ? invoice.issuedAt ?? new Date()
      : invoice.issuedAt;

  const updated = await tx.invoice.updateMany({
    where: { id: invoiceId, status: invoice.status },
    data: {
      status: nextStatus as "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "VOID",
      paidAt,
      issuedAt,
    },
  });
  if (updated.count === 0) {
    throw new AdminMutationGuardError(
      "stale_version",
      "Fatura durumu başka bir işlem tarafından değiştirilmiş. Sayfayı yenileyin.",
    );
  }

  return {
    organizationId: invoice.organizationId,
    entityId: invoice.id,
    before: { status: invoice.status },
    after: { status: nextStatus },
    transition: `${invoice.status}->${nextStatus}`,
  };
}

export type CreateLicenseInput = {
  organizationId: string;
  productId: string;
  productKey: string;
  planId: string;
  licenseType: "MONTHLY" | "YEARLY" | "ONE_TIME";
  startsAt: Date;
  endsAt: Date | null;
  status: "ACTIVE" | "TRIAL" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "SUSPENDED";
};

export async function executeCreateLicense(
  tx: FinanceTx,
  payload: CreateLicenseInput,
): Promise<AdminMutationExecuteResult> {
  await lockAdminOrganizationProductCommercialCreate(tx, payload.organizationId, payload.productId);

  const organization = await tx.organization.findUnique({ where: { id: payload.organizationId } });
  if (!organization || !organization.isActive) {
    throw new AdminValidationError("Organizasyon bulunamadı veya pasif.");
  }
  const product = await tx.product.findUnique({ where: { id: payload.productId } });
  if (!product || product.id !== payload.productId) {
    throw new AdminValidationError("Ürün bulunamadı.");
  }
  const plan = await tx.plan.findFirst({
    where: { id: payload.planId, productId: payload.productId, isActive: true },
  });
  if (!plan) throw new AdminValidationError("Paket bulunamadı.");

  const existing = await tx.license.findFirst({
    where: {
      organizationId: payload.organizationId,
      productId: payload.productId,
      status: { in: [...NON_TERMINAL_LICENSE_STATUSES] },
    },
  });
  if (existing) {
    throw new AdminMutationGuardError("finance_invariant_failed", DUPLICATE_LICENSE_MESSAGE);
  }

  const license = await tx.license.create({
    data: {
      organizationId: payload.organizationId,
      productId: payload.productId,
      planId: payload.planId,
      licenseType: payload.licenseType,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      status: payload.status,
    },
  });

  // License-only create enables product seat; subscription create uses lifecycle sync.
  if (payload.status === "ACTIVE" || payload.status === "TRIAL") {
    await tx.appInstallation.upsert({
      where: {
        organizationId_productId: {
          organizationId: payload.organizationId,
          productId: payload.productId,
        },
      },
      update: { status: "ACTIVE", licenseId: license.id },
      create: {
        organizationId: payload.organizationId,
        productId: payload.productId,
        licenseId: license.id,
        status: "ACTIVE",
      },
    });
  }

  return {
    organizationId: payload.organizationId,
    entityId: license.id,
    after: { productKey: payload.productKey, status: license.status, planId: license.planId },
    replayResult: { licenseId: license.id },
  };
}

export type CreateSubscriptionInput = {
  organizationId: string;
  planId: string;
  status: string;
  interval: "MONTHLY" | "YEARLY" | "ONE_TIME";
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  provider: string | null;
  providerRef: string | null;
};

function addPeriod(date: Date, interval: "MONTHLY" | "YEARLY") {
  const next = new Date(date);
  if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export async function executeCreateSubscription(
  tx: FinanceTx,
  payload: CreateSubscriptionInput,
): Promise<AdminMutationExecuteResult> {
  assertSubscriptionCreateStatus(payload.status);
  const createStatus = payload.status;

  const plan = await tx.plan.findUnique({
    where: { id: payload.planId },
    include: { product: true },
  });
  if (!plan || !plan.isActive) throw new AdminValidationError("Paket bulunamadı.");

  await lockAdminOrganizationProductCommercialCreate(tx, payload.organizationId, plan.productId);

  const organization = await tx.organization.findUnique({ where: { id: payload.organizationId } });
  if (!organization || !organization.isActive) {
    throw new AdminValidationError("Organizasyon bulunamadı veya pasif.");
  }
  const planFresh = await tx.plan.findUnique({
    where: { id: payload.planId },
    include: { product: true },
  });
  if (!planFresh || !planFresh.isActive) throw new AdminValidationError("Paket bulunamadı.");

  const expectedLicenseStatus = mapSubscriptionCreateStatusToLicenseStatus(createStatus);
  const periodEnd =
    payload.currentPeriodEnd ??
    (payload.interval === "ONE_TIME"
      ? null
      : addPeriod(payload.currentPeriodStart, payload.interval === "YEARLY" ? "YEARLY" : "MONTHLY"));

  let license = await tx.license.findFirst({
    where: {
      organizationId: payload.organizationId,
      productId: planFresh.productId,
      status: { in: [...NON_TERMINAL_LICENSE_STATUSES] },
    },
  });

  if (license) {
    if (license.planId !== planFresh.id) {
      throw new AdminMutationGuardError("finance_invariant_failed", LICENSE_PLAN_MISMATCH_MESSAGE);
    }
    if (license.status !== expectedLicenseStatus) {
      throw new AdminMutationGuardError(
        "finance_invariant_failed",
        `Mevcut lisans durumu (${license.status}) yeni abonelik başlangıç durumuyla uyumsuz.`,
      );
    }
  } else {
    license = await tx.license.create({
      data: {
        organizationId: payload.organizationId,
        productId: planFresh.productId,
        planId: planFresh.id,
        status: expectedLicenseStatus,
        licenseType:
          payload.interval === "YEARLY" ? "YEARLY" : payload.interval === "ONE_TIME" ? "ONE_TIME" : "MONTHLY",
        startsAt: payload.currentPeriodStart,
        endsAt: periodEnd,
      },
    });
  }

  const existingSubscription = await tx.subscription.findUnique({ where: { licenseId: license.id } });
  if (existingSubscription) {
    throw new AdminValidationError("Bu lisans için zaten abonelik var.");
  }

  // Seed installation as DISABLED so syncSubscriptionAccessState can open via lifecycle.
  await tx.appInstallation.upsert({
    where: {
      organizationId_productId: {
        organizationId: payload.organizationId,
        productId: planFresh.productId,
      },
    },
    update: { licenseId: license.id, status: "DISABLED" },
    create: {
      organizationId: payload.organizationId,
      productId: planFresh.productId,
      licenseId: license.id,
      status: "DISABLED",
    },
  });

  const subscription = await tx.subscription.create({
    data: {
      organizationId: payload.organizationId,
      licenseId: license.id,
      planId: planFresh.id,
      status: createStatus,
      interval: payload.interval,
      currentPeriodStart: payload.currentPeriodStart,
      currentPeriodEnd: periodEnd,
      provider: payload.provider,
      providerRef: payload.providerRef,
    },
  });

  const accessSync = await syncSubscriptionAccessState(tx, {
    subscription: {
      id: subscription.id,
      organizationId: subscription.organizationId,
      licenseId: subscription.licenseId,
      status: subscription.status,
      cancelAt: subscription.cancelAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    // Synthetic terminal previous status so create-time open intent reuses lifecycle.
    previousStatus: "CANCELLED",
  });

  return {
    organizationId: payload.organizationId,
    entityId: subscription.id,
    after: {
      planId: planFresh.id,
      licenseId: license.id,
      status: subscription.status,
      licenseStatus: accessSync.license.after,
      installationStatus: accessSync.installation.after,
    },
    metadata: {
      accessSync: {
        intent: accessSync.intent,
        license: accessSync.license,
        installation: accessSync.installation,
      },
    },
    replayResult: { subscriptionId: subscription.id, licenseId: license.id },
  };
}
