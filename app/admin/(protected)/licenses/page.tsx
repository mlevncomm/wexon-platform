import {
  AdminEmptyState,
  AdminResponsiveRows,
  AdminSectionTitle,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
  AdminTableToolbar,
  adminStatusToneFromValue,
} from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminActionMenu,
  AdminActionMenuSection,
  AdminDateField,
  AdminFormPanel,
  AdminSelectField,
  AdminSubmitButton,
  AdminTextField,
} from "@/components/marketing/WexonAdminForms";
import { AdminConfirmCheckbox } from "@/components/marketing/admin-ui/AdminOrganizationCard";
import { AdminInlineSelectForm, AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import {
  changeAdminLicenseStatusAction,
  createAdminLicenseFromListAction,
} from "@/lib/wexon-admin-actions";
import {
  displayPlanName,
  formatAdminDate,
  formatAdminStatus,
  getAdminLicensesData,
  getAdminOperationOptions,
} from "@/lib/wexon-admin";
import { generateAdminMutationKey } from "@/lib/wexon-admin-mutation-idempotency";

const licenseStatusOptions = [
  { value: "TRIAL", label: "Deneme" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAST_DUE", label: "Gecikmiş" },
  { value: "SUSPENDED", label: "Askıda" },
  { value: "CANCELLED", label: "İptal" },
  { value: "EXPIRED", label: "Süresi dolmuş" },
];

function LicenseStatusMenu({
  organizationId,
  licenseId,
  organizationName,
  status,
}: {
  organizationId: string;
  licenseId: string;
  organizationName: string;
  status: string;
}) {
  return (
    <AdminActionMenu label="Durum" ariaLabel={`${organizationName} lisans işlemi`}>
      <AdminActionMenuSection title="Durumu güncelle">
        <AdminInlineSelectForm
          action={changeAdminLicenseStatusAction.bind(null, organizationId, licenseId)}
          returnTo="/admin/licenses"
          fieldName="status"
          value={status}
          options={licenseStatusOptions}
          requireHighRiskConfirm
        />
      </AdminActionMenuSection>
    </AdminActionMenu>
  );
}

export default async function AdminLicensesPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [licenses, options] = await Promise.all([getAdminLicensesData(), getAdminOperationOptions()]);
  const attention = licenses.filter(
    (license) => license.status === "PAST_DUE" || license.status === "SUSPENDED" || license.status === "EXPIRED",
  );
  const licenseMutationId = generateAdminMutationKey();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Lisanslar"
          title="Lisans operasyonları"
          description="Tüm müşteri lisanslarını buradan izleyin, durum güncelleyin ve yeni lisans atayın."
        />
        <AdminQuickLinks
          links={[
            { label: "Müşteriler", href: "/admin/organizations" },
            { label: "Paketler", href: "/admin/plans" },
            { label: "Abonelikler", href: "/admin/subscriptions" },
            { label: "İşlem geçmişi", href: "/admin/audit-logs?status=FAILURE" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminSummaryCard label="Toplam lisans" value={licenses.length} />
        <AdminSummaryCard label="Dikkat gerektiren" value={attention.length} helper="Gecikmiş, askıda veya süresi dolmuş" />
        <AdminSummaryCard label="Aktif lisans" value={licenses.filter((l) => l.status === "ACTIVE").length} />
      </section>

      <AdminFormPanel title="Yeni lisans ata" description="WexPay lisansı oluşturur ve ürün kurulumunu aktifleştirir." collapsible>
        <form action={createAdminLicenseFromListAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="returnTo" value="/admin/licenses" />
          <input type="hidden" name="productKey" value="wexpay" />
          <input type="hidden" name="mutationId" value={licenseMutationId} />
          <AdminSelectField
            label="Müşteri"
            name="organizationId"
            defaultValue=""
            options={[
              { value: "", label: "Müşteri seçin", disabled: true },
              ...options.organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
              })),
            ]}
          />
          <AdminSelectField
            label="Paket"
            name="planId"
            defaultValue=""
            options={[
              { value: "", label: "Paket seçin", disabled: true },
              ...options.plans.map((plan) => ({
                value: plan.id,
                label: `${plan.product.name} · ${displayPlanName(plan.name)}`,
              })),
            ]}
          />
          <AdminSelectField
            label="Lisans tipi"
            name="licenseType"
            defaultValue="MONTHLY"
            options={[
              { value: "MONTHLY", label: "Aylık" },
              { value: "YEARLY", label: "Yıllık" },
              { value: "ONE_TIME", label: "Tek seferlik" },
            ]}
          />
          <AdminSelectField label="Durum" name="status" defaultValue="ACTIVE" options={licenseStatusOptions} />
          <AdminDateField label="Başlangıç" name="startsAt" defaultValue={new Date().toISOString().slice(0, 10)} required />
          <AdminDateField label="Bitiş / yenileme" name="endsAt" />
          <AdminTextField label="İşlem gerekçesi" name="reason" required placeholder="Lisans oluşturma gerekçesi" />
          <div className="md:col-span-2 xl:col-span-3">
            <AdminConfirmCheckbox>Manuel lisans kaydının oluşturulacağını onaylıyorum.</AdminConfirmCheckbox>
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Lisans oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {licenses.length === 0 ? (
        <AdminEmptyState>Henüz lisans bulunmuyor.</AdminEmptyState>
      ) : (
        <AdminTableShell
          toolbar={<AdminTableToolbar title="Lisans listesi" description={`${licenses.length} kayıt`} />}
          mobile={
            <AdminResponsiveRows
              rows={licenses.map((license) => ({
                key: license.id,
                primary: (
                  <div className="min-w-0">
                    <AdminOrgLink id={license.organizationId} name={license.organization.name} />
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {license.product.name} · {displayPlanName(license.plan.name)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatAdminDate(license.startsAt)} → {formatAdminDate(license.endsAt)}
                    </p>
                  </div>
                ),
                meta: (
                  <AdminStatusPill tone={adminStatusToneFromValue(license.status)}>
                    {formatAdminStatus(license.status)}
                  </AdminStatusPill>
                ),
                actions: (
                  <LicenseStatusMenu
                    organizationId={license.organizationId}
                    licenseId={license.id}
                    organizationName={license.organization.name}
                    status={license.status}
                  />
                ),
              }))}
            />
          }
        >
          <table className="w-full table-fixed text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="w-[28%]">Müşteri</th>
                <th className="w-[26%]">Ürün / Plan</th>
                <th className="hidden w-[22%] xl:table-cell">Dönem</th>
                <th className="w-[14%]">Durum</th>
                <th className="w-[140px]">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id}>
                  <td className="min-w-0">
                    <div className="truncate">
                      <AdminOrgLink id={license.organizationId} name={license.organization.name} />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500 xl:hidden">
                      {formatAdminDate(license.startsAt)} → {formatAdminDate(license.endsAt)}
                    </p>
                  </td>
                  <td className="min-w-0 text-slate-600">
                    <span className="block truncate font-bold text-slate-950">{license.product.name}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                      {displayPlanName(license.plan.name)}
                    </span>
                  </td>
                  <td className="hidden min-w-0 text-slate-600 xl:table-cell">
                    <span className="block truncate">
                      {formatAdminDate(license.startsAt)} → {formatAdminDate(license.endsAt)}
                    </span>
                  </td>
                  <td className="min-w-0">
                    <AdminStatusPill tone={adminStatusToneFromValue(license.status)}>
                      {formatAdminStatus(license.status)}
                    </AdminStatusPill>
                  </td>
                  <td className="min-w-0">
                    <LicenseStatusMenu
                      organizationId={license.organizationId}
                      licenseId={license.id}
                      organizationName={license.organization.name}
                      status={license.status}
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
