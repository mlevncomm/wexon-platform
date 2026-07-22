import Link from "next/link";
import { dashboardPreviewHref, wexpayHref } from "@/lib/wexon-organization-context";
import { AdminEmptyState, AdminInfoRow, AdminPanel, AdminSectionTitle } from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminDateField,
  AdminFormPanel,
  AdminSelectField,
  AdminSubmitButton,
  AdminTextField,
} from "@/components/marketing/WexonAdminForms";
import {
  addAdminMembershipAction,
  adminAssistedWexPayGoLiveAction,
  blockAdminWexPayActivationAction,
  changeAdminLicensePlanAction,
  changeAdminLicenseStatusAction,
  createAdminLicenseAction,
  createAdminRestaurantAction,
  deactivateAdminOrganizationAction,
  enableWexPayAccessAction,
  permanentlyDeleteAdminOrganizationAction,
  reactivateAdminOrganizationAction,
  updateAdminAppInstallationSettingsAction,
  updateAdminLicenseDetailsAction,
  updateAdminMembershipRoleAction,
  updateAdminMembershipStatusAction,
  updateAdminOrganizationAction,
  updateWexPayAccessStatusAction,
  unblockAdminWexPayActivationAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminDate, formatAdminStatus, getAdminOrganizationDetail, getAdminOrganizationMutationOptions } from "@/lib/wexon-admin";
import { coreAccessDenialMessage, evaluateProductAccess } from "@/lib/wexon-core-access";
import {
  ACTIVATION_STEP_LABELS,
  ACTIVATION_STEP_ORDER,
  getActivationJourneyViewForOrg,
} from "@/lib/wexpay-activation-journey";
import {
  getWexPayPublicPaymentAvailabilitySummary,
  type WexPayPublicPaymentAvailabilitySummary,
} from "@/lib/wexpay-public-payment-availability";

function dateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function currentOnlinePaymentLabel(
  availability: WexPayPublicPaymentAvailabilitySummary,
) {
  if (availability.onlineCheckoutEnabled) {
    const source =
      availability.selectionSource === "LEGACY_BACKFILL"
        ? " · legacy"
        : "";
    return `Açık · PayTR ${availability.mode}${source}`;
  }
  const reasons: Record<string, string> = {
    JOURNEY_NOT_ACTIVE: "yolculuk aktif değil",
    PAYMENT_STEP_INCOMPLETE: "ödeme adımı eksik",
    MANUAL_SELECTED: "manuel seçildi",
    SELECTION_INVALID: "seçim geçersiz",
    CREDENTIAL_INVALID: "bağlantı bilgisi hazır değil",
    PAYTR_TEST_MODE_PRODUCTION: "üretimde LIVE bağlantı gerekli",
    PAYTR_API_DISABLED: "PayTR API kapalı",
  };
  return `Kapalı · ${reasons[availability.reason] ?? "kullanılamıyor"}`;
}

