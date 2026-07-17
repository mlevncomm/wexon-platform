/**
 * Central subscription → License / AppInstallation access synchronization.
 *
 * The read-time decision lives in `evaluateSubscriptionLifecycle`
 * (`lib/wexon-core-access.ts`). This module applies the matching *write-time*
 * side effects for a deliberate admin status change, in the caller's
 * transaction, so Subscription / License / AppInstallation cannot drift apart.
 *
 * It handles both directions:
 * - terminal close (CANCELLED effective now / EXPIRED), and
 * - explicit reactivation (ACTIVE / TRIALING).
 */

import type { Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import type { TerminalSubscriptionDenialReason } from "@/lib/wexon-core-access";

/** Works on both the root client and a `$transaction` client. */
export type SubscriptionAccessSyncClient = Prisma.TransactionClient | typeof prisma;

export type SubscriptionAccessSyncFailureReason = "tenant_mismatch" | "unsafe_transition";

/**
 * Thrown for integrity / unsafe-transition problems. When raised inside the
 * caller's `$transaction`, the whole transaction (including the Subscription
 * status update) rolls back — never a silent no-op.
 */
export class SubscriptionAccessSyncError extends Error {
  reason: SubscriptionAccessSyncFailureReason;

  constructor(message: string, reason: SubscriptionAccessSyncFailureReason) {
    super(message);
    this.name = "SubscriptionAccessSyncError";
    this.reason = reason;
  }
}

export type SubscriptionAccessIntent = "close" | "open" | "noop";

export type SubscriptionAccessSyncInput = {
  /** Post-update subscription snapshot. */
  subscription: {
    id: string;
    organizationId: string;
    licenseId: string;
    status: string;
    cancelAt: Date | null;
    currentPeriodEnd: Date | null;
  };
  /** Pre-update subscription status, used to reject unsafe transitions. */
  previousStatus: string;
  now?: Date;
};

export type SubscriptionAccessSyncResult = {
  intent: SubscriptionAccessIntent;
  reason: TerminalSubscriptionDenialReason | null;
  licenseId: string;
  license: { before: string; after: string };
  installation: { before: string | null; after: string | null };
};

const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["CANCELLED", "EXPIRED"]);

type AccessPlan =
  | {
      intent: "close";
      reason: TerminalSubscriptionDenialReason;
      licenseStatus: "CANCELLED" | "EXPIRED";
      installation: { from: "ACTIVE"; to: "DISABLED" };
    }
  | {
      intent: "open";
      licenseStatus: "ACTIVE" | "TRIAL";
      installation: { from: "DISABLED"; to: "ACTIVE" };
    }
  | { intent: "noop" };

/**
 * Resolve the intended License/installation side effect from the *deliberate*
 * new subscription status. Mirrors `evaluateSubscriptionLifecycle` intent but
 * is status-driven because reactivation is an explicit admin action.
 */
function resolveAccessPlan(
  subscription: SubscriptionAccessSyncInput["subscription"],
  previousStatus: string,
  now: Date,
): AccessPlan {
  switch (subscription.status) {
    case "EXPIRED":
      // Always immediately terminal, regardless of cancelAt.
      return { intent: "close", reason: "subscription_expired", licenseStatus: "EXPIRED", installation: { from: "ACTIVE", to: "DISABLED" } };

    case "CANCELLED":
      // Future-dated cancellation must not close access early.
      if (subscription.cancelAt && subscription.cancelAt.getTime() > now.getTime()) {
        return { intent: "noop" };
      }
      return { intent: "close", reason: "subscription_cancelled", licenseStatus: "CANCELLED", installation: { from: "ACTIVE", to: "DISABLED" } };

    case "ACTIVE":
      return { intent: "open", licenseStatus: "ACTIVE", installation: { from: "DISABLED", to: "ACTIVE" } };

    case "TRIALING":
      return { intent: "open", licenseStatus: "TRIAL", installation: { from: "DISABLED", to: "ACTIVE" } };

    case "PAST_DUE":
      // A terminal → PAST_DUE jump is ambiguous (License/installation are closed)
      // and would leave a half-active tenant. Refuse loudly instead.
      if (TERMINAL_SUBSCRIPTION_STATUSES.has(previousStatus)) {
        throw new SubscriptionAccessSyncError(
          "Terminal abonelikten PAST_DUE durumuna güvenli geçiş yapılamaz. Önce ACTIVE veya TRIALING durumuna alın.",
          "unsafe_transition",
        );
      }
      // Otherwise preserve the existing product policy (no eager change).
      return { intent: "noop" };

    default:
      return { intent: "noop" };
  }
}

/**
 * Synchronize the License and the SAME organization+product AppInstallation for
 * a deliberate subscription status change.
 *
 * Guarantees:
 * - Manual licenses without a subscription never reach this helper.
 * - Future-dated cancellations are a no-op (access continues until `cancelAt`).
 * - Only the product tied to the subscription's License is touched; other
 *   products and organizations are never modified.
 * - Tenant mismatch (License not in the subscription's org) throws and rolls
 *   back — never a silent no-op.
 * - Idempotent: repeated runs make no further writes once License/installation
 *   already match the intended state.
 *
 * Run inside the caller's `$transaction`.
 */
export async function syncSubscriptionAccessState(
  db: SubscriptionAccessSyncClient,
  input: SubscriptionAccessSyncInput,
): Promise<SubscriptionAccessSyncResult> {
  const now = input.now ?? new Date();
  const { subscription, previousStatus } = input;

  const license = await db.license.findUnique({ where: { id: subscription.licenseId } });
  if (!license) {
    throw new SubscriptionAccessSyncError("Aboneliğe bağlı lisans bulunamadı.", "tenant_mismatch");
  }
  if (license.organizationId !== subscription.organizationId) {
    throw new SubscriptionAccessSyncError(
      "Lisans ile abonelik aynı organizasyona ait değil.",
      "tenant_mismatch",
    );
  }
  const licenseBefore = license.status;

  const plan = resolveAccessPlan(subscription, previousStatus, now);

  const installationBefore = await db.appInstallation.findUnique({
    where: { organizationId_productId: { organizationId: license.organizationId, productId: license.productId } },
  });
  const installationBeforeStatus = installationBefore?.status ?? null;

  if (plan.intent === "noop") {
    return {
      intent: "noop",
      reason: null,
      licenseId: license.id,
      license: { before: licenseBefore, after: licenseBefore },
      installation: { before: installationBeforeStatus, after: installationBeforeStatus },
    };
  }

  // License transition (idempotent: only write when the value actually changes).
  let licenseAfter = licenseBefore;
  if (licenseBefore !== plan.licenseStatus) {
    const updatedLicense = await db.license.update({
      where: { id: license.id },
      data: { status: plan.licenseStatus },
    });
    licenseAfter = updatedLicense.status;
  }

  // Installation transition — scoped to THIS org+product only. The `from` guard
  // keeps it idempotent and prevents touching unrelated installation states.
  let installationAfter = installationBeforeStatus;
  if (installationBefore && installationBefore.status === plan.installation.from) {
    const updatedInstallation = await db.appInstallation.update({
      where: { organizationId_productId: { organizationId: license.organizationId, productId: license.productId } },
      data: { status: plan.installation.to },
    });
    installationAfter = updatedInstallation.status;
  }

  return {
    intent: plan.intent,
    reason: plan.intent === "close" ? plan.reason : null,
    licenseId: license.id,
    license: { before: licenseBefore, after: licenseAfter },
    installation: { before: installationBeforeStatus, after: installationAfter },
  };
}
