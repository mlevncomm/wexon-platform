import type { LegalBlock, LegalDocument } from "@/lib/legal-content";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, LEGAL_SITE_URL } from "@/lib/legal-content";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

function sectionAnchorId(heading: string) {
  return heading
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function enrichContactLine(line: string) {
  if (line === LEGAL_CONTACT_EMAIL || line.endsWith(LEGAL_CONTACT_EMAIL)) {
    const label = line === LEGAL_CONTACT_EMAIL ? "" : line.slice(0, line.indexOf(LEGAL_CONTACT_EMAIL));
    return (
      <p key={line} className="font-medium">
        {label}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-700 underline-offset-2 hover:underline">
          {LEGAL_CONTACT_EMAIL}
        </a>
      </p>
    );
  }

  if (line.includes(LEGAL_SITE_URL)) {
    const prefix = line.slice(0, line.indexOf(LEGAL_SITE_URL));
    return (
      <p key={line} className="font-medium">
        {prefix}
        <a
          href={LEGAL_SITE_URL}
          className="text-emerald-700 underline-offset-2 hover:underline"
          rel="noopener noreferrer"
        >
          {LEGAL_SITE_URL}
        </a>
      </p>
    );
  }

  return (
    <p key={line} className="font-medium">
      {line}
    </p>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.type === "p") {
    return <p className="text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-7">{block.text}</p>;
  }

  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-slate-600 sm:text-base">
        {block.items.map((item) => (
          <li key={item} className="pl-1">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "contact") {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-5 py-4 text-[15px] leading-relaxed text-slate-700 sm:text-base">
        {block.lines.map((line) => enrichContactLine(line))}
      </div>
    );
  }

  return <h3 className="pt-1 text-base font-bold tracking-tight text-slate-900 sm:text-lg">{block.text}</h3>;
}

function LegalAside({ document }: { document: LegalDocument }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-28">
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Son güncelleme</p>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">{LEGAL_LAST_UPDATED}</p>

        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">İletişim</p>
        <a
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          className="mt-1.5 inline-flex text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline"
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Bu sayfada</p>
        <nav className="mt-3 space-y-1.5" aria-label="Sayfa bölümleri">
          {document.sections.map((section) => (
            <a
              key={section.heading}
              href={`#${sectionAnchorId(section.heading)}`}
              className="block rounded-xl px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
            >
              {section.heading}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <WexonStaticPageShell
      variant="compact"
      badge={document.badge}
      headline={document.title}
      description={document.description}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 lg:hidden">
          <LegalAside document={document} />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-10">
          <article className="min-w-0 max-w-3xl justify-self-stretch lg:max-w-none xl:max-w-3xl">
            <div className="space-y-5 sm:space-y-6">
              {document.sections.map((section) => (
                <section
                  key={section.heading}
                  id={sectionAnchorId(section.heading)}
                  className="scroll-mt-28 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/5 sm:p-7"
                >
                  <h2 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">{section.heading}</h2>
                  <div className="mt-4 space-y-3.5">
                    {section.blocks.map((block, index) => (
                      <LegalBlockView key={`${section.heading}-${index}`} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {document.footerNote ? (
              <p className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-sm leading-relaxed text-slate-500">
                {document.footerNote}
              </p>
            ) : null}
          </article>

          <div className="hidden lg:block">
            <LegalAside document={document} />
          </div>
        </div>
      </div>
    </WexonStaticPageShell>
  );
}
