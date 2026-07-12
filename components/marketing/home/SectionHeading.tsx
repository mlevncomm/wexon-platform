interface SectionHeadingProps {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
}

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  tone = "light",
}: SectionHeadingProps) {
  const isCenter = align === "center";
  const isDark = tone === "dark";

  return (
    <div className={`${isCenter ? "mx-auto max-w-3xl text-center" : "max-w-2xl text-left"}`}>
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] ${
          isDark
            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
            : "border-slate-200 bg-white text-slate-600"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {eyebrow}
      </span>
      <h2
        className={`mt-5 text-3xl font-black tracking-[-0.02em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1] ${
          isDark ? "text-white" : "text-slate-950"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-5 text-base leading-relaxed sm:text-lg ${
            isCenter ? "mx-auto max-w-2xl" : ""
          } ${isDark ? "text-slate-300/90" : "text-slate-600"}`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
