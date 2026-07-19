"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { MembershipRole } from ".prisma/client";
import {
  acknowledgeQrPackAction,
  completeStaffInviteStepAction,
  createStaffInviteAction,
  createTablesWizardAction,
  recoverQrPackAction,
  revokeStaffInviteAction,
  rotateTableQrWizardAction,
  saveBranchSetupAction,
  saveBusinessProfileAction,
  type WizardActionState,
} from "@/lib/wexpay-activation-wizard-actions";
import {
  downloadTableQrPng,
  generateTableQrDataUrl,
  buildTableQrPrintHtml,
} from "@/lib/wexpay-table-qr";
import type { WizardIssuedQr } from "@/lib/wexpay-activation-wizard";

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
};

const initial: WizardActionState = { ok: false };

const UPCOMING: StepKey[] = ["MENU_IMPORT", "PAYMENT_PROVIDER", "VALIDATION", "GO_LIVE"];

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
  const originHint =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN?.replace(/\/+$/, "")) ||
    (typeof window !== "undefined" ? window.location.origin : "https://www.wexon.dev");

  const showQrPack = Boolean(issuedQrs?.length) || props.awaitingQrAck;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Akıllı Aktivasyon</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Kurulum sihirbazı</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-600">
          İşletme profili, şube, güvenli QR masaları ve personel davetlerini adım adım tamamlayın.
          Canlı QR/order/payment bağlantıları Canlıya Geçiş sonrası açılır.
        </p>
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
                <option value="ADMIN">Yönetici</option>
                <option value="MANAGER">Müdür</option>
                <option value="STAFF">Personel</option>
                <option value="BILLING">Faturalama</option>
                <option value="VIEWER">Görüntüleyici</option>
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
                    {invite.role} · {invite.deliveryStatus}
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
                  Şimdilik atla
                </button>
              </form>
            ) : null}
            <ErrorBox state={staffDoneState} />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:p-6">
        <h2 className="text-base font-black text-slate-800">Sonraki adımlar</h2>
        <p className="mt-1 text-sm text-slate-600">Bu adımlar sonraki PR’larda etkinleşir; şimdilik atlanamaz.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {UPCOMING.map((key) => (
            <li key={key} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-400">
              {key.replaceAll("_", " ")} · yakında
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
