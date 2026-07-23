/**
 * Shared signature for kitchen/cashier live refresh — kept free of React so
 * unit tests can assert "no refresh when snapshot unchanged".
 */
export function buildOperationsSnapshotSignature(payload: {
  metrics?: Record<string, unknown>;
  openTablesCount?: number;
  notifications?: Array<{ id?: string; createdAt?: string }>;
  generatedAt?: string;
}) {
  const metrics = payload.metrics ?? {};
  const notificationTail = (payload.notifications ?? [])
    .slice(0, 5)
    .map((row) => `${row.id ?? ""}:${row.createdAt ?? ""}`)
    .join("|");
  return [
    metrics.openOrders ?? "",
    metrics.pendingKitchen ?? "",
    metrics.pendingPaytrCount ?? "",
    payload.openTablesCount ?? "",
    notificationTail,
  ].join("::");
}
