import Link from "next/link";
import { AdminEmptyState, AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminFormPanel, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
import { createAdminOrganizationAction, deactivateAdminOrganizationAction, reactivateAdminOrganizationAction } from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminStatus, getAdminOrganizationsData } from "@/lib/wexon-admin";

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const organizations = await getAdminOrganizationsData();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <AdminSectionTitle
          badge="Müşteriler"
          title="Müşteri yönetimi"
          description="Yeni müşteri oluşturun, WexPay paketini ve müşteri durumunu hızlıca kontrol edin."
        />
      </div>
      {adminError && <AdminActionNotice tone="error">{adminError}</AdminActionNotice>}

      <AdminFormPanel
        title="Yeni müşteri oluştur"
        description="Temel müşteri kaydını oluşturur. WexPay erişimi ve lisans ataması müşteri detayında yapılır."
        collapsible
      >
        <form action={createAdminOrganizationAction} className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="returnTo" value="/admin/organizations" />
          <AdminTextField label="Organizasyon adı" name="name" placeholder="Mavi Bahçe" required />
          <AdminTextField label="Slug" name="slug" placeholder="mavi-bahce" required />
          <AdminTextField label="E-posta" name="email" type="email" placeholder="admin@ornek.com" />
          <AdminTextField label="Telefon" name="phone" placeholder="+90..." />
          <AdminTextField label="Ülke" name="country" defaultValue="TR" />
          <AdminSelectField label="Durum" name="isActive" defaultValue="true">
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </AdminSelectField>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Müşteri oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {organizations.length === 0 ? (
        <AdminEmptyState>Henüz organizasyon bulunmuyor.</AdminEmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {organizations.map((organization) => {
            const license = organization.licenses.find((item) => item.product.key === "wexpay") ?? organization.licenses[0];
            return (
              <AdminPanel key={organization.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">{organization.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{organization.email ?? organization.slug}</p>
                  </div>
                  <AdminStatusPill active={organization.isActive}>{organization.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <AdminInfoRow label="Aktif ürün" value={license?.product.name ?? "-"} />
                  <AdminInfoRow label="Paket" value={license ? displayPlanName(license.plan.name) : "-"} />
                  <AdminInfoRow label="Lisans" value={license ? formatAdminStatus(license.status) : "-"} />
                  <AdminInfoRow label="İşletme" value={organization.restaurants.length} />
                </div>
                <Link href={`/admin/organizations/${organization.id}`} className="mt-5 inline-flex rounded-full bg-[#5dff65] px-5 py-3 text-sm font-bold text-white">
                  Yönet
                </Link>
                <details className={`mt-4 rounded-2xl border p-4 ${organization.isActive ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <summary className={`cursor-pointer text-sm font-black ${organization.isActive ? "text-amber-900" : "text-emerald-900"}`}>
                    Gelişmiş işlem
                  </summary>
                  {organization.isActive ? (
                    <>
                      <p className="mt-3 text-xs font-semibold leading-relaxed text-amber-900">
                        Bu işlem müşteriyi silmez, pasife alır ve aktif WexPay erişimini durdurur.
                      </p>
                      <form action={deactivateAdminOrganizationAction.bind(null, organization.id)} className="mt-3">
                        <button type="submit" className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white hover:bg-amber-700">
                          Pasife al
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-xs font-semibold leading-relaxed text-emerald-900">
                        Bu işlem müşteriyi tekrar aktif hale getirir. Mevcut kayıtlar korunur.
                      </p>
                      <form action={reactivateAdminOrganizationAction.bind(null, organization.id)} className="mt-3">
                        <button type="submit" className="rounded-xl bg-[#48e050] px-4 py-2.5 text-xs font-black text-white hover:bg-[#48e050]">
                          Tekrar aktif et
                        </button>
                      </form>
                    </>
                  )}
                </details>
              </AdminPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
