"use client";

export default function QrStatusBadge({
  children,
  tone = "mint",
}: {
  children: React.ReactNode;
  tone?: "mint" | "slate" | "amber" | "rose";
}) {
  const tones = {
    mint: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70",
    slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
    amber: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
    rose: "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
