"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { MembershipRole } from ".prisma/client";
import {
  acknowledgeQrPackAction,
  applyMenuImportAction,
  cancelMenuImportAction,
  completeStaffInviteStepAction,
  createStaffInviteAction,
  createTablesWizardAction,
  recoverQrPackAction,
  revokeStaffInviteAction,
  rotateTableQrWizardAction,
  goLiveActivationAction,
  runActivationValidationAction,
  saveActivationPaymentProviderAction,
  saveBranchSetupAction,
  saveBusinessProfileAction,
  skipMenuImportEmptyStartAction,
  uploadMenuImportDryRunAction,
  type WizardActionState,
} from "@/lib/wexpay-activation-wizard-actions";
import {
  downloadTableQrPng,
  generateTableQrDataUrl,
  buildTableQrPrintHtml,
} from "@/lib/wexpay-table-qr";
import type { WizardIssuedQr } from "@/lib/wexpay-activation-wizard";
import type { MenuImportJobView } from "@/lib/wexpay-menu-import";
import type { ActivationPaymentProviderSafeMetadata } from "@/lib/wexpay-activation-payment-provider";
import type {
  ActivationValidationCheck,
  ActivationValidationSafeMetadata,
  ActivationValidationStatus,
} from "@/lib/wexpay-activation-validation";

type StepKey =
  | "BUSINESS_PROFILE"
  | "BRANCH_SETUP"
  | "TABLE_SETUP"
  | "STAFF_INVITE"
  | "MENU_IMPORT"
  | "PAYMENT_PROVIDER"
  | "VALIDATION"
  | "GO_LIVE";

type InviteRow = {
  id: string;
  email: string;
  role: MembershipRole;
  deliveryStatus: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  lastDeliveryErrorCode: string | null;
};

type Props = {
  organizationId: string;
  organization: {
    name: string;
    slug: string;
    legalName: string | null;
    taxNo: string | null;
    phone: string | null;
    email: string | null;
    country: string;
  };
  journeyVersion: number;
  currentStep: StepKey;
  stepStatuses: Record<StepKey, string>;
  branchId: string | null;
  restaurantId: string | null;
  restaurants: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string; restaurantId: string; address: string | null }>;
  invites: InviteRow[];
  isLegacyActive: boolean;
  awaitingQrAck: boolean;
  canSkipStaffInvite: boolean;
  menuImportJob: MenuImportJobView | null;
  publicOrigin: string;
  actorRole: MembershipRole | null;
  journeyStatus: string;
  blockedReasonCode: string | null;
  selectedProvider: ActivationPaymentProviderSafeMetadata | null;
  latestValidationSummary: ActivationValidationSafeMetadata | null;
  paytrApiEnabled: boolean;
  isProductionEnvironment: boolean;
  advancedRolesEnabled?: boolean;
};

const initial: WizardActionState = { ok: false };

const INVITE_ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  MANAGER: "Müdür",
  STAFF: "Personel",
  BILLING: "Faturalama",
  VIEWER: "Görüntüleyici",
};

const VALIDATION_STATUS_LABELS: Record<ActivationValidationStatus, string> = {
  PASS: "Geçti",
  WARNING: "Uyarı",
  FAIL: "Başarısız",
};

function SuccessBox({ state }: { state: WizardActionState }) {
  if (!state.ok || !state.message) return null;
  return (
    <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" role="status">
      {state.message}
    </p>
  );
}

function ValidationCard({ check }: { check: ActivationValidationCheck }) {
  const style =
    check.status === "PASS"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : check.status === "WARNING"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-rose-200 bg-rose-50 text-rose-950";
  return (
    <li className={`rounded-xl border p-3 ${style}`} data-testid={`activation-check-${check.status.toLowerCase()}`}>
      <p className="text-xs font-black uppercase tracking-wide">{VALIDATION_STATUS_LABELS[check.status]}</p>
      <h3 className="mt-1 text-sm font-black">{check.title}</h3>
      <p className="mt-1 text-sm font-medium">{check.description}</p>
      {check.remediationHref ? (
        <a href={check.remediationHref} className="mt-2 inline-flex text-sm font-black underline">
          Düzelt
        </a>
      ) : null}
    </li>
  );
}
const INVITE_DELIVERY_LABELS: Record<string, string> = {
  PENDING: "Gönderim bekliyor",
  SENT: "Gönderildi",
  FAILED: "Gönderilemedi",
};
const MENU_IMPORT_STATUS_LABELS: Record<string, string> = {
  DRY_RUN: "Önizleme hazır",
  APPLYING: "Uygulanıyor",
  APPLIED: "Tamamlandı",
  FAILED: "Yarım kaldı",
  CANCELLED: "İptal edildi",
};

function ErrorBox({ state }: { state: WizardActionState }) {
  if (state.ok || !state.error) return null;
  return (
    <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800" role="alert">
      {state.error}
    </p>
  );
}

