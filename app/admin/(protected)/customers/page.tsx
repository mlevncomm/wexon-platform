import Link from "next/link";
import { AdminEmptyState, AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminFormPanel, AdminSubmitButton } from "@/components/marketing/WexonAdminForms";
import { AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import {
  createAdminOrganizationAction,
  deactivateAdminOrganizationAction,
  reactivateAdminOrganizationAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminStatus, getAdminOrganizationsData } from "@/lib/wexon-admin";

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const organizations = await getAdminOrganizationsData();
  const activeCount = organizations.filter((org) => org.isActive).length;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Müşteriler"
          title="Müşteri operasyon merkezi"
          description="Müşteri kartlarından hızlı yönetim, lisans ve işletme özetine tek tıkla erişim."
        />
        <AdminQuickLinks
          links={[
            { label: "Yeni müşteri", href: "/admin/organizations" },
            { label: "Lisanslar", href: "/admin/licenses" },
            { label: "Faturalar", href: "/admin/billing" },
            { label: "Destek", href: "/admin/support" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminSummaryCard label="Toplam müşteri" value={organizations.length} />
        <AdminSummaryCard label="Aktif müşteri" value={activeCount} />
        <AdminSummaryCard label="Pasif müşteri" value={organizations.length - activeCount} />
      </section>

      <AdminFormPanel title="Hızlı müşteri oluştur" description="Temel kayıt oluşturur; WexPay erişimi müşteri detayından açılır." collapsible defaultOpen={organizations.length === 0}>
        <form action={createAdminOrganizationAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="returnTo" value="/admin/customers" />
          <input name="name" placeholder="Organizasyon adı" required className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold" />
          <input name="slug" placeholder="slug" required className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold" />
          <input name="email" type="email" placeholder="E-posta" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold" />
          <input name="phone" placeholder="Telefon" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold" />
          <div className="md:col-span-2">
            <AdminSubmitButton>Müşteri oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {organizations.length === 0 ? (
        <AdminEmptyState>Henüz müşteri kaydı bulunmuyor.</AdminEmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {organizations.map((organization) => {
            const license = organization.licenses.find((item) => item.product.key === "wexpay") ?? organization.licenses[0];
            const deactivate = deactivateAdminOrganizationAction.bind(null, organization.id);
            const reactivate = reactivateAdminOrganizationAction.bind(null, organization.id);
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
                  <AdminInfoRow label="Paket" value={license ? displayPlanName(license.plan.name) : "-"} />
                  <AdminInfoRow label="Lisans durumu" value={license ? formatAdminStatus(license.status) : "-"} />
                  <AdminInfoRow label="İşletme" value={organization.restaurants.length} />
                  <AdminInfoRow label="Kullanıcı" value={organization.memberships.length} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/admin/organizations/${organization.id}`} className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-[#48e050]">
                    Yönet
                  </Link>
                  <Link href={`/dashboard?organizationId=${organization.id}`} className="inline-flex rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Panel görünümü
                  </Link>
                  {organization.isActive ? (
                    <form action={deactivate}>
                      <input type="hidden" name="returnTo" value="/admin/customers" />
                      <button type="submit" className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100">
                        Pasifleştir
                      </button>
                    </form>
                  ) : (
                    <form action={reactivate}>
                      <input type="hidden" name="returnTo" value="/admin/customers" />
                      <button type="submit" className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-100">
                        Aktifleştir
                      </button>
                    </form>
                  )}
                </div>
              </AdminPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
