import type { LegalBlock, LegalDocument } from "@/lib/legal-content";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, LEGAL_SITE_URL } from "@/lib/legal-content";
import WexonStaticPageShell from "@/components/marketing/WexonStaticPageShell";

function enrichContactLine(line: string) {
  if (line === LEGAL_CONTACT_EMAIL || line.endsWith(LEGAL_CONTACT_EMAIL)) {
    const label = line === LEGAL_CONTACT_EMAIL ? line : line.slice(0, line.indexOf(LEGAL_CONTACT_EMAIL));
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
    return <p className="text-[15px] leading-relaxed text-slate-600 sm:text-base">{block.text}</p>;
  }

  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-600 sm:text-base">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "contact") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[15px] leading-relaxed text-slate-700 sm:text-base">
        {block.lines.map((line) => enrichContactLine(line))}
      </div>
    );
  }

  return <h3 className="pt-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">{block.text}</h3>;
}

export default function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <WexonStaticPageShell badge={document.badge} headline={document.title} description={document.description}>
      <article className="mx-auto max-w-3xl">
        <p className="mb-10 text-sm font-semibold text-slate-500">Son güncelleme: {LEGAL_LAST_UPDATED}</p>

        <div className="space-y-10">
          {document.sections.map((section) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{section.heading}</h2>
              <div className="space-y-3">
                {section.blocks.map((block, index) => (
                  <LegalBlockView key={`${section.heading}-${index}`} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {document.footerNote ? (
          <p className="mt-12 border-t border-slate-200 pt-8 text-sm leading-relaxed text-slate-500">
            {document.footerNote}
          </p>
        ) : null}
      </article>
    </WexonStaticPageShell>
  );
}
