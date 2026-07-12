"use client";

import { useState } from "react";
import type { FaqItem, ProductAccent } from "@/types/wexon";
import { ACCENT_CLASSES, SectionHeading, SectionShell } from "@/components/ui";

export default function RoadmapFaqSection({ items, accent }: { items: FaqItem[]; accent: ProductAccent }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const accentClasses = ACCENT_CLASSES[accent];

  return (
    <SectionShell tone="white" width="narrow">
      <SectionHeading
        eyebrow="SSS"
        title="Sık sorulan sorular"
        subtitle="Bu ürünün lansman süreci ve Wexon ekosistemiyle ilişkisi hakkında en çok merak edilenler."
      />

      <div className="mt-12 space-y-3">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-[15px] font-bold text-slate-950">{item.question}</span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 ${
                    isOpen ? `rotate-45 ${accentClasses.soft}` : ""
                  }`}
                  aria-hidden
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
