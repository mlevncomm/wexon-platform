type WexonFormAsideProps = {
  badge: string;
  headline: string;
  description: string;
  title: string;
  items: string[];
};

export default function WexonFormAside({
  badge,
  headline,
  description,
  title,
  items,
}: WexonFormAsideProps) {
  return (
    <aside className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] p-8 text-white shadow-2xl shadow-slate-950/20 sm:p-10 lg:sticky lg:top-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative">
        <span className="mb-6 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
          {badge}
        </span>
        <h1 className="text-4xl font-black leading-tight tracking-[-0.02em] text-white sm:text-5xl">
          {headline}
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">{description}</p>
      </div>
      <div className="relative mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
        <h2 className="text-base font-bold text-white">{title}</h2>
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item} className="flex items-start gap-3 text-sm font-semibold text-slate-300">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-400" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
