import { cn } from "@/lib/cn";

export interface StatItem {
  value: string;
  label: string;
  hint?: string;
  highlighted?: boolean;
}

function StatCard({ item }: { item: StatItem }) {
  const highlighted = item.highlighted;
  return (
    <div
      className={cn(
        "wx-lift flex flex-col justify-between rounded-[26px] border p-6 sm:p-7",
        highlighted
          ? "border-emerald-400/40 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_26px_60px_-28px_rgba(16,185,129,0.75)]"
          : "border-slate-200 bg-white text-slate-950 shadow-[0_20px_50px_-30px_rgba(2,44,34,0.25)]",
      )}
    >
      <p
        className={cn(
          "text-3xl font-black tracking-[-0.02em] sm:text-4xl",
          highlighted ? "text-white" : "text-slate-950",
        )}
      >
        {item.value}
      </p>
      <div className="mt-4">
        <p className={cn("text-sm font-bold", highlighted ? "text-white" : "text-slate-900")}>
          {item.label}
        </p>
        {item.hint && (
          <p
            className={cn(
              "mt-1 text-[0.8125rem] leading-relaxed",
              highlighted ? "text-emerald-50/90" : "text-slate-500",
            )}
          >
            {item.hint}
          </p>
        )}
      </div>
    </div>
  );
}

interface StatStripProps {
  items: StatItem[];
  className?: string;
}

/** Responsive row of stat cards; mark one item `highlighted` for the emerald accent card. */
export default function StatStrip({ items, className }: StatStripProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => (
        <StatCard key={item.label} item={item} />
      ))}
    </div>
  );
}
