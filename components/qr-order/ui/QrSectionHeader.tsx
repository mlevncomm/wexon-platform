"use client";

export default function QrSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs font-semibold text-slate-500 sm:text-sm">{subtitle}</p> : null}
      </div>
    </div>
  );
}
