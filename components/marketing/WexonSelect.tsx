import type { SelectHTMLAttributes } from "react";

type WexonSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  helper?: string;
  options: string[];
};

export default function WexonSelect({
  label,
  helper,
  options,
  className = "",
  ...props
}: WexonSelectProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select
        className={`min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-emerald-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${className}`}
        defaultValue={props.defaultValue ?? ""}
        {...props}
      >
        {!props.defaultValue ? (
          <option value="" disabled>
            Seçiniz
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {helper && <span className="text-xs font-medium text-slate-500">{helper}</span>}
    </label>
  );
}
