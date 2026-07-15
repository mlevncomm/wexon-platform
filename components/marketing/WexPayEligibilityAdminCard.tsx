import { AdminInfoRow } from "@/components/marketing/WexonAdminCards";
import {
  buildWexPayEligibilityAdminView,
  type ReviewStatusBadgeTone,
} from "@/lib/wexpay-eligibility-admin-display";

const toneClasses: Record<ReviewStatusBadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  warning: "bg-amber-50 text-amber-900 ring-amber-100",
  danger: "bg-rose-50 text-rose-800 ring-rose-100",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200/80",
};

/** Admin-only eligibility summary for a demo/lead row. Never serialize raw risk keys to applicants. */
export default function WexPayEligibilityAdminCard({ metadataJson }: { metadataJson: unknown }) {
  const view = buildWexPayEligibilityAdminView(metadataJson);

  if (!view.hasEligibilitySignal) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 to-white p-3.5 sm:p-4"
      aria-label="WexPay Uygunluk Değerlendirmesi"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-950">WexPay Uygunluk Değerlendirmesi</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{view.disclaimer}</p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${toneClasses[view.reviewStatusTone]}`}
        >
          {view.reviewStatusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <AdminInfoRow label="Talep edilen paket" value={view.preferredTierLabel} />
        <AdminInfoRow label="Önerilen paket" value={view.recommendedTierLabel} />
        <AdminInfoRow label="İnceleme durumu" value={view.reviewStatusLabel} />
        <AdminInfoRow label="Aylık işlem hacmi" value={view.monthlyGmvLabel} />
        <AdminInfoRow label="Lokasyon sayısı" value={view.locationCountLabel} />
        <AdminInfoRow label="Sektör" value={view.sectorLabel} />
        <AdminInfoRow label="İşletme tipi" value={view.companyTypeLabel} />
        <AdminInfoRow label="Ortalama sepet" value={view.avgTicketLabel} />
      </div>

      <div className="mt-3">
        <AdminInfoRow label="İhtiyaçlar" value={view.needsLabel} />
      </div>

      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700/80">
          Dahili değerlendirme notları
        </p>
        {view.riskReasonLabels.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm font-semibold text-amber-950">
            {view.riskReasonLabels.map((label) => (
              <li key={label} className="break-words">
                {label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-semibold text-amber-900/80">Belirtilmedi</p>
        )}
      </div>
    </section>
  );
}
