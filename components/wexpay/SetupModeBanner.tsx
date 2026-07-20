import Link from "next/link";
import type { ActivationJourneyView } from "@/lib/wexpay-activation-journey";
import { computeWizardProgress, ACTIVATION_STEP_ORDER } from "@/lib/wexpay-activation-journey";
import { ActivationStepKey } from ".prisma/client";

const STEP_LABELS: Record<ActivationStepKey, string> = {
  BUSINESS_PROFILE: "İşletme profili",
  BRANCH_SETUP: "Şube kurulumu",
  TABLE_SETUP: "Masa kurulumu",
  STAFF_INVITE: "Personel daveti",
  MENU_IMPORT: "Menü aktarımı",
  PAYMENT_PROVIDER: "Ödeme sağlayıcısı",
  VALIDATION: "Doğrulama",
  GO_LIVE: "Canlıya Geçiş",
};

export function SetupModeBanner({
  view,
  continueHref,
}: {
  view: ActivationJourneyView;
  continueHref: string;
}) {
  if (!view.setupMode || view.uiStatus === "ACTIVE") return null;
  const progress = computeWizardProgress(view.journey);
  const blocked = view.uiStatus === "BLOCKED";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">Kurulum Modu</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed">
            Akıllı Aktivasyon devam ediyor
            {progress.activeStep ? ` · ${STEP_LABELS[progress.activeStep]}` : ""}.
            Canlı QR bağlantıları Canlıya Geçiş sonrası açılır.
          </p>
          {blocked && view.journey?.blockedReasonCode ? (
            <p className="mt-1 text-xs font-medium text-amber-800">
              Bloke: {view.journey.blockedReasonCode}
            </p>
          ) : null}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] font-semibold text-amber-700">
            {progress.completed}/{progress.total} adım · %{progress.percent}
          </p>
        </div>
        <Link
          href={continueHref}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800"
        >
          Kuruluma devam et
        </Link>
      </div>
      <ol className="mt-4 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIVATION_STEP_ORDER.map((step) => {
          const row = view.journey?.steps.find((s) => s.stepKey === step);
          const done = row?.status === "COMPLETED" || row?.status === "SKIPPED";
          const current = view.journey?.currentStep === step;
          return (
            <li
              key={step}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                done
                  ? "bg-emerald-100 text-emerald-800"
                  : current
                    ? "bg-white text-amber-900 ring-1 ring-amber-300"
                    : "bg-amber-100/70 text-amber-700"
              }`}
            >
              {STEP_LABELS[step]}
              {done ? " ✓" : current ? " · şimdi" : ""}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
