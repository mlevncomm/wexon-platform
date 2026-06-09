import type { TextareaHTMLAttributes } from "react";

type WexonTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  helper?: string;
};

export default function WexonTextarea({
  label,
  helper,
  className = "",
  ...props
}: WexonTextareaProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <textarea
        className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${className}`}
        {...props}
      />
      {helper && <span className="text-xs font-medium text-slate-500">{helper}</span>}
    </label>
  );
}