export default async function AdminOrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ adminError?: string }>;
}) {
  const { id } = await params;
  const { adminError } = await searchParams;
  const [
    organization,
    options,
    wexPayCoreAccess,
    activationView,
    currentPaymentAvailability,
  ] = await Promise.all([
    getAdminOrganizationDetail(id),
    getAdminOrganizationMutationOptions(),
    evaluateProductAccess({ organizationId: id, productKey: "wexpay" }),
    getActivationJourneyViewForOrg(id),
    getWexPayPublicPaymentAvailabilitySummary(id),
  ]);

  if (!organization) {
    return <AdminEmptyState>Organizasyon bulunamadı.</AdminEmptyState>;
  }

  const primaryLicense = organization.licenses[0];
  const wexPayLicense = organization.licenses.find((license) => license.product.key === "wexpay");
  const wexPayInstallation = organization.appInstallations.find((installation) => installation.product.key === "wexpay");
  const updateOrganization = updateAdminOrganizationAction.bind(null, organization.id);
  const enableWexPayAccess = enableWexPayAccessAction.bind(null, organization.id);
  const activateWexPayAccess = updateWexPayAccessStatusAction.bind(null, organization.id, "ACTIVE");
  const disableWexPayAccess = updateWexPayAccessStatusAction.bind(null, organization.id, "DISABLED");
  const createLicense = createAdminLicenseAction.bind(null, organization.id);
  const createRestaurant = createAdminRestaurantAction.bind(null, organization.id);
  const addMembership = addAdminMembershipAction.bind(null, organization.id);
  const deactivateOrganization = deactivateAdminOrganizationAction.bind(null, organization.id);
  const reactivateOrganization = reactivateAdminOrganizationAction.bind(null, organization.id);
  const permanentlyDeleteOrganization = permanentlyDeleteAdminOrganizationAction.bind(null, organization.id);
  const blockActivation = blockAdminWexPayActivationAction.bind(null, organization.id);
  const unblockActivation = unblockAdminWexPayActivationAction.bind(null, organization.id);
  const adminGoLive = adminAssistedWexPayGoLiveAction.bind(null, organization.id);
  const activeProduct = wexPayInstallation?.status === "ACTIVE" ? "WexPay" : "-";
  const activePlan = wexPayLicense ? displayPlanName(wexPayLicense.plan.name) : "-";
  const licenseStatus = wexPayLicense ? formatAdminStatus(wexPayLicense.status) : "-";
  const coreAccessLabel = wexPayCoreAccess.allowed ? "Aktif" : "Kapalı";
  const coreAccessReason =
    !wexPayCoreAccess.allowed && wexPayCoreAccess.reason
      ? coreAccessDenialMessage(wexPayCoreAccess.reason)
      : "-";
  const onboarding = wexPayInstallation?.settingsJson as { onboardingStatus?: string; message?: string; estimatedBusinessDays?: number; source?: string } | null;
  const quickLinks = ["Bilgileri düzenle", "WexPay erişimi", "Lisans/Paket", "İşletme ekle", "Kullanıcı ekle"];
  const activationJourney = activationView.journey;
  const providerStep = activationJourney?.steps.find((step) => step.stepKey === "PAYMENT_PROVIDER");
  const providerMetadata =
    providerStep?.safeMetadataJson &&
    typeof providerStep.safeMetadataJson === "object" &&
    !Array.isArray(providerStep.safeMetadataJson)
      ? (providerStep.safeMetadataJson as Record<string, unknown>)
      : {};
  const providerLabel =
    providerMetadata.provider === "MANUAL"
      ? "Manuel tahsilat"
      : providerMetadata.provider === "PAYTR"
        ? `PayTR · ${providerMetadata.mode === "LIVE" ? "LIVE" : "TEST"}`
        : "Seçilmedi";
  const onlinePaymentLabel = currentOnlinePaymentLabel(
    currentPaymentAvailability,
  );
  const validationStep = activationJourney?.steps.find((step) => step.stepKey === "VALIDATION");
  const validationMetadata =
    validationStep?.safeMetadataJson &&
    typeof validationStep.safeMetadataJson === "object" &&
    !Array.isArray(validationStep.safeMetadataJson)
      ? (validationStep.safeMetadataJson as Record<string, unknown>)
      : {};
  const validationSummary =
    validationMetadata.result === "PASS" ||
    validationMetadata.result === "WARNING" ||
    validationMetadata.result === "FAIL"
      ? `${validationMetadata.result} · ${Number(validationMetadata.passCount ?? 0)} geçti · ${Number(validationMetadata.warningCount ?? 0)} uyarı · ${Number(validationMetadata.failCount ?? 0)} başarısız`
      : "Henüz çalıştırılmadı";

  return (
    <div className="space-y-8">
      {adminError && <AdminActionNotice tone="error">{adminError}</AdminActionNotice>}

      <section className="relative overflow-hidden rounded-[32px] border border-slate-900 bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#07111f_0%,#0b1727_100%)] p-6 text-white shadow-2xl shadow-slate-950/20 sm:p-8">
        <div className="relative min-w-0">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <span className="mb-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
                Müşteri yönetimi
              </span>
              <h1 className="break-words text-3xl font-black tracking-[-0.02em] text-white sm:text-5xl">{organization.name}</h1>
              <p className="mt-3 text-sm font-semibold text-slate-300">{organization.email ?? organization.slug}</p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:w-[520px] xl:w-[640px]">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Durum</p>
                <p className="mt-2 text-sm font-black text-white">{organization.isActive ? "Aktif" : "Pasif"}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Paket</p>
                <p className="mt-2 text-sm font-black text-white">{activePlan}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Lisans</p>
                <p className="mt-2 text-sm font-black text-white">{licenseStatus}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:w-[520px] lg:col-start-2 lg:row-start-2 xl:w-[640px]">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Core erişim</p>
                <p className="mt-2 text-sm font-black text-white">{coreAccessLabel}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Erişim notu</p>
                <p className="mt-2 text-sm font-semibold text-slate-200">{coreAccessReason}</p>
              </div>
              {wexPayCoreAccess.billingState && wexPayCoreAccess.billingState !== "ok" && (
                <div className="rounded-2xl bg-white/10 p-4 sm:col-span-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Fatura durumu</p>
                  <p className="mt-2 text-sm font-semibold text-slate-200">{wexPayCoreAccess.billingState}</p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <span key={link} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                {link}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={dashboardPreviewHref(organization.id)}
              className="inline-flex rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-400"
            >
              Wexon Core paneli
            </Link>
            <Link
              href={wexpayHref("/apps/wexpay", organization.id)}
              className="inline-flex rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
            >
              WexPay operasyonları
            </Link>
          </div>
        </div>
      </section>

      <AdminPanel>
        <AdminSectionTitle badge="Genel durum" title="Müşteri özeti" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AdminInfoRow label="WexPay durumu" value={wexPayInstallation ? formatAdminStatus(wexPayInstallation.status) : "Kurulu değil"} />
          <AdminInfoRow label="Aktif ürün" value={activeProduct} />
          <AdminInfoRow label="Paket" value={activePlan} />
          <AdminInfoRow label="İşletme" value={organization.restaurants.length} />
          <AdminInfoRow label="Kullanıcı" value={organization.memberships.length} />
        </div>
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle
          badge="Akıllı Aktivasyon"
          title="Aktivasyon yolculuğu"
          description="Kurulum Modu panel erişimini kapatmaz; public QR yalnız Yayına alma sonrası açılır."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <AdminInfoRow label="Durum" value={activationView.statusLabel} />
          <AdminInfoRow label="Kaynak" value={activationView.sourceLabel ?? "—"} />
          <AdminInfoRow label="Güncel adım" value={activationView.currentStepLabel ?? "—"} />
          <AdminInfoRow label="Sürüm" value={activationJourney?.version ?? "—"} />
          <AdminInfoRow
            label="Tamamlanma"
            value={activationJourney?.completedAt ? formatAdminDate(activationJourney.completedAt) : "—"}
          />
          <AdminInfoRow label="Bloke nedeni" value={activationJourney?.blockedReasonCode ?? "—"} />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIVATION_STEP_ORDER.map((stepKey) => {
            const step = activationJourney?.steps.find((row) => row.stepKey === stepKey);
            return (
              <AdminInfoRow
                key={stepKey}
                label={ACTIVATION_STEP_LABELS[stepKey]}
                value={formatAdminStatus(step?.status ?? "PENDING")}
              />
            );
          })}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminInfoRow label="Ödeme yöntemi" value={providerLabel} />
          <AdminInfoRow label="Online QR kart ödemesi" value={onlinePaymentLabel} />
          <AdminInfoRow
            label="Anahtar parmak izi"
            value={
              providerMetadata.provider === "PAYTR" &&
              typeof providerMetadata.keyFingerprint === "string"
                ? providerMetadata.keyFingerprint
                : "—"
            }
          />
          <AdminInfoRow label="Son doğrulama" value={validationSummary} />
        </div>

        {activationJourney ? (
          <div className="mt-6 grid gap-5 border-t border-slate-200 pt-5 xl:grid-cols-3">
            {activationJourney.status === "IN_PROGRESS" || activationJourney.status === "READY" ? (
              <form action={blockActivation} className="grid gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
                <input type="hidden" name="expectedVersion" value={String(activationJourney.version)} />
                <h3 className="text-sm font-black text-rose-950">Aktivasyonu engelle</h3>
                <AdminTextField label="Neden kodu" name="reason" placeholder="Örn. COMPLIANCE_HOLD" required />
                <label className="block min-w-0">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-rose-700">Not</span>
                  <textarea
                    name="note"
                    required
                    minLength={8}
                    className="mt-2 min-h-24 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950"
                  />
                </label>
                <AdminSubmitButton>Engelle</AdminSubmitButton>
              </form>
            ) : null}

            {activationJourney.status === "BLOCKED" &&
            activationJourney.blockedReasonCode === "ADMIN_BLOCKED" ? (
              <form action={unblockActivation} className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
                <input type="hidden" name="expectedVersion" value={String(activationJourney.version)} />
                <h3 className="text-sm font-black text-amber-950">Aktivasyon engelini kaldır</h3>
                <AdminTextField label="Neden" name="reason" placeholder="Örn. REVIEW_COMPLETE" required />
                <AdminSubmitButton>Engeli kaldır</AdminSubmitButton>
              </form>
            ) : null}

            {activationJourney.status === "READY" ? (
              <form action={adminGoLive} className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
                <input type="hidden" name="expectedVersion" value={String(activationJourney.version)} />
                <input type="hidden" name="confirmed" value="1" />
                <h3 className="text-sm font-black text-emerald-950">Admin destekli yayına alma</h3>
                <p className="text-xs font-semibold text-emerald-900">
                  Onay için slug değerini tam yazın: {organization.slug}
                </p>
                <AdminTextField label="Slug onayı" name="confirmationText" required />
                <AdminTextField label="Neden kodu" name="reason" placeholder="Örn. ASSISTED_LAUNCH" required />
                <label className="block min-w-0">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Not</span>
                  <textarea
                    name="note"
                    required
                    minLength={8}
                    className="mt-2 min-h-24 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950"
                  />
                </label>
                <AdminSubmitButton>Admin olarak yayına al</AdminSubmitButton>
              </form>
            ) : null}
          </div>
        ) : (
          <AdminActionNotice>Bu organizasyon için aktivasyon yolculuğu henüz başlamadı.</AdminActionNotice>
        )}
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle badge="Kurulum" title="WexPay onboarding özeti" description="Checkout veya admin aktivasyonu sonrası oluşan kurulum bilgileri." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminInfoRow label="Kurulum durumu" value={onboarding?.onboardingStatus ?? "Tanımlanmadı"} />
          <AdminInfoRow label="Tahmini süre" value={onboarding?.estimatedBusinessDays ? `${onboarding.estimatedBusinessDays} iş günü` : "-"} />
          <AdminInfoRow label="Kaynak" value={onboarding?.source ?? "-"} />
          <AdminInfoRow label="Mesaj" value={onboarding?.message ?? "-"} />
        </div>
      </AdminPanel>

      <AdminSectionTitle badge="Hızlı yönetim" title="Günlük işlemler" description="Formlar kapalı başlar. İhtiyacınız olan işlemi açıp tamamlayın." />

      <AdminFormPanel title="Müşteri bilgilerini düzenle" description="Ad, iletişim ve aktif/pasif durumunu güncelleyin." collapsible>
        <form action={updateOrganization} className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
          <AdminTextField label="Organizasyon adı" name="name" defaultValue={organization.name} required />
          <AdminTextField label="Slug" name="slug" defaultValue={organization.slug} required />
          <AdminTextField label="Ticari ünvan" name="legalName" defaultValue={organization.legalName} />
          <AdminTextField label="Vergi no" name="taxNo" defaultValue={organization.taxNo} />
          <AdminTextField label="E-posta" name="email" type="email" defaultValue={organization.email} />
          <AdminTextField label="Telefon" name="phone" defaultValue={organization.phone} />
          <AdminTextField label="Ülke" name="country" defaultValue={organization.country} />
          <AdminSelectField label="Demo müşteri" name="isDemo" defaultValue={organization.isDemo ? "true" : "false"}>
            <option value="false">Hayır</option>
            <option value="true">Evet</option>
          </AdminSelectField>
          <AdminSelectField label="Durum" name="isActive" defaultValue={organization.isActive ? "true" : "false"}>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </AdminSelectField>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Organizasyonu güncelle</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      <section className="grid gap-5 xl:grid-cols-2">
        <AdminFormPanel title="WexPay erişimi" description="Müşteri için WexPay erişimini açın veya geçici olarak pasif yapın." collapsible>
          <div className="space-y-3">
            <AdminInfoRow label="Mevcut durum" value={wexPayInstallation ? formatAdminStatus(wexPayInstallation.status) : "Kurulu değil"} />
            <form action={enableWexPayAccess}>
              <AdminSubmitButton>WexPay erişimini aç</AdminSubmitButton>
            </form>
            <div className="grid gap-3 sm:grid-cols-2">
              <form action={activateWexPayAccess}>
                <AdminSubmitButton>Aktif yap</AdminSubmitButton>
              </form>
              <form action={disableWexPayAccess}>
                <AdminSubmitButton>Pasif yap</AdminSubmitButton>
              </form>
            </div>
          </div>
          <AdminActionNotice>WexHotel ve WexB2B write yönetimi bu fazda kapalıdır.</AdminActionNotice>
        </AdminFormPanel>

        <AdminFormPanel title="Lisans ve paket" description="WexPay lisansı oluşturun, paketini veya durumunu güncelleyin." collapsible>
          <div className="space-y-6">
            <form action={createLicense} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
              <input type="hidden" name="productKey" value="wexpay" />
              <AdminSelectField label="Paket" name="planId" defaultValue={options.wexPayPlans[0]?.id}>
                {options.wexPayPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {displayPlanName(plan.name)}
                  </option>
                ))}
              </AdminSelectField>
              <AdminSelectField label="Lisans tipi" name="licenseType" defaultValue="MONTHLY">
                <option value="MONTHLY">Aylık</option>
                <option value="YEARLY">Yıllık</option>
                <option value="ONE_TIME">Tek seferlik</option>
              </AdminSelectField>
              <AdminDateField label="Başlangıç tarihi" name="startsAt" defaultValue={dateInput(new Date())} required />
              <AdminDateField label="Bitiş / yenileme tarihi" name="endsAt" />
              <AdminSelectField label="Durum" name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Aktif</option>
                <option value="SUSPENDED">Askıda</option>
                <option value="CANCELLED">İptal</option>
                <option value="EXPIRED">Süresi dolmuş</option>
              </AdminSelectField>
              <div className="md:col-span-2">
                <AdminSubmitButton>Yeni lisans oluştur</AdminSubmitButton>
              </div>
            </form>

            {wexPayLicense ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <form action={changeAdminLicensePlanAction.bind(null, organization.id, wexPayLicense.id)} className="grid gap-4">
                    <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
                    <AdminSelectField label="Yeni paket" name="planId" defaultValue={wexPayLicense.planId}>
                      {options.wexPayPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {displayPlanName(plan.name)}
                        </option>
                      ))}
                    </AdminSelectField>
                    <AdminSubmitButton>Paketi güncelle</AdminSubmitButton>
                  </form>
                  <form action={changeAdminLicenseStatusAction.bind(null, organization.id, wexPayLicense.id)} className="grid gap-4">
                    <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
                    <AdminSelectField label="Durum" name="status" defaultValue={wexPayLicense.status}>
                      <option value="TRIAL">Deneme</option>
                      <option value="ACTIVE">Aktif</option>
                      <option value="PAST_DUE">Gecikmiş</option>
                      <option value="SUSPENDED">Askıda</option>
                      <option value="CANCELLED">İptal</option>
                      <option value="EXPIRED">Süresi dolmuş</option>
                    </AdminSelectField>
                    <AdminSubmitButton>Durumu güncelle</AdminSubmitButton>
                  </form>
                </div>
                <form action={updateAdminLicenseDetailsAction.bind(null, organization.id, wexPayLicense.id)} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                  <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
                  <AdminSelectField label="Lisans tipi" name="licenseType" defaultValue={wexPayLicense.licenseType}>
                    <option value="MONTHLY">Aylık</option>
                    <option value="YEARLY">Yıllık</option>
                    <option value="ONE_TIME">Tek seferlik</option>
                  </AdminSelectField>
                  <AdminSelectField label="Durum" name="status" defaultValue={wexPayLicense.status}>
                    <option value="TRIAL">Deneme</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="PAST_DUE">Gecikmiş</option>
                    <option value="SUSPENDED">Askıda</option>
                    <option value="CANCELLED">İptal</option>
                    <option value="EXPIRED">Süresi dolmuş</option>
                  </AdminSelectField>
                  <AdminDateField label="Başlangıç" name="startsAt" defaultValue={dateInput(wexPayLicense.startsAt)} required />
                  <AdminDateField label="Bitiş" name="endsAt" defaultValue={dateInput(wexPayLicense.endsAt)} />
                  <div className="md:col-span-2">
                    <AdminSubmitButton>Lisans detaylarını kaydet</AdminSubmitButton>
                  </div>
                </form>
              </div>
            ) : (
              <AdminActionNotice tone="warning">Paket veya durum değiştirmek için önce WexPay lisansı oluşturun.</AdminActionNotice>
            )}
          </div>
        </AdminFormPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AdminFormPanel title="İşletme ekle" description="Müşteriye bağlı işletme kaydı oluşturur." collapsible>
          <form action={createRestaurant} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
            <AdminTextField label="İşletme adı" name="name" required />
            <AdminTextField label="Slug" name="slug" required />
            <AdminSelectField label="Durum" name="isActive" defaultValue="true">
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </AdminSelectField>
            <div className="md:col-span-2">
              <AdminSubmitButton>İşletme ekle</AdminSubmitButton>
            </div>
          </form>
        </AdminFormPanel>

        <AdminFormPanel title="Kullanıcı ekle" description="Bu geçici şifre müşterinin Wexon Core müşteri paneline giriş yapması için kullanılır." collapsible>
          <form action={addMembership} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
            <AdminTextField label="Ad" name="name" />
            <AdminTextField label="E-posta" name="email" type="email" required />
            <AdminTextField label="Geçici şifre" name="temporaryPassword" type="password" />
            <AdminSelectField label="Rol" name="role" defaultValue="STAFF">
              <option value="OWNER">Sahip</option>
              <option value="ADMIN">Yönetici</option>
              <option value="MANAGER">Müdür</option>
              <option value="STAFF">Personel</option>
              <option value="BILLING">Faturalama</option>
              <option value="VIEWER">Görüntüleyici</option>
            </AdminSelectField>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <input name="mustChangePassword" value="true" type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="block text-sm font-black text-slate-950">İlk girişte şifre değiştirmeye zorla</span>
                <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-500">
                  Şifre değiştirme ekranı sonraki fazda eklenecektir; bu işaret şimdilik kullanıcı kaydında saklanır.
                </span>
              </span>
            </label>
            <div className="md:col-span-2">
              <AdminSubmitButton>Kullanıcı ekle</AdminSubmitButton>
            </div>
          </form>
        </AdminFormPanel>
      </section>

      {wexPayInstallation ? (
        <AdminFormPanel title="Onboarding ayarları" description="WexPay kurulum mesajı ve tahmini süreyi düzenleyin." collapsible>
          <form action={updateAdminAppInstallationSettingsAction.bind(null, organization.id, wexPayInstallation.id)} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
            <AdminSelectField label="Kurulum durumu" name="onboardingStatus" defaultValue={onboarding?.onboardingStatus ?? "PENDING_SETUP"}>
              <option value="PENDING_SETUP">Kurulum bekliyor</option>
              <option value="IN_PROGRESS">Devam ediyor</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="ON_HOLD">Beklemede</option>
            </AdminSelectField>
            <AdminTextField label="Tahmini iş günü" name="estimatedBusinessDays" defaultValue={onboarding?.estimatedBusinessDays ? String(onboarding.estimatedBusinessDays) : "5"} />
            <div className="md:col-span-2">
              <AdminTextField label="Müşteri mesajı" name="message" defaultValue={onboarding?.message ?? ""} />
            </div>
            <div className="md:col-span-2">
              <AdminSubmitButton>Onboarding güncelle</AdminSubmitButton>
            </div>
          </form>
        </AdminFormPanel>
      ) : null}

      <AdminFormPanel title="Üyelik yönetimi" description="Mevcut kullanıcıların rol ve durumunu güncelleyin." collapsible>
        {organization.memberships.length === 0 ? (
          <AdminEmptyState>Üyelik bulunmuyor.</AdminEmptyState>
        ) : (
          <div className="space-y-4">
            {organization.memberships.map((membership) => (
              <div key={membership.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-slate-950">{membership.user.email}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {membership.user.name ?? "—"} · {formatAdminStatus(membership.role)} · {formatAdminStatus(membership.status)}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <form action={updateAdminMembershipRoleAction.bind(null, organization.id, membership.id)} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
                    <div className="min-w-[140px] flex-1">
                      <AdminSelectField label="Rol" name="role" defaultValue={membership.role}>
                        <option value="OWNER">Sahip</option>
                        <option value="ADMIN">Yönetici</option>
                        <option value="MANAGER">Müdür</option>
                        <option value="STAFF">Personel</option>
                        <option value="BILLING">Faturalama</option>
                        <option value="VIEWER">Görüntüleyici</option>
                      </AdminSelectField>
                    </div>
                    <AdminSubmitButton>Rol kaydet</AdminSubmitButton>
                  </form>
                  <form action={updateAdminMembershipStatusAction.bind(null, organization.id, membership.id)} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="returnTo" value={`/admin/organizations/${organization.id}`} />
                    <div className="min-w-[140px] flex-1">
                      <AdminSelectField label="Durum" name="status" defaultValue={membership.status}>
                        <option value="INVITED">Davet edildi</option>
                        <option value="ACTIVE">Aktif</option>
                        <option value="SUSPENDED">Askıda</option>
                        <option value="REMOVED">Kaldırıldı</option>
                      </AdminSelectField>
                    </div>
                    <AdminSubmitButton>Durum kaydet</AdminSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminFormPanel>

      {organization.isActive ? (
        <AdminFormPanel
          title="Müşteriyi pasife al"
          description="Bu işlem müşteriyi veritabanından silmez. Müşteri hesabını pasife alır ve erişimleri durdurur."
          collapsible
        >
          <div className="space-y-4">
            <AdminActionNotice tone="warning">
              Hard delete yapılmaz. Organizasyon pasife alınır, ilişkili kayıtlar korunur.
            </AdminActionNotice>
            <form action={deactivateOrganization}>
              <AdminSubmitButton>Müşteriyi pasife al</AdminSubmitButton>
            </form>
          </div>
        </AdminFormPanel>
      ) : (
        <AdminFormPanel
          title="Müşteriyi tekrar aktif et"
          description="Bu işlem müşteriyi tekrar aktif hale getirir. Mevcut lisans, kullanıcı ve işletme kayıtları korunur."
          collapsible
        >
          <div className="space-y-4">
            <AdminActionNotice>Bu müşteri pasif durumda. Tekrar aktif hale getirebilirsiniz.</AdminActionNotice>
            <form action={reactivateOrganization}>
              <AdminSubmitButton>Müşteriyi tekrar aktif et</AdminSubmitButton>
            </form>
          </div>
        </AdminFormPanel>
      )}

      <AdminFormPanel
        title="Tehlikeli işlemler"
        description="Bu alan kalıcı veri işlemleri içindir. Yanlışlıkla çalıştırmamak için onay slug değeri gerekir."
        collapsible
      >
        <div className="space-y-4">
          <AdminActionNotice tone="error">
            Bu işlem müşteriyi ve ilişkili test kayıtlarını kalıcı olarak siler. Fatura veya ödeme kaydı olan müşteriler kalıcı silinemez.
          </AdminActionNotice>
          <p className="text-sm font-semibold leading-relaxed text-slate-600">
            Kalıcı silmek için müşteri slug değerini yazın: <span className="font-black text-slate-950">{organization.slug}</span>
          </p>
          <form action={permanentlyDeleteOrganization} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <AdminTextField label="Onay slug değeri" name="confirmSlug" placeholder={organization.slug} required />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-black text-white transition hover:bg-rose-700 md:w-auto"
            >
              Müşteriyi kalıcı sil
            </button>
          </form>
        </div>
      </AdminFormPanel>

      <AdminSectionTitle badge="Detaylar" title="Teknik ve kayıt bilgileri" description="Günlük akışın dışında kalan kayıtlar burada tutulur." />

      <details className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
        <summary className="cursor-pointer text-lg font-black text-slate-950">Teknik detayları göster</summary>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <AdminPanel>
            <AdminSectionTitle badge="Kimlik" title="Organizasyon bilgileri" />
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInfoRow label="Slug" value={organization.slug} />
              <AdminInfoRow label="Durum" value={organization.isActive ? "Aktif" : "Pasif"} />
              <AdminInfoRow label="Demo" value={organization.isDemo ? "Evet" : "Hayır"} />
              <AdminInfoRow label="Oluşturulma" value={formatAdminDate(organization.createdAt)} />
            </div>
          </AdminPanel>
          <AdminPanel>
            <AdminSectionTitle badge="Müşteri" title="Müşteri bilgileri" />
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInfoRow label="Ticari ünvan" value={organization.legalName ?? "-"} />
              <AdminInfoRow label="Vergi no" value={organization.taxNo ?? "-"} />
              <AdminInfoRow label="E-posta" value={organization.email ?? "-"} />
              <AdminInfoRow label="Telefon" value={organization.phone ?? "-"} />
            </div>
          </AdminPanel>
        </div>
        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <AdminPanel>
            <AdminSectionTitle badge="Ürün erişimleri" title="Aktif ürün ve lisans" />
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInfoRow label="Ürün" value={primaryLicense?.product.name ?? "-"} />
              <AdminInfoRow label="Plan" value={primaryLicense ? displayPlanName(primaryLicense.plan.name) : "-"} />
              <AdminInfoRow label="Lisans durumu" value={primaryLicense ? formatAdminStatus(primaryLicense.status) : "-"} />
              <AdminInfoRow label="Lisans tipi" value={primaryLicense ? formatAdminStatus(primaryLicense.licenseType) : "-"} />
            </div>
          </AdminPanel>

          <AdminPanel>
            <AdminSectionTitle badge="Paket ve limitler" title="Plan yetkileri" />
            {primaryLicense?.plan.entitlements.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {primaryLicense.plan.entitlements.map((item) => (
                  <AdminInfoRow key={item.id} label={item.key} value={item.valueString ?? item.valueInt ?? (item.valueBool ? "Evet" : "Hayır")} />
                ))}
              </div>
            ) : (
              <AdminEmptyState>Bu organizasyon için paket limiti bulunmuyor.</AdminEmptyState>
            )}
          </AdminPanel>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <AdminPanel>
            <AdminSectionTitle badge="Bağlı işletmeler" title="İşletmeler" />
            {organization.restaurants.length === 0 ? <AdminEmptyState>Bağlı işletme bulunmuyor.</AdminEmptyState> : organization.restaurants.map((restaurant) => <AdminInfoRow key={restaurant.id} label={restaurant.name} value={restaurant.slug} />)}
          </AdminPanel>
          <AdminPanel>
            <AdminSectionTitle badge="Kullanıcılar" title="Üyelikler" />
            {organization.memberships.length === 0 ? <AdminEmptyState>Kullanıcı kaydı bulunmuyor.</AdminEmptyState> : organization.memberships.map((membership) => <AdminInfoRow key={membership.id} label={membership.user.email} value={`${formatAdminStatus(membership.role)} · ${formatAdminStatus(membership.status)}`} />)}
          </AdminPanel>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <AdminPanel>
            <AdminSectionTitle badge="Faturalar" title="Fatura kayıtları" />
            {organization.invoices.length === 0 ? <AdminEmptyState>Henüz fatura kaydı bulunmuyor.</AdminEmptyState> : organization.invoices.map((invoice) => <AdminInfoRow key={invoice.id} label={invoice.invoiceNo} value={formatAdminStatus(invoice.status)} />)}
          </AdminPanel>
          <AdminPanel>
            <AdminSectionTitle badge="Entegrasyonlar" title="API ve Webhook" />
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInfoRow label="API anahtarı" value={organization.apiKeys.length} />
              <AdminInfoRow label="Webhook" value={organization.webhookEndpoints.length} />
            </div>
          </AdminPanel>
        </section>

        <AdminPanel className="mt-6">
          <AdminSectionTitle badge="İşlem geçmişi" title="Son kayıtlar" />
          {organization.auditLogs.length === 0 ? <AdminEmptyState>Henüz işlem kaydı bulunmuyor.</AdminEmptyState> : organization.auditLogs.map((log) => <AdminInfoRow key={log.id} label={log.action} value={formatAdminDate(log.createdAt)} />)}
        </AdminPanel>
      </details>
    </div>
  );
}
