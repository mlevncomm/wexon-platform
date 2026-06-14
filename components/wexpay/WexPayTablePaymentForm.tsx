"use client";

import { createPaymentAction } from "@/lib/wexpay-actions";
import { WexPayPaymentProviderField } from "@/components/wexpay/WexPayPaymentProviderField";
import { WexPayReceiptRequestField } from "@/components/wexpay/WexPayReceiptRequestField";
import { DemoSecondaryButton, formatLira } from "@/components/wexpay/WexPayBusinessUI";

export function WexPayTablePaymentForm({
  branchId,
  tableId,
  remainingAmount,
  redirectTo,
}: {
  branchId: string;
  tableId: string;
  remainingAmount: number;
  redirectTo: string;
}) {
  return (
    <div className="space-y-3">
      <form action={createPaymentAction} className="space-y-3">
        <input type="hidden" name="branchId" value={branchId} />
        <input type="hidden" name="tableId" value={tableId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="amount" value={remainingAmount} />
        <WexPayPaymentProviderField />
        <WexPayReceiptRequestField />
        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-500/25 transition-colors hover:bg-emerald-600"
        >
          Tamamını al ({formatLira(remainingAmount)})
        </button>
      </form>

      <form action={createPaymentAction} className="space-y-3">
        <input type="hidden" name="branchId" value={branchId} />
        <input type="hidden" name="tableId" value={tableId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <WexPayPaymentProviderField />
        <WexPayReceiptRequestField />
        <div className="flex gap-2">
          <input
            name="amount"
            defaultValue={remainingAmount}
            placeholder="Kısmi tutar"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-bold outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
          />
          <DemoSecondaryButton className="shrink-0 !w-auto px-4 py-2.5 text-xs">Kısmi Al</DemoSecondaryButton>
        </div>
      </form>
    </div>
  );
}
