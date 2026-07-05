"use client";

import { createPaymentAction } from "@/lib/wexpay-actions";
import { WexPayPaymentProviderField } from "@/components/wexpay/WexPayPaymentProviderField";
import { WexPayReceiptRequestField } from "@/components/wexpay/WexPayReceiptRequestField";
import { formatLira } from "@/components/wexpay/WexPayBusinessUI";

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
    <form action={createPaymentAction} className="space-y-3">
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="tableId" value={tableId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <WexPayPaymentProviderField />
      <WexPayReceiptRequestField />

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="table-payment-amount" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Tahsilat tutarı
          </label>
          <span className="text-[11px] font-bold text-slate-500">Kalan: {formatLira(remainingAmount)}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            id="table-payment-amount"
            name="amount"
            defaultValue={remainingAmount}
            inputMode="decimal"
            placeholder="Tahsil edilecek tutar"
            className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#5dff65] px-5 py-3 text-xs font-black text-white shadow-md shadow-[#5dff65]/25 transition-colors hover:bg-[#48e050]"
          >
            Tahsilatı al
          </button>
        </div>
        <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
          Tam ödeme için kalan tutarı değiştirmeyin. Kısmi ödeme alacaksanız tutarı düşürüp aynı butonla kaydedin.
        </p>
      </div>
    </form>
  );
}
