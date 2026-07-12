import type { StatusBadge as StatusBadgeData, StatusTone } from "@/types/wexon";

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
};

export const STATUS_DOT_CLASS: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  info: "bg-blue-500",
  neutral: "bg-slate-400",
};

export default function StatusBadge({ badge, dot = false }: { badge: StatusBadgeData; dot?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE_CLASS[badge.tone]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[badge.tone]}`} />}
      {badge.label}
    </span>
  );
}
