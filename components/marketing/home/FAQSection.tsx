"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import SectionHeading from "./SectionHeading";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <SectionShell tone="subtle" width="narrow">
      <SectionHeading
        eyebrow="SSS"
        title={
          <>
            Sık sorulan <span className="text-emerald-600">sorular</span>
          </>
        }
        subtitle="Wexon ekosistemi, Wexon Core ve ürün erişim mantığı hakkında en çok merak edilenler."
      />

      <div className="mt-12 space-y-3">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={item.question}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[15px] font-bold text-slate-950">{item.question}</span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 ${
                      isOpen ? "rotate-45 border-emerald-300 text-emerald-600" : ""
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
