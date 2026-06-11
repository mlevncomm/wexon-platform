export const demoLeadStatuses = ["new", "contacted", "demo_scheduled", "won", "lost"] as const;

export type DemoLeadStatus = (typeof demoLeadStatuses)[number];

export const demoLeadStatusLabels: Record<DemoLeadStatus, string> = {
  new: "Yeni",
  contacted: "İletişime Geçildi",
  demo_scheduled: "Demo Planlandı",
  won: "Kazanıldı",
  lost: "Kaybedildi",
};

type StatusUpdateMeta = {
  originalDemoRequestId?: string;
  previousStatus?: string;
  nextStatus?: string;
};

function readStatusUpdateMeta(value: unknown): StatusUpdateMeta {
  return typeof value === "object" && value !== null ? (value as StatusUpdateMeta) : {};
}

export function normalizeDemoLeadStatus(value: unknown): DemoLeadStatus {
  if (typeof value !== "string" || !value.trim()) {
    return "new";
  }

  const trimmed = value.trim();
  const lowered = trimmed.toLowerCase();

  if (lowered === "new" || trimmed === "NEW") return "new";
  if (demoLeadStatuses.includes(lowered as DemoLeadStatus)) {
    return lowered as DemoLeadStatus;
  }

  return "new";
}

export function demoLeadStatusBadgeClass(status: DemoLeadStatus) {
  switch (status) {
    case "new":
      return "bg-blue-50 text-blue-700 ring-blue-100";
    case "contacted":
      return "bg-cyan-50 text-cyan-700 ring-cyan-100";
    case "demo_scheduled":
      return "bg-amber-50 text-amber-800 ring-amber-100";
    case "won":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "lost":
      return "bg-rose-50 text-rose-700 ring-rose-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200/80";
  }
}

export function resolveDemoLeadStatus(
  creationMeta: unknown,
  statusUpdates: Array<{ metadataJson: unknown; createdAt: Date }>,
): DemoLeadStatus {
  const meta = typeof creationMeta === "object" && creationMeta !== null ? (creationMeta as Record<string, unknown>) : {};
  let status = normalizeDemoLeadStatus(meta.leadStatus ?? meta.status);

  const sortedUpdates = [...statusUpdates].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const update of sortedUpdates) {
    const updateMeta = readStatusUpdateMeta(update.metadataJson);
    if (updateMeta.nextStatus) {
      status = normalizeDemoLeadStatus(updateMeta.nextStatus);
    }
  }

  return status;
}

export function groupDemoLeadStatusUpdates<T extends { entityId: string | null; metadataJson: unknown; createdAt: Date }>(
  updates: T[],
) {
  const grouped = new Map<string, T[]>();

  for (const update of updates) {
    const updateMeta = readStatusUpdateMeta(update.metadataJson);
    const requestId = update.entityId ?? updateMeta.originalDemoRequestId;
    if (!requestId) continue;

    const bucket = grouped.get(requestId) ?? [];
    bucket.push(update);
    grouped.set(requestId, bucket);
  }

  return grouped;
}
