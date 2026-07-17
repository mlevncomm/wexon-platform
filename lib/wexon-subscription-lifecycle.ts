/**
 * Central subscription → License / AppInstallation access synchronization.
 *
 * The read-time decision lives in `evaluateSubscriptionLifecycle`
 * (`lib/wexon-core-access.ts`). This module reuses that exact rule so a
 * terminal subscription transition cannot drift from the request-time gate.
 */

import type { Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import {
  evaluateSubscriptionLifecycle,
  type SubscriptionLifecycleSnapshot,
  type TerminalSubscriptionDenialReason,
} from "@/lib/wexon-core-access";

/** Works on both the root client and a `$transaction` client. */
export type SubscriptionAccessSyncClient = Prisma.TransactionClient | typeof prisma;

export type SubscriptionAccessSyncInput = {
  subscription: {
    id: string;
    organizationId: string;
    licenseId: string;
    status: string;
    cancelAt: Date | null;
    currentPeriodEnd: Date | null;
  };
  now?: Date;
};

export type SubscriptionAccessSyncResult = {
  /** True when an effective terminal transition closed access this call. */
  applied: boolean;
  reason: TerminalSubscriptionDenialReason | null;
  licenseId: string;
  /** True only when the License row was actually transitioned this call. */
  licenseStatusChanged: boolean;
  /** True only when an ACTIVE installation was actually disabled this call. */
  installationDisabled: boolean;
};

const SUBSCRIPTION_TO_LICENSE_TERMINAL: Record<TerminalSubscriptionDenialReason, "CANCELLED" | "EXPIRED"> = {
  subscription_cancelled: "CANCELLED",
  subscription_expired: "EXPIRED",
};

/**
 * Synchronize the License and the SAME organization+product AppInstallation
 * when a subscription reaches an *effective* terminal state.
 *
 * Guarantees:
 * - Manual licenses without a subscription never reach the terminal branch.
 * - Future-dated cancellations (`cancelAt` in the future) are a no-op.
 * - Period-ended is NOT treated as an admin terminal close here; the read-time
 *   gate already denies it, and we must not eagerly disable the License.
 * - Only the product tied to the subscription's License is touched; other
 *   products and other organizations are never modified.
 * - Idempotent: an already-terminal License / already-disabled installation
 *   produces no further writes.
 *
 * Run this inside the caller's `$transaction` so Subscription, License and
 * AppInstallation can never be left inconsistent by a partial failure.
 */
export async function syncSubscriptionTerminalAccess(
  db: SubscriptionAccessSyncClient,
  input: SubscriptionAccessSyncInput,
): Promise<SubscriptionAccessSyncResult> {
  const now = input.now ?? new Date();
  const snapshot: SubscriptionLifecycleSnapshot = {
    status: input.subscription.status,
    cancelAt: input.subscription.cancelAt,
    currentPeriodEnd: input.subscription.currentPeriodEnd,
  };
  const lifecycle = evaluateSubscriptionLifecycle(snapshot, now);

  const noop: SubscriptionAccessSyncResult = {
    applied: false,
    reason: lifecycle.ok ? null : lifecycle.reason === "subscription_period_ended" ? null : lifecycle.reason,
    licenseId: input.subscription.licenseId,
    licenseStatusChanged: false,
    installationDisabled: false,
  };

  // Only an effective CANCELLED/EXPIRED transition closes access. Access-retaining
  // states and period-ended (read-time only) leave the License/installation alone.
  if (lifecycle.ok || lifecycle.reason === "subscription_period_ended") {
    return noop;
  }

  const targetLicenseStatus = SUBSCRIPTION_TO_LICENSE_TERMINAL[lifecycle.reason];

  const license = await db.license.findUnique({ where: { id: input.subscription.licenseId } });
  // Defensive tenant guard: the license must belong to the subscription's org.
  if (!license || license.organizationId !== input.subscription.organizationId) {
    return { ...noop, reason: lifecycle.reason };
  }

  let licenseStatusChanged = false;
  if (license.status !== targetLicenseStatus) {
    await db.license.update({ where: { id: license.id }, data: { status: targetLicenseStatus } });
    licenseStatusChanged = true;
  }

  // Disable ONLY this org+product installation. Scoped by productId so sibling
  // products in the same organization are untouched. `status: ACTIVE` filter
  // keeps the call idempotent on repeat runs.
  const installationUpdate = await db.appInstallation.updateMany({
    where: { organizationId: license.organizationId, productId: license.productId, status: "ACTIVE" },
    data: { status: "DISABLED" },
  });

  return {
    applied: true,
    reason: lifecycle.reason,
    licenseId: license.id,
    licenseStatusChanged,
    installationDisabled: installationUpdate.count > 0,
  };
}
