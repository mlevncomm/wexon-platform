import Link from "next/link";
import { AdminEmptyState, AdminPageHeader, AdminStatusPill, AdminStatGrid, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminDateField, AdminFormPanel, AdminSelectField, AdminSubmitButton } from "@/components/marketing/WexonAdminForms";
import { AdminInlineSelectForm, AdminOrgLink } from "@/components/marketing/WexonAdminOperations";
import {
  changeAdminLicenseStatusAction,
  createAdminLicenseFromListAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminDate, formatAdminStatus, getAdminLicensesData, getAdminOperationOptions } from "@/lib/wexon-admin";

const licenseStatusOptions = [
  { value: "TRIAL", label: "Deneme" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAST_DUE", label: "Gecikmiş" },
  { value: "SUSPENDED", label: "Askıda" },
  { value: "CANCELLED", label: "İptal" },
  { value: "EXPIRED", label: "Süresi dolmuş" },
];

export default async function AdminLicensesPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [licenses, options] = await Promise.all([getAdminLicensesData(), getAdminOperationOptions()]);
  const clock = new Date().getTime();
  const attention = licenses.filter((license) => license.status === "PAST_DUE" || license.status === "SUSPENDED" || license.status === "EXPIRED");
  const expiringSoon = licenses.filter((license) => {
    if (!license.endsAt || license.status === "EXPIRED" || license.status === "CANCELLED") return false;
    const ms = license.endsAt.getTime() - clock;
    return ms > 0 && ms <= 30 * 24 * 60 * 60 * 1000;
  });
  const trial = licenses.filter((license) => license.status === "TRIAL").length;
  const suspended = licenses.filter((license) => license.status === "SUSPENDED").length;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        badge="Lisanslar"
        title="Lisans operasyonları"
        description="Müşteri lisanslarını izleyin, durum güncelleyin ve yeni lisans atayın."
        actions={
          <>
            <Link href="/admin/plans" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Paketler
            </Link>
            <Link href="/admin/subscriptions" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Abonelikler
            </Link>
          </>
        }
      />

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <AdminStatGrid>
        <AdminSummaryCard label="Aktif lisans" value={licenses.filter((license) => license.status === "ACTIVE").length} helper="ACTIVE durumu" tone="success" />
        <AdminSummaryCard label="Deneme" value={trial} helper="TRIAL durumu" />
        <AdminSummaryCard label="Yakında sona erecek" value={expiringSoon.length} helper="30 gün içinde bitiş" tone={expiringSoon.length ? "warning" : "default"} />
        <AdminSummaryCard label="Askıda" value={suspended} helper="SUSPENDED" />
        <AdminSummaryCard label="Dikkat gerektiren" value={attention.length} helper="Gecikmiş, askıda veya süresi dolmuş" tone={attention.length ? "danger" : "default"} />
        <AdminSummaryCard label="Toplam lisans" value={licenses.length} helper="Tüm kayıtlar" />
      </AdminStatGrid>

      <AdminFormPanel title="Yeni lisans ata" description="WexPay lisansı oluşturur ve ürün kurulumunu aktifleştirir." collapsible>
        <form action={createAdminLicenseFromListAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="returnTo" value="/admin/licenses" />
          <input type="hidden" name="productKey" value="wexpay" />
          <AdminSelectField label="Müşteri" name="organizationId" defaultValue="">
            <option value="" disabled>
              Müşteri seçin
            </option>
            {options.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </AdminSelectField>
          <AdminSelectField label="Paket" name="planId" defaultValue="">
            <option value="" disabled>
              Paket seçin
            </option>
            {options.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.product.name} · {displayPlanName(plan.name)}
              </option>
            ))}
          </AdminSelectField>
          <AdminSelectField label="Lisans tipi" name="licenseType" defaultValue="MONTHLY">
            <option value="MONTHLY">Aylık</option>
            <option value="YEARLY">Yıllık</option>
            <option value="ONE_TIME">Tek seferlik</option>
          </AdminSelectField>
          <AdminSelectField label="Durum" name="status" defaultValue="ACTIVE">
            {licenseStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AdminSelectField>
          <AdminDateField label="Başlangıç" name="startsAt" defaultValue={new Date().toISOString().slice(0, 10)} required />
          <AdminDateField label="Bitiş / yenileme" name="endsAt" />
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Lisans oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {licenses.length === 0 ? (
        <AdminEmptyState>Henüz lisans bulunmuyor.</AdminEmptyState>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-5 py-4 font-bold">Müşteri</th>
                <th className="px-5 py-4 font-bold">Ürün / Plan</th>
                <th className="px-5 py-4 font-bold">Dönem</th>
                <th className="px-5 py-4 font-bold">Durum</th>
                <th className="px-5 py-4 font-bold">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {licenses.map((license) => (
                <tr key={license.id}>
                  <td className="px-5 py-4">
                    <AdminOrgLink id={license.organizationId} name={license.organization.name} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {license.product.name} · {displayPlanName(license.plan.name)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatAdminDate(license.startsAt)} → {formatAdminDate(license.endsAt)}
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusPill active={license.status === "ACTIVE"}>{formatAdminStatus(license.status)}</AdminStatusPill>
                  </td>
                  <td className="px-5 py-4">
                    <AdminInlineSelectForm
                      action={changeAdminLicenseStatusAction.bind(null, license.organizationId, license.id)}
                      returnTo="/admin/licenses"
                      fieldName="status"
                      value={license.status}
                      options={licenseStatusOptions}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </div>
  );
}
