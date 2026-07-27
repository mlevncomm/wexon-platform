import { AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminActionMenu,
  AdminActionMenuSection,
  AdminFormPanel,
  AdminSelectField,
  AdminSubmitButton,
  AdminTextField,
  ADMIN_FIELD_CONTROL_COMPACT,
} from "@/components/marketing/WexonAdminForms";
import { AdminInlineToggleForm, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import {
  createAdminPlanAction,
  setAdminEntitlementActiveAction,
  updateAdminPlanAction,
  updateAdminPlanActiveAction,
  upsertAdminEntitlementAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, getAdminPlansData, getAdminProductsData } from "@/lib/wexon-admin";

function entitlementValue(plan: Awaited<ReturnType<typeof getAdminPlansData>>[number], key: string) {
  const item = plan.entitlements.find((entry) => entry.key === key);
  return item?.valueString ?? item?.valueInt ?? (item?.valueBool ? "Evet" : "-");
}

function moneyLabel(value: unknown, currency: string) {
  if (value == null) return "-";
  return `${Number(value).toLocaleString("tr-TR")} ${currency}`;
}

export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [plans, products] = await Promise.all([getAdminPlansData(), getAdminProductsData()]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Planlar"
          title="Paket ve limit yönetimi"
          description="Paket oluşturun, fiyat ve limitleri düzenleyin, lisans dağılımını kontrol edin."
        />
        <AdminQuickLinks
          links={[
            { label: "Geçiş önizlemesi", href: "/admin/plans/wexpay-migration" },
            { label: "Lisans ata", href: "/admin/licenses" },
            { label: "Ürün kataloğu", href: "/admin/products" },
            { label: "Abonelikler", href: "/admin/subscriptions" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminSummaryCard label="Toplam paket" value={plans.length} />
        <AdminSummaryCard label="Aktif paket" value={plans.filter((p) => p.isActive).length} />
        <AdminSummaryCard label="Atanmış lisans" value={plans.reduce((sum, p) => sum + p.licenses.length, 0)} />
      </section>

      <AdminFormPanel title="Yeni paket oluştur" description="Ürüne bağlı yeni plan tanımlayın." collapsible>
        <form action={createAdminPlanAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="returnTo" value="/admin/plans" />
          <AdminSelectField
            label="Ürün"
            name="productId"
            options={[
              { value: "", label: "Seçin" },
              ...products.map((product) => ({ value: product.id, label: product.name })),
            ]}
          />
          <AdminTextField label="Key" name="key" placeholder="wexpay_pro" required />
          <AdminTextField label="Paket adı" name="name" required />
          <AdminSelectField
            label="Faturalama"
            name="billingInterval"
            defaultValue="MONTHLY"
            options={[
              { value: "MONTHLY", label: "Aylık" },
              { value: "YEARLY", label: "Yıllık" },
              { value: "ONE_TIME", label: "Tek seferlik" },
            ]}
          />
          <AdminTextField label="Sıra" name="sortOrder" type="number" defaultValue="0" />
          <AdminTextField label="Aylık fiyat (TRY)" name="priceMonthly" type="number" placeholder="7500" />
          <AdminTextField label="Yıllık fiyat (TRY)" name="priceYearly" type="number" placeholder="75000" />
          <AdminTextField label="Kurulum ücreti (TRY)" name="setupFee" type="number" placeholder="12000" />
          <AdminTextField label="İşlem ücreti başlangıç %" name="processingFeePct" type="number" placeholder="2.89" />
          <AdminTextField label="Aylık minimum işlem taahhüdü (TRY)" name="minimumTransactionCommitment" type="number" placeholder="10000" />
          <AdminTextField label="Tier key" name="tierKey" placeholder="essential" />
          <AdminTextField label="Settlement metni" name="settlementDisplay" placeholder="Standart · onay bağlı" />
          <AdminSelectField
            label="Manuel inceleme"
            name="requiresManualReview"
            defaultValue="false"
            options={[
              { value: "false", label: "Hayır" },
              { value: "true", label: "Evet" },
            ]}
          />
          <AdminTextField label="Tek seferlik fiyat (TRY)" name="priceOneTime" type="number" />
          <AdminTextField label="Para birimi" name="currency" defaultValue="TRY" />
          <AdminTextField label="KDV (%)" name="taxRatePct" type="number" defaultValue="20" />
          <AdminSelectField
            label="Herkese açık"
            name="isPublic"
            defaultValue="true"
            options={[
              { value: "true", label: "Evet" },
              { value: "false", label: "Hayır" },
            ]}
          />
          <AdminSelectField
            label="Aktif"
            name="isActive"
            defaultValue="true"
            options={[
              { value: "true", label: "Evet" },
              { value: "false", label: "Hayır" },
            ]}
          />
          <div className="md:col-span-2 xl:col-span-3">
            <AdminTextField label="Açıklama" name="description" />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Paket oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-2">
        {plans.map((plan) => {
          const updatePlan = updateAdminPlanAction.bind(null, plan.id);
          const upsertEntitlement = upsertAdminEntitlementAction.bind(null, plan.id);
          return (
            <AdminPanel key={plan.id} className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-black text-slate-950 sm:text-2xl">{displayPlanName(plan.name)}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {plan.product.name} · {plan.key}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusPill active={plan.isActive}>{plan.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>
                  <AdminActionMenu label="Durum" ariaLabel={`${plan.name} durum`}>
                    <AdminActionMenuSection title="Paket durumu">
                      <AdminInlineToggleForm
                        action={updateAdminPlanActiveAction.bind(null, plan.id)}
                        returnTo="/admin/plans"
                        isActive={plan.isActive}
                        requireHighRiskConfirm
                      />
                    </AdminActionMenuSection>
                  </AdminActionMenu>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <AdminInfoRow label="Aylık fiyat" value={moneyLabel(plan.priceMonthly, plan.currency)} />
                <AdminInfoRow label="Yıllık fiyat" value={moneyLabel(plan.priceYearly, plan.currency)} />
                <AdminInfoRow label="Kurulum" value={moneyLabel(plan.setupFee, plan.currency)} />
                <AdminInfoRow
                  label="İşlem ücreti (başlangıç)"
                  value={plan.processingFeePct != null ? `%${Number(plan.processingFeePct)}` : "-"}
                />
                <AdminInfoRow
                  label="Aylık min. işlem taahhüdü"
                  value={moneyLabel(plan.minimumTransactionCommitment, plan.currency)}
                />
                <AdminInfoRow label="Tier key" value={plan.tierKey ?? "-"} />
                <AdminInfoRow label="Manuel inceleme" value={plan.requiresManualReview ? "Evet" : "Hayır"} />
                <AdminInfoRow label="Settlement" value={plan.settlementDisplay ?? "-"} />
                <AdminInfoRow label="Tek seferlik" value={moneyLabel(plan.priceOneTime, plan.currency)} />
                <AdminInfoRow label="KDV" value={`%${plan.taxRatePct}`} />
                <AdminInfoRow label="Şube limiti" value={entitlementValue(plan, "branch_limit")} />
                <AdminInfoRow label="Masa limiti" value={entitlementValue(plan, "table_limit")} />
                <AdminInfoRow label="Ürün limiti" value={entitlementValue(plan, "product_limit")} />
                <AdminInfoRow label="Personel limiti" value={entitlementValue(plan, "staff_limit")} />
                <AdminInfoRow label="Aylık işlem limiti" value={entitlementValue(plan, "monthly_order_limit")} />
                <AdminInfoRow label="API limiti" value={entitlementValue(plan, "api_request_limit")} />
                <AdminInfoRow label="Lisans sayısı" value={plan.licenses.length} />
              </div>

              <details className="group mt-6 border-t border-slate-100 pt-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-950">Paketi düzenle</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-slate-100 text-sm font-black text-slate-600 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <form action={updatePlan} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="returnTo" value="/admin/plans" />
                <AdminTextField label="Ad" name="name" defaultValue={plan.name} required />
                <AdminSelectField
                  label="Faturalama"
                  name="billingInterval"
                  defaultValue={plan.billingInterval}
                  options={[
                    { value: "MONTHLY", label: "Aylık" },
                    { value: "YEARLY", label: "Yıllık" },
                    { value: "ONE_TIME", label: "Tek seferlik" },
                  ]}
                />
                <AdminTextField label="Sıra" name="sortOrder" type="number" defaultValue={String(plan.sortOrder)} />
                <AdminTextField label="Tier key" name="tierKey" defaultValue={plan.tierKey ?? ""} />
                <AdminTextField
                  label="Aylık fiyat (TRY)"
                  name="priceMonthly"
                  type="number"
                  defaultValue={plan.priceMonthly != null ? String(Number(plan.priceMonthly)) : ""}
                />
                <AdminTextField
                  label="Yıllık fiyat (TRY)"
                  name="priceYearly"
                  type="number"
                  defaultValue={plan.priceYearly != null ? String(Number(plan.priceYearly)) : ""}
                />
                <AdminTextField
                  label="Kurulum ücreti (TRY)"
                  name="setupFee"
                  type="number"
                  defaultValue={plan.setupFee != null ? String(Number(plan.setupFee)) : ""}
                />
                <AdminTextField
                  label="İşlem ücreti başlangıç %"
                  name="processingFeePct"
                  type="number"
                  defaultValue={plan.processingFeePct != null ? String(Number(plan.processingFeePct)) : ""}
                />
                <AdminTextField
                  label="Aylık minimum işlem taahhüdü (TRY)"
                  name="minimumTransactionCommitment"
                  type="number"
                  defaultValue={
                    plan.minimumTransactionCommitment != null
                      ? String(Number(plan.minimumTransactionCommitment))
                      : ""
                  }
                />
                <AdminTextField
                  label="Settlement metni"
                  name="settlementDisplay"
                  defaultValue={plan.settlementDisplay ?? ""}
                />
                <AdminSelectField
                  label="Manuel inceleme"
                  name="requiresManualReview"
                  defaultValue={plan.requiresManualReview ? "true" : "false"}
                  options={[
                    { value: "false", label: "Hayır" },
                    { value: "true", label: "Evet" },
                  ]}
                />
                <AdminTextField
                  label="Tek seferlik fiyat (TRY)"
                  name="priceOneTime"
                  type="number"
                  defaultValue={plan.priceOneTime != null ? String(Number(plan.priceOneTime)) : ""}
                />
                <AdminTextField label="Para birimi" name="currency" defaultValue={plan.currency} />
                <AdminTextField label="KDV (%)" name="taxRatePct" type="number" defaultValue={String(plan.taxRatePct)} />
                <AdminSelectField
                  label="Herkese açık"
                  name="isPublic"
                  defaultValue={plan.isPublic ? "true" : "false"}
                  options={[
                    { value: "true", label: "Evet" },
                    { value: "false", label: "Hayır" },
                  ]}
                />
                <AdminSelectField
                  label="Aktif"
                  name="isActive"
                  defaultValue={plan.isActive ? "true" : "false"}
                  options={[
                    { value: "true", label: "Evet" },
                    { value: "false", label: "Hayır" },
                  ]}
                />
                <div className="sm:col-span-2">
                  <AdminTextField label="Açıklama" name="description" defaultValue={plan.description ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <AdminSubmitButton>Paketi güncelle</AdminSubmitButton>
                </div>
              </form>
              </details>

              <details className="group mt-4 border-t border-slate-100 pt-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-950">Limitler (entitlement)</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-slate-100 text-sm font-black text-slate-600 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                {plan.entitlements.map((item) => {
                  const toggleEntitlement = setAdminEntitlementActiveAction.bind(null, plan.id, item.id);
                  const entitlementActive = item.isActive !== false;
                  return (
                    <div key={item.id} className="rounded-[10px] border border-slate-200 bg-slate-50/80 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          {item.key}: {item.valueString ?? item.valueInt ?? (item.valueBool ? "true" : "false")}
                          {!entitlementActive ? " · devre dışı" : ""}
                        </span>
                        <div className="flex items-center gap-2">
                          <AdminStatusPill active={entitlementActive}>
                            {entitlementActive ? "Aktif" : "Pasif"}
                          </AdminStatusPill>
                          <AdminActionMenu label="İşlem" ariaLabel={`${item.key} işlem`} widthClassName="w-[min(100vw-2rem,20rem)]">
                            <AdminActionMenuSection title={entitlementActive ? "Devre dışı bırak" : "Yeniden etkinleştir"}>
                              <form action={toggleEntitlement} className="grid gap-2">
                                <input type="hidden" name="returnTo" value="/admin/plans" />
                                <input type="hidden" name="isActive" value={entitlementActive ? "false" : "true"} />
                                {entitlementActive ? (
                                  <>
                                    <input
                                      name="reason"
                                      required
                                      minLength={8}
                                      placeholder="Gerekçe (min 8 karakter)"
                                      className={ADMIN_FIELD_CONTROL_COMPACT}
                                    />
                                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                      <input type="checkbox" name="confirmed" value="1" required className="h-3.5 w-3.5 rounded border-slate-300" />
                                      Onaylıyorum
                                    </label>
                                  </>
                                ) : (
                                  <AdminTextField label="Not (isteğe bağlı)" name="note" placeholder="Yeniden etkinleştirme gerekçesi" />
                                )}
                                <AdminSubmitButton>
                                  {entitlementActive ? "Devre Dışı Bırak" : "Yeniden Etkinleştir"}
                                </AdminSubmitButton>
                              </form>
                            </AdminActionMenuSection>
                          </AdminActionMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <form action={upsertEntitlement} className="grid gap-2 rounded-[10px] border border-dashed border-slate-200 p-3 sm:grid-cols-2">
                  <input type="hidden" name="returnTo" value="/admin/plans" />
                  <AdminTextField label="Anahtar" name="key" placeholder="staff_limit" required />
                  <AdminSelectField
                    label="Tip"
                    name="valueType"
                    defaultValue="INTEGER"
                    options={[
                      { value: "INTEGER", label: "Sayı" },
                      { value: "BOOLEAN", label: "Boolean" },
                      { value: "STRING", label: "Metin" },
                    ]}
                  />
                  <AdminTextField label="Değer (sayı/metin)" name="valueInt" placeholder="10" />
                  <AdminSelectField
                    label="Boolean"
                    name="valueBool"
                    defaultValue="true"
                    options={[
                      { value: "true", label: "true" },
                      { value: "false", label: "false" },
                    ]}
                  />
                  <div className="sm:col-span-2">
                    <AdminSubmitButton>Limit ekle / güncelle</AdminSubmitButton>
                  </div>
                </form>
                </div>
              </details>
            </AdminPanel>
          );
        })}
      </div>
    </div>
  );
}
