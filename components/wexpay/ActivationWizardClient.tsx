"use client";

import { useActionState } from "react";
import { MembershipRole } from ".prisma/client";
import {
  acknowledgeQrPackAction,
  completeStaffInviteStepAction,
  createStaffInviteAction,
  createTablesWizardAction,
  revokeStaffInviteAction,
  saveBranchSetupAction,
  saveBusinessProfileAction,
  type WizardActionState,
} from "@/lib/wexpay-activation-wizard-actions";

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

export function ActivationWizardClient(props: Props) {
  const [profileState, profileAction, profilePending] = useActionState(saveBusinessProfileAction, initial);
  const [branchState, branchAction, branchPending] = useActionState(saveBranchSetupAction, initial);
  const [tableState, tableAction, tablePending] = useActionState(createTablesWizardAction, initial);
  const [ackState, ackAction, ackPending] = useActionState(acknowledgeQrPackAction, initial);
  const [inviteState, inviteAction, invitePending] = useActionState(createStaffInviteAction, initial);
  const [revokeState, revokeAction] = useActionState(revokeStaffInviteAction, initial);
  const [staffDoneState, staffDoneAction, staffDonePending] = useActionState(
    completeStaffInviteStepAction,
    initial,
  );

  const issuedQrs = tableState.ok && tableState.issuedQrs?.length ? tableState.issuedQrs : null;
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
    "https://www.wexon.dev";

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

      {step === "BUSINESS_PROFILE" || props.stepStatuses.BUSINESS_PROFILE === "PENDING" ? (
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

      {(step === "BRANCH_SETUP" || props.stepStatuses.BUSINESS_PROFILE === "COMPLETED") &&
      props.stepStatuses.BRANCH_SETUP !== "COMPLETED" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">2. Şube kurulumu</h2>
          <form action={branchAction} className="mt-4 grid gap-3">
            <input type="hidden" name="organizationId" value={props.organizationId} />
            <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
            <input type="hidden" name="existingRestaurantId" value={props.restaurantId ?? ""} />
            <input type="hidden" name="existingBranchId" value={props.branchId ?? ""} />
            <label className="block text-sm font-semibold text-slate-700">
              Restoran adı *
              <input
                name="restaurantName"
                required
                defaultValue={props.restaurants[0]?.name ?? props.organization.name}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Şube adı *
              <input
                name="branchName"
                required
                defaultValue={props.branches[0]?.name ?? "Merkez"}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Şube adresi *
              <input
                name="branchAddress"
                required
                defaultValue={props.branches[0]?.address ?? ""}
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

      {(step === "TABLE_SETUP" || props.stepStatuses.BRANCH_SETUP === "COMPLETED") &&
      props.stepStatuses.TABLE_SETUP !== "COMPLETED" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">3. Masa ve güvenli QR</h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            QR bağlantıları yalnız <code className="rounded bg-slate-100 px-1">/q/…</code> opaque token kullanır.
            Bu güvenli bağlantılar yalnız bir kez gösterilir; kaybedilirse QR yenilenir.
          </p>
          {!issuedQrs ? (
            <form action={tableAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="organizationId" value={props.organizationId} />
              <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
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
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                Bu güvenli bağlantılar yalnız bir kez gösterilir. Kaydedin veya yazdırın; yenilemeden sonra ham token geri getirilmez.
              </div>
              <ul className="space-y-2">
                {issuedQrs.map((qr) => (
                  <li key={qr.tableId} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <p className="font-bold text-slate-900">{qr.label}</p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600">
                      {originHint}
                      {qr.publicPath}
                    </p>
                  </li>
                ))}
              </ul>
              <form action={ackAction}>
                <input type="hidden" name="organizationId" value={props.organizationId} />
                <input type="hidden" name="expectedVersion" value={String(props.journeyVersion)} />
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

      {(step === "STAFF_INVITE" || props.stepStatuses.TABLE_SETUP === "COMPLETED") &&
      props.stepStatuses.STAFF_INVITE !== "COMPLETED" &&
      props.stepStatuses.STAFF_INVITE !== "SKIPPED" ? (
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