function QrPackCards({
  qrs,
  originHint,
}: {
  qrs: WizardIssuedQr[];
  originHint: string;
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const qr of qrs) {
        const absolute = `${originHint}${qr.publicPath}`;
        next[qr.tableId] = await generateTableQrDataUrl(absolute);
      }
      if (!cancelled) setPreviews(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [qrs, originHint]);

  return (
    <ul className="space-y-3" data-testid="wizard-qr-pack">
      {qrs.map((qr) => {
        const absolute = `${originHint}${qr.publicPath}`;
        const preview = previews[qr.tableId];
        return (
          <li
            key={qr.tableId}
            className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 px-3 py-3"
            data-testid="wizard-qr-card"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={`${qr.label} QR`}
                width={120}
                height={120}
                className="rounded-lg border border-slate-100"
                data-testid="wizard-qr-image"
              />
            ) : (
              <div className="flex h-[120px] w-[120px] items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
                QR…
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-bold text-slate-900">{qr.label}</p>
              <p className="break-all font-mono text-xs text-slate-600">{absolute}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-800"
                  data-testid="wizard-qr-download"
                  onClick={() => {
                    void downloadTableQrPng(absolute, qr.label);
                  }}
                >
                  İndir PNG
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-800"
                  data-testid="wizard-qr-print"
                  onClick={() => {
                    void (async () => {
                      const dataUrl = preview ?? (await generateTableQrDataUrl(absolute));
                      const html = buildTableQrPrintHtml({
                        tableLabel: qr.label,
                        publicUrl: absolute,
                        qrDataUrl: dataUrl,
                      });
                      const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
                      if (!win) return;
                      win.document.write(html);
                      win.document.close();
                      win.focus();
                      win.print();
                    })();
                  }}
                >
                  Yazdır
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivationWizardClient(props: Props) {
  const [profileState, profileAction, profilePending] = useActionState(saveBusinessProfileAction, initial);
  const [branchState, branchAction, branchPending] = useActionState(saveBranchSetupAction, initial);
  const [tableState, tableAction, tablePending] = useActionState(createTablesWizardAction, initial);
  const [recoverState, recoverAction, recoverPending] = useActionState(recoverQrPackAction, initial);
  const [rotateState, rotateAction, rotatePending] = useActionState(rotateTableQrWizardAction, initial);
  const [ackState, ackAction, ackPending] = useActionState(acknowledgeQrPackAction, initial);
  const [inviteState, inviteAction, invitePending] = useActionState(createStaffInviteAction, initial);
  const [revokeState, revokeAction] = useActionState(revokeStaffInviteAction, initial);
  const [staffDoneState, staffDoneAction, staffDonePending] = useActionState(
    completeStaffInviteStepAction,
    initial,
  );
  const [menuUploadState, menuUploadAction, menuUploadPending] = useActionState(
    uploadMenuImportDryRunAction,
    initial,
  );
  const [menuApplyState, menuApplyAction, menuApplyPending] = useActionState(applyMenuImportAction, initial);
  const [menuCancelState, menuCancelAction, menuCancelPending] = useActionState(
    cancelMenuImportAction,
    initial,
  );
  const [menuSkipState, menuSkipAction, menuSkipPending] = useActionState(
    skipMenuImportEmptyStartAction,
    initial,
  );
  const [providerState, providerAction, providerPending] = useActionState(
    saveActivationPaymentProviderAction,
    initial,
  );
  const [validationState, validationAction, validationPending] = useActionState(
    runActivationValidationAction,
    initial,
  );
  const [goLiveState, goLiveAction, goLivePending] = useActionState(
    goLiveActivationAction,
    initial,
  );
  const [forceReimport, setForceReimport] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [provider, setProvider] = useState<"MANUAL" | "PAYTR">(
    props.selectedProvider?.provider ?? "MANUAL",
  );
  const [manualAcknowledged, setManualAcknowledged] = useState(false);
  const [goLiveConfirmed, setGoLiveConfirmed] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const menuApplyFormRef = useRef<HTMLFormElement>(null);

  const issuedQrs = useMemo(() => {
    if (tableState.ok && tableState.issuedQrs?.length) return tableState.issuedQrs;
    if (recoverState.ok && recoverState.issuedQrs?.length) return recoverState.issuedQrs;
    if (rotateState.ok && rotateState.issuedQrs?.length) {
      // Merge rotated single QR into last pack if present
      const base =
        (tableState.ok && tableState.issuedQrs) ||
        (recoverState.ok && recoverState.issuedQrs) ||
        [];
      if (!base.length) return rotateState.issuedQrs;
      const rotated = rotateState.issuedQrs[0]!;
      return base.map((qr) => (qr.tableId === rotated.tableId ? rotated : qr));
    }
    return null;
  }, [tableState, recoverState, rotateState]);

  const effectiveVersion =
    tableState.journeyVersion ??
    recoverState.journeyVersion ??
    props.journeyVersion;

  const oneTimeUrl = inviteState.ok && inviteState.oneTimeInviteUrl ? inviteState.oneTimeInviteUrl : null;

  const menuJob: MenuImportJobView | null =
    menuApplyState.menuImportJob ??
    menuUploadState.menuImportJob ??
    menuCancelState.menuImportJob ??
    props.menuImportJob;

  const menuJourneyVersion =
    menuApplyState.journeyVersion ?? menuSkipState.journeyVersion ?? props.journeyVersion;

  // Continue apply across request-bounded chunks (~50 rows each).
  useEffect(() => {
    if (!confirmApply || menuApplyPending) return;
    if (!menuApplyState.ok) return;
    if (menuApplyState.menuImportDone !== false) return;
    if (menuJob?.status !== "APPLYING" && menuJob?.status !== "FAILED") return;
    const timer = window.setTimeout(() => {
      menuApplyFormRef.current?.requestSubmit();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [
    confirmApply,
    menuApplyPending,
    menuApplyState.ok,
    menuApplyState.menuImportDone,
    menuApplyState.menuImportJob?.version,
    menuJob?.status,
  ]);

  if (props.isLegacyActive) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
        <h2 className="text-lg font-black">Canlı Kullanım</h2>
        <p className="mt-2 text-sm font-medium">
          Bu organizasyon zaten canlıda. Akıllı Aktivasyon sihirbazı yeniden açılmaz.
        </p>
      </div>
    );
  }

  const step = props.currentStep;
  const originHint = props.publicOrigin;

  const showQrPack = Boolean(issuedQrs?.length) || props.awaitingQrAck;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Akıllı Aktivasyon</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Kurulum sihirbazı</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-600">
          İşletme profili, şube, güvenli QR masaları ve personel davetlerini adım adım tamamlayın.
          Canlı QR, sipariş ve ödeme bağlantıları Yayına alma sonrası açılır.
        </p>
        <SuccessBox state={providerState} />
        <ErrorBox state={goLiveState} />
      </div>

      {step === "BUSINESS_PROFILE" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">1. İşletme profili</h2>
          <form action={profileAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="organizationId" value={props.organizationId} />
            <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
              İşletme adı *
              <input
                name="name"
                required
                defaultValue={props.organization.name}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Ticari unvan
              <input name="legalName" defaultValue={props.organization.legalName ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Vergi no
              <input name="taxNo" defaultValue={props.organization.taxNo ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Telefon
              <input name="phone" defaultValue={props.organization.phone ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              E-posta
              <input name="email" type="email" defaultValue={props.organization.email ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Ülke
              <input name="country" defaultValue={props.organization.country || "TR"} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={profilePending}
                className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {profilePending ? "Kaydediliyor…" : "Kaydet ve devam"}
              </button>
              <ErrorBox state={profileState} />
            </div>
          </form>
        </section>
      ) : null}

      {step === "BRANCH_SETUP" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">2. Şube kurulumu</h2>
          <form action={branchAction} className="mt-4 grid gap-3">
            <input type="hidden" name="organizationId" value={props.organizationId} />
            <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
            {/* Explicit IDs only when user/server selected them — never auto-pick first row blindly on server. */}
            <input type="hidden" name="existingRestaurantId" value={props.restaurantId ?? ""} />
            <input type="hidden" name="existingBranchId" value={props.branchId ?? ""} />
            {props.restaurants.length > 1 ? (
              <label className="block text-sm font-semibold text-slate-700">
                Mevcut restoran (isteğe bağlı)
                <select
                  name="existingRestaurantIdSelect"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  defaultValue={props.restaurantId ?? ""}
                  onChange={(e) => {
                    const hidden = e.currentTarget.form?.elements.namedItem(
                      "existingRestaurantId",
                    ) as HTMLInputElement | null;
                    if (hidden) hidden.value = e.currentTarget.value;
                  }}
                >
                  <option value="">Yeni restoran oluştur</option>
                  {props.restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {props.branches.length > 0 ? (
              <label className="block text-sm font-semibold text-slate-700">
                Mevcut şube (isteğe bağlı)
                <select
                  name="existingBranchIdSelect"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  defaultValue={props.branchId ?? ""}
                  onChange={(e) => {
                    const hidden = e.currentTarget.form?.elements.namedItem(
                      "existingBranchId",
                    ) as HTMLInputElement | null;
                    if (hidden) hidden.value = e.currentTarget.value;
                  }}
                >
                  <option value="">Yeni şube oluştur</option>
                  {props.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-sm font-semibold text-slate-700">
              Restoran adı *
              <input
                name="restaurantName"
                required
                defaultValue={props.restaurants.find((r) => r.id === props.restaurantId)?.name ?? props.organization.name}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Şube adı *
              <input
                name="branchName"
                required
                defaultValue={props.branches.find((b) => b.id === props.branchId)?.name ?? "Merkez"}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Şube adresi *
              <input
                name="branchAddress"
                required
                defaultValue={props.branches.find((b) => b.id === props.branchId)?.address ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={branchPending}
              className="w-fit rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {branchPending ? "Kaydediliyor…" : "Şubeyi kaydet"}
            </button>
            <ErrorBox state={branchState} />
          </form>
        </section>
      ) : null}

      {step === "TABLE_SETUP" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">3. Masa ve güvenli QR</h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            QR bağlantıları yalnız <code className="rounded bg-slate-100 px-1">/q/…</code> opaque token kullanır.
          </p>
          {!showQrPack || !issuedQrs ? (
            <div className="mt-4 space-y-3">
              <form action={tableAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="organizationId" value={props.organizationId} />
                <input type="hidden" name="expectedVersion" value={String(effectiveVersion)} />
                <input type="hidden" name="branchId" value={props.branchId ?? ""} />
                <label className="block text-sm font-semibold text-slate-700">
                  Masa adedi
                  <input name="count" type="number" min={1} max={50} defaultValue={5} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Etiket öneki
                  <input name="prefix" defaultValue="Masa" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Koltuk
                  <input name="seats" type="number" min={1} max={50} defaultValue={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Başlangıç no
                  <input name="startNumber" type="number" min={1} defaultValue={1} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                </label>
                <button
                  type="submit"
                  disabled={tablePending || !props.branchId}
                  className="sm:col-span-2 w-fit rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {tablePending ? "Oluşturuluyor…" : "Masaları ve QR’ları oluştur"}
                </button>
                <ErrorBox state={tableState} />
              </form>
              {props.awaitingQrAck ? (
                <form action={recoverAction}>
                  <input type="hidden" name="organizationId" value={props.organizationId} />
                  <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
                  <button
                    type="submit"
                    disabled={recoverPending}
                    className="rounded-full border border-amber-400 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-950 disabled:opacity-60"
                    data-testid="wizard-qr-recover"
                  >
                    {recoverPending ? "Kurtarılıyor…" : "QR paketini güvenli şekilde yenile / kurtar"}
                  </button>
                  <ErrorBox state={recoverState} />
                </form>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                Ham token yalnız bu ekranda gösterilir. Kaybederseniz aynı masalar için QR’ı güvenle yenileyin.
              </div>
              <QrPackCards qrs={issuedQrs} originHint={originHint} />
              <div className="flex flex-wrap gap-2">
                <form action={recoverAction}>
                  <input type="hidden" name="organizationId" value={props.organizationId} />
                  <input type="hidden" name="expectedVersion" value={String(effectiveVersion)} />
                  <button
                    type="submit"
                    disabled={recoverPending}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-60"
                    data-testid="wizard-qr-recover"
                  >
                    Tüm QR’ları yenile
                  </button>
                </form>
                {issuedQrs[0] ? (
                  <form action={rotateAction}>
                    <input type="hidden" name="organizationId" value={props.organizationId} />
                    <input type="hidden" name="expectedVersion" value={String(effectiveVersion)} />
                    <input type="hidden" name="tableId" value={issuedQrs[0].tableId} />
                    <button
                      type="submit"
                      disabled={rotatePending}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-60"
                      data-testid="wizard-qr-rotate-one"
                    >
                      İlk masanın QR’ını döndür
                    </button>
                  </form>
                ) : null}
              </div>
              <ErrorBox state={recoverState} />
              <ErrorBox state={rotateState} />
              <form action={ackAction}>
                <input type="hidden" name="organizationId" value={props.organizationId} />
                <input type="hidden" name="expectedVersion" value={String(effectiveVersion)} />
                <input type="hidden" name="branchId" value={props.branchId ?? ""} />
                <button
                  type="submit"
                  disabled={ackPending}
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {ackPending ? "Onaylanıyor…" : "QR paketini kaydettim, devam"}
                </button>
                <ErrorBox state={ackState} />
              </form>
            </div>
          )}
        </section>
      ) : null}

      {step === "STAFF_INVITE" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">4. Personel daveti</h2>
          <form action={inviteAction} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="organizationId" value={props.organizationId} />
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
              E-posta
              <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Rol
              <select name="role" defaultValue="STAFF" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                {props.advancedRolesEnabled ? (
                  <>
                    <option value="ADMIN">Yönetici</option>
                    <option value="MANAGER">Müdür</option>
                    <option value="STAFF">Personel</option>
                    <option value="BILLING">Faturalama</option>
                    <option value="VIEWER">Görüntüleyici</option>
                  </>
                ) : (
                  <>
                    <option value="STAFF">Personel</option>
                    <option value="VIEWER">Görüntüleyici</option>
                  </>
                )}
              </select>
            </label>
            <button
              type="submit"
              disabled={invitePending}
              className="sm:col-span-3 w-fit rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {invitePending ? "Gönderiliyor…" : "Davet gönder"}
            </button>
            <ErrorBox state={inviteState} />
            {oneTimeUrl ? (
              <p className="sm:col-span-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                Önizleme bağlantısı (yalnız size, bir kez): <span className="break-all font-mono">{oneTimeUrl}</span>
              </p>
            ) : null}
          </form>

          <ul className="mt-4 space-y-2">
            {props.invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <div>
                  <p className="font-bold">{invite.email}</p>
                  <p className="text-xs text-slate-500">
                    {INVITE_ROLE_LABELS[invite.role]} ·{" "}
                    {INVITE_DELIVERY_LABELS[invite.deliveryStatus] ?? "Gönderim durumu bilinmiyor"}
                    {invite.acceptedAt ? " · kabul edildi" : ""}
                    {invite.revokedAt ? " · iptal" : ""}
                  </p>
                </div>
                {!invite.acceptedAt && !invite.revokedAt ? (
                  <form action={revokeAction}>
                    <input type="hidden" name="organizationId" value={props.organizationId} />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button type="submit" className="text-xs font-bold text-rose-700 hover:underline">
                      İptal et
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          <ErrorBox state={revokeState} />

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={staffDoneAction}>
              <input type="hidden" name="organizationId" value={props.organizationId} />
              <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
              <button
                type="submit"
                disabled={staffDonePending}
                className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                Davet adımını tamamla
              </button>
            </form>
            {props.canSkipStaffInvite ? (
              <form action={staffDoneAction}>
                <input type="hidden" name="organizationId" value={props.organizationId} />
                <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
                <input type="hidden" name="skip" value="1" />
                <button
                  type="submit"
                  disabled={staffDonePending}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-60"
                >
                  Personel eklemeden devam et
                </button>
              </form>
            ) : null}
            <p className="w-full text-xs font-medium text-slate-500">
              “Personel eklemeden devam et”, açık bir kullanıcı kararıdır (yalnız sahip hesabıyla devam).
            </p>
            <ErrorBox state={staffDoneState} />
          </div>
        </section>
      ) : null}

      {step === "MENU_IMPORT" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" data-testid="wizard-menu-import">
          <h2 className="text-lg font-black text-slate-950">5. Menü içe aktarma</h2>
          <p className="mt-1 text-sm text-slate-600">
            CSV/XLSX hızlı aktarım. PDF, fotoğraf veya yapay zeka aktarımı bu adımda yoktur.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/api/wexpay/menu-import/template?format=csv"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800"
              data-testid="menu-import-template-csv"
            >
              Örnek CSV indir
            </a>
            <a
              href="/api/wexpay/menu-import/template?format=xlsx"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800"
              data-testid="menu-import-template-xlsx"
            >
              Örnek XLSX indir
            </a>
          </div>

          <form action={menuUploadAction} className="mt-4 space-y-3">
            <input type="hidden" name="organizationId" value={props.organizationId} />
            <input type="hidden" name="expectedVersion" value={String(menuJourneyVersion)} />
            <input type="hidden" name="branchId" value={props.branchId ?? ""} />
            <input type="hidden" name="forceReimport" value={forceReimport ? "1" : "0"} />
            <label className="block text-sm font-semibold text-slate-700">
              Menü dosyası (.csv veya .xlsx, en fazla 2 MB / 2000 satır)
              <input
                name="file"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="mt-1 block w-full text-sm"
                data-testid="menu-import-file"
              />
            </label>
            <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={forceReimport}
                onChange={(e) => setForceReimport(e.target.checked)}
                className="mt-1"
                data-testid="menu-import-force-reimport"
              />
              Aynı dosyayı yeniden içe aktar (önceki uygulamanın üzerine yaz)
            </label>
            <button
              type="submit"
              disabled={menuUploadPending || !props.branchId}
              className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              data-testid="menu-import-upload"
            >
              {menuUploadPending ? "Çözümleniyor…" : "Yükle ve önizle"}
            </button>
            <ErrorBox state={menuUploadState} />
          </form>

          {menuJob ? (
            <div className="mt-6 space-y-4" data-testid="menu-import-preview">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <p className="font-bold text-slate-900">
                  {menuJob.originalFileName} ·{" "}
                  {MENU_IMPORT_STATUS_LABELS[menuJob.status] ?? "Durum bilinmiyor"}
                </p>
                <p className="mt-1 text-slate-600">
                  Satır: {menuJob.totalRows} · Geçerli: {menuJob.validRows} · Hatalı: {menuJob.errorRows} ·
                  Uygulanan: {menuJob.appliedRows}
                </p>
                {menuJob.preview ? (
                  <ul className="mt-2 grid gap-1 text-slate-700 sm:grid-cols-2">
                    <li>Yeni kategori: {menuJob.preview.categoriesToCreate}</li>
                    <li>Yeni ürün: {menuJob.preview.productsToCreate}</li>
                    <li>Güncellenecek ürün: {menuJob.preview.productsToUpdate}</li>
                    <li>
                      Seçenek grubu / seçenek: {menuJob.preview.modifierGroups} /{" "}
                      {menuJob.preview.modifierOptions}
                    </li>
                    <li>
                      Plan limiti: {menuJob.preview.productLimit ?? "sınırsız"} · Kullanılan:{" "}
                      {menuJob.preview.productsUsed} · Sonrası: {menuJob.preview.productsAfter}
                    </li>
                    {menuJob.preview.wouldExceedLimit ? (
                      <li className="font-bold text-rose-700 sm:col-span-2" role="alert">
                        Bu aktarım ürün limitini aşar.
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {menuJob.duplicateChecksumWarning ? (
                  <p className="mt-2 font-semibold text-amber-800" role="status" data-testid="menu-import-duplicate-warning">
                    Aynı dosya daha önce uygulandı. Yeniden aktarmak için kutuyu işaretleyin.
                  </p>
                ) : null}
                {menuJob.status === "FAILED" ? (
                  <p className="mt-2 font-semibold text-rose-800" role="alert" data-testid="menu-import-failed">
                    Uygulama yarım kaldı ({menuJob.lastErrorCode ?? "hata"}). Kaldığı yerden devam
                    edebilirsiniz.
                  </p>
                ) : null}
                {menuJob.status === "APPLIED" ? (
                  <p className="mt-2 font-semibold text-emerald-800" data-testid="menu-import-applied">
                    Menü başarıyla uygulandı.
                  </p>
                ) : null}
              </div>

              {menuJob.rowErrors.length > 0 ? (
                <div data-testid="menu-import-errors">
                  <h3 className="text-sm font-black text-slate-900">Satır hataları</h3>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-rose-800">
                    {menuJob.rowErrors.map((err) => (
                      <li key={`${err.rowNumber}-${err.errorCode}`}>
                        Satır {err.rowNumber}: {err.message} ({err.errorCode})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {menuJob.status === "DRY_RUN" ||
              menuJob.status === "APPLYING" ||
              menuJob.status === "FAILED" ? (
                <div className="space-y-3">
                  <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={confirmApply}
                      onChange={(e) => setConfirmApply(e.target.checked)}
                      className="mt-1"
                      data-testid="menu-import-confirm-apply"
                    />
                    Önizlemeyi onaylıyorum; menüyü uygula
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <form ref={menuApplyFormRef} action={menuApplyAction}>
                      <input type="hidden" name="organizationId" value={props.organizationId} />
                      <input type="hidden" name="expectedVersion" value={String(menuJourneyVersion)} />
                      <input type="hidden" name="jobId" value={menuJob.id} />
                      <input type="hidden" name="jobExpectedVersion" value={String(menuJob.version)} />
                      <input type="hidden" name="confirmApply" value={confirmApply ? "1" : "0"} />
                      <input type="hidden" name="forceReimport" value={forceReimport ? "1" : "0"} />
                      <button
                        type="submit"
                        disabled={
                          menuApplyPending ||
                          !confirmApply ||
                          menuJob.validRows < 1 ||
                          (menuJob.duplicateChecksumWarning && !forceReimport) ||
                          Boolean(menuJob.preview?.wouldExceedLimit)
                        }
                        className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                        data-testid="menu-import-apply"
                      >
                        {menuApplyPending
                          ? `Uygulanıyor… (${menuJob.appliedRows}/${menuJob.validRows || menuJob.totalRows})`
                          : menuJob.status === "FAILED" || menuJob.status === "APPLYING"
                            ? "Kaldığı yerden devam et"
                            : "Menüyü uygula"}
                      </button>
                    </form>
                    <form action={menuCancelAction}>
                      <input type="hidden" name="organizationId" value={props.organizationId} />
                      <input type="hidden" name="expectedVersion" value={String(menuJourneyVersion)} />
                      <input type="hidden" name="jobId" value={menuJob.id} />
                      <input type="hidden" name="jobExpectedVersion" value={String(menuJob.version)} />
                      <button
                        type="submit"
                        disabled={menuCancelPending}
                        className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-60"
                        data-testid="menu-import-cancel"
                      >
                        İptal et
                      </button>
                    </form>
                  </div>
                  <ErrorBox state={menuApplyState} />
                  <ErrorBox state={menuCancelState} />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-black text-slate-900">Menüyü daha sonra oluşturacağım</h3>
            <p className="mt-1 text-xs text-slate-600">
              Boş menüyle devam edebilirsiniz. Panelden sonradan menü eklemek engellenmez. Otomatik atlama
              yoktur.
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={confirmEmpty}
                onChange={(e) => setConfirmEmpty(e.target.checked)}
                className="mt-1"
                data-testid="menu-import-confirm-empty"
              />
              Onaylıyorum: menüyü daha sonra panelden oluşturacağım
            </label>
            <form action={menuSkipAction} className="mt-3">
              <input type="hidden" name="organizationId" value={props.organizationId} />
              <input type="hidden" name="expectedVersion" value={String(menuJourneyVersion)} />
              <input type="hidden" name="confirmEmpty" value={confirmEmpty ? "1" : "0"} />
              <button
                type="submit"
                disabled={menuSkipPending || !confirmEmpty}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-60"
                data-testid="menu-import-empty-start"
              >
                Boş menüyle devam et
              </button>
            </form>
            <ErrorBox state={menuSkipState} />
          </div>
        </section>
      ) : null}

      {step === "PAYMENT_PROVIDER" ? (
        <section
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
          data-testid="wizard-payment-provider"
        >
          <h2 className="text-lg font-black text-slate-950">6. Ödeme altyapısı</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Tahsilat yönteminizi seçin. Sağlayıcı bilgileri şifreli saklanır ve bu ekranda tekrar gösterilmez.
          </p>
          {props.selectedProvider ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              Seçili yöntem: {props.selectedProvider.provider === "MANUAL" ? "Manuel tahsilat" : `PayTR · ${props.selectedProvider.mode}`}
              {props.selectedProvider.provider === "PAYTR" ? (
                <span className="mt-1 block text-xs text-slate-500">
                  Anahtar parmak izi: {props.selectedProvider.keyFingerprint}
                </span>
              ) : null}
              {props.selectedProvider.provider === "PAYTR" &&
              props.selectedProvider.mode === "TEST" &&
              props.isProductionEnvironment ? (
                <span className="mt-1 block text-xs font-bold text-amber-700">
                  Üretimde online kart ödemesi için LIVE bağlantı seçilmelidir.
                </span>
              ) : null}
            </div>
          ) : null}
          <form action={providerAction} className="mt-4 space-y-4">
            <input type="hidden" name="organizationId" value={props.organizationId} />
            <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
            <input type="hidden" name="provider" value={provider} />
            <fieldset>
              <legend className="text-sm font-black text-slate-900">Ödeme yöntemi</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <input
                    type="radio"
                    name="providerChoice"
                    value="MANUAL"
                    checked={provider === "MANUAL"}
                    onChange={() => setProvider("MANUAL")}
                    className="mt-1"
                    data-testid="provider-manual"
                  />
                  <span>
                    <span className="block text-sm font-black text-slate-950">Manuel tahsilat</span>
                    <span className="mt-1 block text-xs font-medium text-slate-600">Nakit veya fiziksel POS</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <input
                    type="radio"
                    name="providerChoice"
                    value="PAYTR"
                    checked={provider === "PAYTR"}
                    onChange={() => setProvider("PAYTR")}
                    className="mt-1"
                    data-testid="provider-paytr"
                  />
                  <span>
                    <span className="block text-sm font-black text-slate-950">PayTR</span>
                    <span className="mt-1 block text-xs font-medium text-slate-600">Online QR kart ödemesi</span>
                  </span>
                </label>
              </div>
            </fieldset>

            {provider === "MANUAL" ? (
              <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                <input
                  type="checkbox"
                  name="manualAcknowledged"
                  value="1"
                  checked={manualAcknowledged}
                  onChange={(event) => setManualAcknowledged(event.target.checked)}
                  className="mt-1"
                  data-testid="provider-manual-ack"
                />
                QR sipariş kullanılabilir; online kart ödemesi yerine nakit/fiziksel POS tahsilatı kaydedilir.
              </label>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Bağlantı modu
                  <select
                    name="mode"
                    defaultValue={props.selectedProvider?.provider === "PAYTR" ? props.selectedProvider.mode : "TEST"}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    data-testid="provider-paytr-mode"
                  >
                    <option value="TEST">TEST</option>
                    <option value="LIVE">LIVE</option>
                  </select>
                </label>
                <div className="hidden sm:block" aria-hidden="true" />
                <label className="block text-sm font-semibold text-slate-700">
                  Merchant ID
                  <input name="merchantId" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" autoComplete="off" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Merchant Key
                  <input name="merchantKey" type="password" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" autoComplete="new-password" />
                </label>
                <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                  Merchant Salt
                  <input name="merchantSalt" type="password" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" autoComplete="new-password" />
                </label>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400" aria-disabled="true">
                iyzico · yakında
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400" aria-disabled="true">
                Param · yakında
              </div>
            </div>
            <button
              type="submit"
              disabled={providerPending || (provider === "MANUAL" && !manualAcknowledged)}
              className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              data-testid="provider-submit"
            >
              {providerPending ? "Kaydediliyor…" : "Yöntemi kaydet ve devam et"}
            </button>
            <ErrorBox state={providerState} />
          </form>
        </section>
      ) : null}

      {step === "VALIDATION" ? (
        <section
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
          data-testid="wizard-validation"
        >
          <h2 className="text-lg font-black text-slate-950">7. Son kontroller</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Kurulum, lisans, QR zinciri ve ödeme yöntemi sunucuda yeniden doğrulanır.
          </p>
          {props.blockedReasonCode === "ADMIN_BLOCKED" ? (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-900" role="alert">
              Aktivasyon yönetici tarafından durduruldu. Kontroller yeniden çalıştırılamaz.
            </p>
          ) : null}
          {props.latestValidationSummary ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-4" data-testid="validation-summary">
              <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold">Sonuç: {props.latestValidationSummary.result}</div>
              <div className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Geçti: {props.latestValidationSummary.passCount}</div>
              <div className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Uyarı: {props.latestValidationSummary.warningCount}</div>
              <div className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">Başarısız: {props.latestValidationSummary.failCount}</div>
            </div>
          ) : null}
          {validationState.validationReport ?? goLiveState.validationReport ? (
            <ul className="mt-4 grid gap-3 lg:grid-cols-2" data-testid="validation-checks">
              {(validationState.validationReport ?? goLiveState.validationReport)!.checks.map((check) => (
                <ValidationCard key={check.key} check={check} />
              ))}
            </ul>
          ) : null}
          <form action={validationAction} className="mt-4">
            <input type="hidden" name="organizationId" value={props.organizationId} />
            <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
            <button
              type="submit"
              disabled={validationPending || props.blockedReasonCode === "ADMIN_BLOCKED"}
              className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              data-testid="validation-run"
            >
              {validationPending
                ? "Kontroller çalışıyor…"
                : props.latestValidationSummary
                  ? "Kontrolleri yeniden çalıştır"
                  : "Kontrolleri çalıştır"}
            </button>
            <SuccessBox state={validationState} />
            <ErrorBox state={validationState} />
          </form>
        </section>
      ) : null}

      {step === "GO_LIVE" ? (
        <section
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
          data-testid="wizard-go-live"
        >
          <h2 className="text-lg font-black text-slate-950">8. Yayına alma</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {props.journeyStatus === "READY" ? "Hazır durumdasınız. " : ""}
            Public QR erişimi hâlâ kapalıdır; yalnızca “Yayına al” işlemi sonrası açılır.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-500">Organizasyon</p>
              <p className="mt-1 text-sm font-black text-slate-950">{props.organization.name}</p>
              <p className="text-xs text-slate-500">{props.organization.slug}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-500">Seçili yöntem</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {props.selectedProvider?.provider === "PAYTR"
                  ? `PayTR · ${props.selectedProvider.mode}`
                  : props.selectedProvider?.provider === "MANUAL"
                    ? "Manuel tahsilat"
                    : "Seçilmedi"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-500">Online QR kart ödemesi</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {props.selectedProvider?.provider === "PAYTR" &&
                props.paytrApiEnabled &&
                (!props.isProductionEnvironment ||
                  props.selectedProvider.mode === "LIVE")
                  ? "Açık"
                  : props.selectedProvider?.provider === "PAYTR" &&
                      props.selectedProvider.mode === "TEST" &&
                      props.isProductionEnvironment
                    ? "Kapalı · üretimde LIVE gerekli"
                    : "Kapalı"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-500">Son kontroller</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {props.latestValidationSummary?.result ?? "Bilinmiyor"}
              </p>
            </div>
          </div>

          {props.actorRole === "OWNER" || props.actorRole === "ADMIN" ? (
            <form action={goLiveAction} className="mt-5 space-y-4">
              <input type="hidden" name="organizationId" value={props.organizationId} />
              <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
              <input type="hidden" name="confirmed" value={goLiveConfirmed ? "1" : "0"} />
              <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                <input
                  type="checkbox"
                  checked={goLiveConfirmed}
                  onChange={(event) => setGoLiveConfirmed(event.target.checked)}
                  className="mt-1"
                  data-testid="go-live-confirm"
                />
                Kurulum özetini kontrol ettim ve public QR erişimini açmak istiyorum.
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Organizasyon adı veya slug değerini tam olarak yazın
                <input
                  name="confirmationText"
                  required
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  autoComplete="off"
                  data-testid="go-live-confirmation-text"
                />
              </label>
              <button
                type="submit"
                disabled={goLivePending || !goLiveConfirmed || !confirmationText}
                className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                data-testid="go-live-submit"
              >
                {goLivePending ? "Yayına alınıyor…" : "Yayına al"}
              </button>
              <SuccessBox state={goLiveState} />
              <ErrorBox state={goLiveState} />
            </form>
          ) : props.actorRole === "MANAGER" ? (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950" data-testid="go-live-manager-denied">
              Müdür rolü son kontrolleri görüntüleyebilir; yayına alma işlemini yalnızca organizasyon sahibi veya yöneticisi tamamlayabilir.
            </p>
          ) : (
            <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              Yayına alma için sahip veya yönetici yetkisiyle müşteri hesabında oturum açın.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
