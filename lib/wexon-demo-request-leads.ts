export const demoLeadStatuses = ["new", "contacted", "demo_scheduled", "won", "lost"] as const;

export type DemoLeadStatus = (typeof demoLeadStatuses)[number];

export type DemoLeadFollowUp = {
  note: string | null;
  followUpAt: string | null;
  updatedAt: Date | null;
};

export type FollowUpDateState = "today" | "overdue" | "scheduled";

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

type FollowUpUpdateMeta = {
  originalDemoRequestId?: string;
  note?: string;
  followUpAt?: string;
};

function readStatusUpdateMeta(value: unknown): StatusUpdateMeta {
  return typeof value === "object" && value !== null ? (value as StatusUpdateMeta) : {};
}

function readFollowUpUpdateMeta(value: unknown): FollowUpUpdateMeta {
  return typeof value === "object" && value !== null ? (value as FollowUpUpdateMeta) : {};
}

function groupDemoLeadUpdatesByRequestId<T extends { entityId: string | null; metadataJson: unknown }>(updates: T[]) {
  const grouped = new Map<string, T[]>();

  for (const update of updates) {
    const meta =
      typeof update.metadataJson === "object" && update.metadataJson !== null
        ? (update.metadataJson as { originalDemoRequestId?: string })
        : {};
    const requestId = update.entityId ?? meta.originalDemoRequestId;
    if (!requestId) continue;

    const bucket = grouped.get(requestId) ?? [];
    bucket.push(update);
    grouped.set(requestId, bucket);
  }

  return grouped;
}

function parseFollowUpDate(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
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

export function resolveDemoLeadFollowUp(
  followUpUpdates: Array<{ metadataJson: unknown; createdAt: Date }>,
): DemoLeadFollowUp {
  if (followUpUpdates.length === 0) {
    return { note: null, followUpAt: null, updatedAt: null };
  }

  const latest = [...followUpUpdates].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const updateMeta = readFollowUpUpdateMeta(latest.metadataJson);

  return {
    note: typeof updateMeta.note === "string" && updateMeta.note.trim() ? updateMeta.note.trim() : null,
    followUpAt:
      typeof updateMeta.followUpAt === "string" && updateMeta.followUpAt.trim() ? updateMeta.followUpAt.trim() : null,
    updatedAt: latest.createdAt,
  };
}

export function resolveFollowUpDateState(
  followUpAt: string | null | undefined,
  now = new Date(),
): FollowUpDateState | null {
  if (!followUpAt?.trim()) return null;

  const target = parseFollowUpDate(followUpAt);
  if (!target) return null;

  const today = startOfDay(now).getTime();
  const targetDay = startOfDay(target).getTime();

  if (targetDay === today) return "today";
  if (targetDay < today) return "overdue";
  return "scheduled";
}

export const followUpDateStateLabels: Record<FollowUpDateState, string> = {
  today: "Bugün",
  overdue: "Gecikmiş",
  scheduled: "Planlandı",
};

export function followUpDateBadgeClass(state: FollowUpDateState) {
  switch (state) {
    case "today":
      return "bg-amber-50 text-amber-800 ring-amber-100";
    case "overdue":
      return "bg-rose-50 text-rose-700 ring-rose-100";
    case "scheduled":
      return "bg-slate-100 text-slate-700 ring-slate-200/80";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200/80";
  }
}

export function formatFollowUpDateLabel(followUpAt: string | null | undefined) {
  if (!followUpAt?.trim()) return null;
  const parsed = parseFollowUpDate(followUpAt);
  return parsed ? parsed.toLocaleDateString("tr-TR") : followUpAt;
}

export function groupDemoLeadStatusUpdates<T extends { entityId: string | null; metadataJson: unknown; createdAt: Date }>(
  updates: T[],
) {
  return groupDemoLeadUpdatesByRequestId(updates);
}

export function groupDemoLeadFollowUpUpdates<T extends { entityId: string | null; metadataJson: unknown; createdAt: Date }>(
  updates: T[],
) {
  return groupDemoLeadUpdatesByRequestId(updates);
}
