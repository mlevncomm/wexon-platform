import Link from "next/link";
import type { ReactNode } from "react";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";

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
          className="inline-flex items-center justify-center rounded-full bg-[#5dff65] px-7 py-3.5 text-sm font-bold text-white wx-interactive hover:bg-[#48e050]"
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
}: {
  badge: string;
  headline: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <WexonNavbar />
      <main className="min-h-screen bg-[#f6f8f7] px-5 pb-20 pt-24 text-slate-950 sm:px-8 md:pt-28 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mx-auto max-w-[1440px]">
          <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] p-8 text-white shadow-2xl shadow-slate-950/20 sm:p-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
            <div className="relative max-w-4xl">
              <span className="mb-6 inline-flex rounded-full border border-emerald-400/30 bg-[#5dff65]/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
                {badge}
              </span>
              <h1 className="text-4xl font-black leading-tight tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
                {headline}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
                {description}
              </p>
            </div>
          </section>

          <div className="mt-16 space-y-16 wx-fade-in">{children}</div>
        </div>
      </main>
      <WexonFooter />
    </>
  );
}
