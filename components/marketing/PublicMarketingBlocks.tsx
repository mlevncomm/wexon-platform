import Link from "next/link";

export function PublicCTASection({
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
    <section className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-7 sm:p-10">
      <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">{description}</p> : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={primary.href}
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500"
        >
          {primary.label}
        </Link>
        {secondary ? (
          <Link
            href={secondary.href}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function PublicFeatureGrid({
  items,
}: {
  items: Array<{ title: string; description: string }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/5 sm:p-6"
        >
          <h3 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
