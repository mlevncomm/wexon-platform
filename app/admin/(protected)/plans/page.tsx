import { AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminFormPanel, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
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
          <AdminSelectField label="Ürün" name="productId">
            <option value="">Seçin</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </AdminSelectField>
          <AdminTextField label="Key" name="key" placeholder="wexpay_pro" required />
          <AdminTextField label="Paket adı" name="name" required />
          <AdminSelectField label="Faturalama" name="billingInterval" defaultValue="MONTHLY">
            <option value="MONTHLY">Aylık</option>
            <option value="YEARLY">Yıllık</option>
            <option value="ONE_TIME">Tek seferlik</option>
          </AdminSelectField>
          <AdminTextField label="Sıra" name="sortOrder" type="number" defaultValue="0" />
          <AdminTextField label="Aylık fiyat (TRY)" name="priceMonthly" type="number" placeholder="7500" />
          <AdminTextField label="Yıllık fiyat (TRY)" name="priceYearly" type="number" placeholder="75000" />
          <AdminTextField label="Kurulum ücreti (TRY)" name="setupFee" type="number" placeholder="12000" />
          <AdminTextField label="İşlem ücreti başlangıç %" name="processingFeePct" type="number" placeholder="2.89" />
          <AdminTextField label="Aylık minimum işlem taahhüdü (TRY)" name="minimumTransactionCommitment" type="number" placeholder="10000" />
          <AdminTextField label="Tier key" name="tierKey" placeholder="essential" />
          <AdminTextField label="Settlement metni" name="settlementDisplay" placeholder="Standart · onay bağlı" />
          <AdminSelectField label="Manuel inceleme" name="requiresManualReview" defaultValue="false">
            <option value="false">Hayır</option>
            <option value="true">Evet</option>
          </AdminSelectField>
          <AdminTextField label="Tek seferlik fiyat (TRY)" name="priceOneTime" type="number" />
          <AdminTextField label="Para birimi" name="currency" defaultValue="TRY" />
          <AdminTextField label="KDV (%)" name="taxRatePct" type="number" defaultValue="20" />
          <AdminSelectField label="Herkese açık" name="isPublic" defaultValue="true">
            <option value="true">Evet</option>
            <option value="false">Hayır</option>
          </AdminSelectField>
          <AdminSelectField label="Aktif" name="isActive" defaultValue="true">
            <option value="true">Evet</option>
            <option value="false">Hayır</option>
          </AdminSelectField>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminTextField label="Açıklama" name="description" />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Paket oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      <div className="grid gap-5 xl:grid-cols-2">
        {plans.map((plan) => {
          const updatePlan = updateAdminPlanAction.bind(null, plan.id);
          const upsertEntitlement = upsertAdminEntitlementAction.bind(null, plan.id);
          return (
            <AdminPanel key={plan.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{displayPlanName(plan.name)}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {plan.product.name} · {plan.key}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AdminStatusPill active={plan.isActive}>{plan.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>
                  <AdminInlineToggleForm action={updateAdminPlanActiveAction.bind(null, plan.id)} returnTo="/admin/plans" isActive={plan.isActive} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
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

              <form action={updatePlan} className="mt-6 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-2">
                <input type="hidden" name="returnTo" value="/admin/plans" />
                <AdminTextField label="Ad" name="name" defaultValue={plan.name} required />
                <AdminSelectField label="Faturalama" name="billingInterval" defaultValue={plan.billingInterval}>
                  <option value="MONTHLY">Aylık</option>
                  <option value="YEARLY">Yıllık</option>
                  <option value="ONE_TIME">Tek seferlik</option>
                </AdminSelectField>
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
                >
                  <option value="false">Hayır</option>
                  <option value="true">Evet</option>
                </AdminSelectField>
                <AdminTextField
                  label="Tek seferlik fiyat (TRY)"
                  name="priceOneTime"
                  type="number"
                  defaultValue={plan.priceOneTime != null ? String(Number(plan.priceOneTime)) : ""}
                />
                <AdminTextField label="Para birimi" name="currency" defaultValue={plan.currency} />
                <AdminTextField label="KDV (%)" name="taxRatePct" type="number" defaultValue={String(plan.taxRatePct)} />
                <AdminSelectField label="Herkese açık" name="isPublic" defaultValue={plan.isPublic ? "true" : "false"}>
                  <option value="true">Evet</option>
                  <option value="false">Hayır</option>
                </AdminSelectField>
                <AdminSelectField label="Aktif" name="isActive" defaultValue={plan.isActive ? "true" : "false"}>
                  <option value="true">Evet</option>
                  <option value="false">Hayır</option>
                </AdminSelectField>
                <div className="md:col-span-2">
                  <AdminTextField label="Açıklama" name="description" defaultValue={plan.description ?? ""} />
                </div>
                <div className="md:col-span-2">
                  <AdminSubmitButton>Paketi güncelle</AdminSubmitButton>
                </div>
              </form>

              <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Limitler (entitlement)</p>
                {plan.entitlements.map((item) => {
                  const toggleEntitlement = setAdminEntitlementActiveAction.bind(null, plan.id, item.id);
                  const entitlementActive = item.isActive !== false;
                  return (
                    <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          {item.key}: {item.valueString ?? item.valueInt ?? (item.valueBool ? "true" : "false")}
                          {!entitlementActive ? " · devre dışı" : ""}
                        </span>
                        <AdminStatusPill active={entitlementActive}>
                          {entitlementActive ? "Aktif" : "Pasif"}
                        </AdminStatusPill>
                      </div>
                      <form action={toggleEntitlement} className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                        <input type="hidden" name="returnTo" value="/admin/plans" />
                        <input type="hidden" name="isActive" value={entitlementActive ? "false" : "true"} />
                        <AdminTextField
                          label="Not (isteğe bağlı)"
                          name="note"
                          placeholder="Devre dışı bırakma veya yeniden etkinleştirme gerekçesi"
                        />
                        <div className="flex items-end">
                          <AdminSubmitButton>
                            {entitlementActive ? "Devre Dışı Bırak" : "Yeniden Etkinleştir"}
                          </AdminSubmitButton>
                        </div>
                      </form>
                    </div>
                  );
                })}
                <form action={upsertEntitlement} className="grid gap-2 rounded-xl border border-dashed border-slate-200 p-3 md:grid-cols-4">
                  <input type="hidden" name="returnTo" value="/admin/plans" />
                  <AdminTextField label="Anahtar" name="key" placeholder="staff_limit" required />
                  <AdminSelectField label="Tip" name="valueType" defaultValue="INTEGER">
                    <option value="INTEGER">Sayı</option>
                    <option value="BOOLEAN">Boolean</option>
                    <option value="STRING">Metin</option>
                  </AdminSelectField>
                  <AdminTextField label="Değer (sayı/metin)" name="valueInt" placeholder="10" />
                  <AdminSelectField label="Boolean" name="valueBool" defaultValue="true">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </AdminSelectField>
                  <div className="md:col-span-4">
                    <AdminSubmitButton>Limit ekle / güncelle</AdminSubmitButton>
                  </div>
                </form>
              </div>
            </AdminPanel>
          );
        })}
      </div>
    </div>
  );
}
