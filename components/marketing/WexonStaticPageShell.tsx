import Link from "next/link";
import type { ReactNode } from "react";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";

/** Shared alignment for static/legal hero + body (hero and content share edges). */
export const PUBLIC_PAGE_CONTAINER = "mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-8";

export function WexonPageCTA({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="rounded-[32px] border border-slate-900 bg-slate-950 p-8 text-center text-white shadow-2xl shadow-slate-950/20 sm:p-12">
      <h2 className="mx-auto max-w-3xl text-3xl font-black tracking-[-0.02em] sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          {description}
        </p>
      )}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href={primary.href}
          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white wx-interactive hover:bg-emerald-400"
        >
          {primary.label}
        </Link>
        {secondary && (
          <Link
            href={secondary.href}
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white wx-interactive hover:bg-white/10"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}

export default function WexonStaticPageShell({
  badge,
  headline,
  description,
  children,
  variant = "default",
}: {
  badge: string;
  headline: string;
  description: string;
  children: ReactNode;
  variant?: "default" | "compact";
}) {
  const compact = variant === "compact";

  return (
    <>
      <WexonNavbar />
      <main className="min-h-screen bg-[#f6f8f7] pb-16 pt-24 text-slate-950 sm:pb-20 md:pt-28">
        <div className={PUBLIC_PAGE_CONTAINER}>
          <section
            className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] text-white shadow-xl shadow-slate-950/15 sm:rounded-[32px] ${
              compact ? "p-6 sm:p-8" : "p-8 sm:p-10 lg:p-12"
            }`}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
            <div className="relative max-w-3xl">
              <span className="mb-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300 sm:mb-5">
                {badge}
              </span>
              <h1
                className={`font-black leading-tight tracking-[-0.02em] text-white ${
                  compact
                    ? "text-3xl sm:text-4xl lg:text-[2.75rem]"
                    : "text-4xl sm:text-5xl lg:text-[3.25rem]"
                }`}
              >
                {headline}
              </h1>
              <p
                className={`mt-4 max-w-2xl leading-relaxed text-slate-300 sm:mt-5 ${
                  compact ? "text-sm sm:text-base" : "text-base sm:text-lg"
                }`}
              >
                {description}
              </p>
            </div>
          </section>

          <div className={`wx-fade-in ${compact ? "mt-8 space-y-8 sm:mt-10" : "mt-10 space-y-10 sm:mt-12 sm:space-y-12"}`}>
            {children}
          </div>
        </div>
      </main>
      <WexonFooter />
    </>
  );
}
