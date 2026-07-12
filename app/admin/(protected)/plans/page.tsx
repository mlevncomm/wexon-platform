import { AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminFormPanel, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
import { AdminInlineToggleForm, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import {
  createAdminPlanAction,
  deleteAdminEntitlementAction,
  updateAdminPlanAction,
  updateAdminPlanActiveAction,
  upsertAdminEntitlementAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, getAdminPlansData, getAdminProductsData } from "@/lib/wexon-admin";

function entitlementValue(plan: Awaited<ReturnType<typeof getAdminPlansData>>[number], key: string) {
  const item = plan.entitlements.find((entry) => entry.key === key);
  return item?.valueString ?? item?.valueInt ?? (item?.valueBool ? "Evet" : "-");
}

function planAmount(value: unknown, currency: string) {
  if (value === null || value === undefined) return "-";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "-";
  return `${amount.toLocaleString("tr-TR")} ${currency}`;
}

function decimalDefault(value: unknown) {
  if (value === null || value === undefined) return "";
  const amount = Number(value);
  return Number.isNaN(amount) ? "" : String(amount);
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
          description="Paket oluşturun, limitleri düzenleyin ve lisans dağılımını kontrol edin."
        />
        <AdminQuickLinks
          links={[
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
          <AdminTextField label="Aylık ücret (KDV hariç)" name="priceMonthly" type="number" placeholder="2990" />
          <AdminTextField label="Yıllık ücret (KDV hariç)" name="priceYearly" type="number" placeholder="29900" />
          <AdminTextField label="Para birimi" name="currency" defaultValue="TRY" />
          <AdminTextField label="Sıra" name="sortOrder" type="number" defaultValue="0" />
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
                <AdminInfoRow label="Şube limiti" value={entitlementValue(plan, "branch_limit")} />
                <AdminInfoRow label="Masa limiti" value={entitlementValue(plan, "table_limit")} />
                <AdminInfoRow label="Ürün limiti" value={entitlementValue(plan, "product_limit")} />
                <AdminInfoRow label="Personel limiti" value={entitlementValue(plan, "staff_limit")} />
                <AdminInfoRow label="Aylık işlem limiti" value={entitlementValue(plan, "monthly_transaction_limit")} />
                <AdminInfoRow label="Aylık ücret" value={planAmount(plan.priceMonthly, plan.currency)} />
                <AdminInfoRow label="Yıllık ücret" value={planAmount(plan.priceYearly, plan.currency)} />
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
                <AdminTextField label="Aylık ücret (KDV hariç)" name="priceMonthly" type="number" defaultValue={decimalDefault(plan.priceMonthly)} />
                <AdminTextField label="Yıllık ücret (KDV hariç)" name="priceYearly" type="number" defaultValue={decimalDefault(plan.priceYearly)} />
                <AdminTextField label="Para birimi" name="currency" defaultValue={plan.currency} />
                <AdminTextField label="Sıra" name="sortOrder" type="number" defaultValue={String(plan.sortOrder)} />
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
                  const deleteEntitlement = deleteAdminEntitlementAction.bind(null, plan.id, item.id);
                  return (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-xs font-bold text-slate-700">
                        {item.key}: {item.valueString ?? item.valueInt ?? (item.valueBool ? "true" : "false")}
                      </span>
                      <form action={deleteEntitlement}>
                        <input type="hidden" name="returnTo" value="/admin/plans" />
                        <button type="submit" className="text-xs font-bold text-rose-600 hover:underline">
                          Sil
                        </button>
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
