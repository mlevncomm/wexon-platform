import type { ReactNode } from "react";

export default function WexonInfoCard({
  title,
  description,
  children,
  tone = "emerald",
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  tone?: "emerald" | "indigo" | "amber" | "slate";
}) {
  const bar =
    tone === "indigo"
      ? "bg-indigo-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "slate"
          ? "bg-slate-400"
          : "bg-[#5dff65]";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
      <span className={`mb-4 block h-2 w-10 rounded-full ${bar}`} />
      <h3 className="text-lg font-black tracking-tight text-slate-950">{title}</h3>
      {description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>}
      {children}
    </article>
  );
}
