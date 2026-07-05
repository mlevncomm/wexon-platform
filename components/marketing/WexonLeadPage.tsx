"use client";

import { FormEvent, ReactNode, useState } from "react";
import WexonFormAside from "@/components/marketing/WexonFormAside";
import WexonFormShell from "@/components/marketing/WexonFormShell";
import WexonInput from "@/components/marketing/WexonInput";
import WexonSelect from "@/components/marketing/WexonSelect";
import WexonTextarea from "@/components/marketing/WexonTextarea";

export type LeadField = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "time" | "textarea" | "select";
  options?: string[];
};

type WexonLeadPageProps = {
  badge: string;
  headline: string;
  description: string;
  fields: LeadField[];
  submitLabel: string;
  successMessage: string;
  sideTitle: string;
  sideItems: string[];
  formTitle?: string;
  formDescription?: string;
  formNote?: string;
  children?: ReactNode;
};

export default function WexonLeadPage({
  badge,
  headline,
  description,
  fields,
  submitLabel,
  successMessage,
  sideTitle,
  sideItems,
  formTitle,
  formDescription,
  formNote,
  children,
}: WexonLeadPageProps) {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <WexonFormShell after={children}>
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <WexonFormAside
          badge={badge}
          headline={headline}
          description={description}
          title={sideTitle}
          items={sideItems}
        />

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
          <div className="mb-6">
            <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-700">
              Form
            </span>
            <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950">
              {formTitle ?? headline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {formDescription ?? description}
            </p>
          </div>
          {submitted && (
            <p className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              {successMessage}
            </p>
          )}
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <LeadFormField key={field.name} field={field} />
            ))}
            {formNote && (
              <p className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-relaxed text-slate-600">
                {formNote}
              </p>
            )}
            <button
              type="submit"
              className="sm:col-span-2 inline-flex w-full items-center justify-center rounded-full bg-[#5dff65] px-6 py-4 text-sm font-bold text-white shadow-sm shadow-[#5dff65]/20 transition-colors hover:bg-[#48e050]"
            >
              {submitLabel}
            </button>
          </form>
        </section>
      </section>
    </WexonFormShell>
  );
}

function LeadFormField({ field }: { field: LeadField }) {
  const isWide = field.type === "textarea";

  return (
    <div className={isWide ? "sm:col-span-2" : ""}>
      {field.type === "textarea" ? (
        <WexonTextarea name={field.name} rows={5} label={field.label} />
      ) : field.type === "select" ? (
        <WexonSelect name={field.name} label={field.label} options={field.options ?? []} />
      ) : (
        <WexonInput name={field.name} type={field.type ?? "text"} label={field.label} />
      )}
    </div>
  );
}
