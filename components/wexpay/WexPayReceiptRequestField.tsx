type WexPayReceiptRequestFieldProps = {
  name?: string;
  description?: string;
};

export function WexPayReceiptRequestField({
  name = "receiptRequested",
  description = "Ödeme kaydı ile fiş talebi oluşturulur.",
}: WexPayReceiptRequestFieldProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div>
        <p className="text-sm font-black text-slate-950">Fiş istiyor</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{description}</p>
      </div>
      <input
        type="checkbox"
        name={name}
        value="true"
        className="h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
    </label>
  );
}
