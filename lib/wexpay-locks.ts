import type { Prisma } from ".prisma/client";

/**
 * WexPay Postgres advisory locks (transaction-scoped).
 *
 * Lock order (never reverse — prevents deadlocks):
 *   1. Organization table-limit lock   (`wexpay:org-tables` + organizationId)
 *   2. Table account lock              (`wexpay:table` + tableId)
 *
 * Paths:
 * - createTable / createTablesBulk → (1) only
 * - createPayment / updatePayment / settle / closeTable / public checkout → (2) only
 * - Paths that need both must acquire (1) then (2)
 *
 * Always take the lock BEFORE reading balance / entitlement counts.
 * Never call external PayTR HTTP while holding these locks.
 */

type LockClient = {
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
};

/** Namespace + entity two-key advisory xact lock. */
async function advisoryXactLock(tx: LockClient, namespace: string, entityId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${namespace}), hashtext(${entityId}))`;
}

/** Serializes table balance mutations (payments, settle, close, public checkout). */
export async function lockWexPayTableAccount(tx: LockClient, tableId: string) {
  await advisoryXactLock(tx, "wexpay:table", tableId);
}

/** Serializes org-level table entitlement checks for single + bulk create. */
export async function lockWexPayOrgTableLimit(tx: LockClient, organizationId: string) {
  await advisoryXactLock(tx, "wexpay:org-tables", organizationId);
}

/** Serializes org-level branch entitlement checks. */
export async function lockWexPayOrgBranchLimit(tx: LockClient, organizationId: string) {
  await advisoryXactLock(tx, "wexpay:org-branches", organizationId);
}

/** Serializes org-level staff seat + pending invite entitlement checks. */
export async function lockWexPayOrgStaffLimit(tx: LockClient, organizationId: string) {
  await advisoryXactLock(tx, "wexpay:org-staff", organizationId);
}
