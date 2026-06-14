"use client";

import { useState } from "react";

const PROVIDER_OPTIONS = [
  { value: "manual", label: "Manuel tahsilat" },
  { value: "paytr", label: "PayTR sanal POS" },
] as const;

export type WexPayPaymentProviderChoice = (typeof PROVIDER_OPTIONS)[number]["value"];

export function WexPayPaymentProviderField({
  defaultValue = "manual",
  showStatusField = false,
  statusOptions,
  statusDefaultValue = "PAID",
}: {
  defaultValue?: WexPayPaymentProviderChoice;
  showStatusField?: boolean;
  statusOptions?: { value: string; label: string }[];
  statusDefaultValue?: string;
}) {
  const [provider, setProvider] = useState<WexPayPaymentProviderChoice>(defaultValue);
  const isPaytr = provider === "paytr";

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          Tahsilat yöntemi
        </span>
        <select
          name="provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value as WexPayPaymentProviderChoice)}
          className="w-full rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
        >
          {PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {isPaytr ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-[11px] font-medium leading-relaxed text-sky-900">
          Ödeme PayTR üzerinden tamamlanınca masa otomatik güncellenir. WexPay para tutmaz; tahsilat firmanızın
          PayTR sanal POS anlaşması üzerinden gerçekleşir.
        </div>
      ) : null}

      {showStatusField && !isPaytr && statusOptions ? (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Durum</span>
          <select
            name="status"
            defaultValue={statusDefaultValue}
            className="w-full rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!showStatusField && !isPaytr ? <input type="hidden" name="status" value="PAID" /> : null}
    </>
  );
}
