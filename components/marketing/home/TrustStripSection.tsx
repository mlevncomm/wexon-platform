import { TRUST_SIGNALS } from "@/lib/wexon-home-content";
import { WexonIcon } from "./icons";

export default function TrustStripSection() {
  return (
    <section className="border-y border-slate-200/70 bg-white px-5 py-12 sm:py-14">
      <div className="mx-auto max-w-[1180px]">
        <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Tek Wexon Core altyapısı üzerinde çalışan güvenilir ekosistem
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {TRUST_SIGNALS.map((signal) => (
            <span
              key={signal.label}
              className="wx-lift inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#f6f8f7] px-4 py-2 text-[0.8125rem] font-bold text-slate-700"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <WexonIcon name={signal.icon} size={14} strokeWidth={2} />
              </span>
              {signal.label}
            </span>
          ))}
        </div>
        <p className="mt-6 text-center text-sm font-medium text-slate-500">
          WexPay Business Suite sahada canlı; WexHotel ve WexB2B aynı Core üzerinde geliştiriliyor.
        </p>
      </div>
    </section>
  );
}
