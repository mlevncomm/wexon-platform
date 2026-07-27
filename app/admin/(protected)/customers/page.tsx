import Link from "next/link";
import { AdminEmptyState, AdminSectionTitle, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminButton,
  AdminActionMenu,
  AdminActionMenuHint,
  AdminActionMenuSection,
  AdminFormPanel,
  AdminSubmitButton,
  AdminTextField,
} from "@/components/marketing/WexonAdminForms";
import { AdminOrganizationCard } from "@/components/marketing/admin-ui/AdminOrganizationCard";
import { AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import {
  createAdminOrganizationAction,
  deactivateAdminOrganizationAction,
  reactivateAdminOrganizationAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminStatus, getAdminOrganizationsData } from "@/lib/wexon-admin";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ adminError?: string }>;
}) {
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

      <AdminFormPanel
        title="Hızlı müşteri oluştur"
        description="Temel kayıt oluşturur; WexPay erişimi müşteri detayından açılır."
        collapsible
        defaultOpen={organizations.length === 0}
      >
        <form action={createAdminOrganizationAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="returnTo" value="/admin/customers" />
          <AdminTextField label="Organizasyon adı" name="name" placeholder="Organizasyon adı" required />
          <AdminTextField label="Slug" name="slug" placeholder="slug" required />
          <AdminTextField label="E-posta" name="email" type="email" placeholder="E-posta" />
          <AdminTextField label="Telefon" name="phone" placeholder="Telefon" />
          <div className="md:col-span-2">
            <AdminSubmitButton>Müşteri oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {organizations.length === 0 ? (
        <AdminEmptyState>Henüz müşteri kaydı bulunmuyor.</AdminEmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {organizations.map((organization) => {
            const license =
              organization.licenses.find((item) => item.product.key === "wexpay") ?? organization.licenses[0];
            const deactivate = deactivateAdminOrganizationAction.bind(null, organization.id);
            const reactivate = reactivateAdminOrganizationAction.bind(null, organization.id);
            return (
              <AdminOrganizationCard
                key={organization.id}
                name={organization.name}
                secondary={organization.email ?? organization.slug}
                isActive={organization.isActive}
                manageHref={`/admin/organizations/${organization.id}`}
                meta={[
                  { label: "Paket", value: license ? displayPlanName(license.plan.name) : "-" },
                  { label: "Lisans", value: license ? formatAdminStatus(license.status) : "-" },
                  { label: "İşletme", value: organization.restaurants.length },
                  { label: "Kullanıcı", value: organization.memberships.length },
                ]}
                actions={
                  <AdminActionMenu label="İşlemler" ariaLabel={`${organization.name} işlemleri`}>
                    <AdminActionMenuSection title="Hızlı erişim">
                      <Link
                        href={`/dashboard?organizationId=${organization.id}`}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Panel görünümü
                      </Link>
                    </AdminActionMenuSection>
                    <AdminActionMenuSection title="Durum">
                      <AdminActionMenuHint>
                        {organization.isActive
                          ? "Müşteriyi pasife alır; kayıtlar korunur."
                          : "Müşteriyi tekrar aktif hale getirir."}
                      </AdminActionMenuHint>
                      {organization.isActive ? (
                        <form action={deactivate} className="grid gap-2">
                          <input type="hidden" name="returnTo" value="/admin/customers" />
                          <AdminButton type="submit" variant="secondary" className="w-full">
                            Pasifleştir
                          </AdminButton>
                        </form>
                      ) : (
                        <form action={reactivate} className="grid gap-2">
                          <input type="hidden" name="returnTo" value="/admin/customers" />
                          <AdminButton type="submit" variant="primary" className="w-full">
                            Aktifleştir
                          </AdminButton>
                        </form>
                      )}
                    </AdminActionMenuSection>
                  </AdminActionMenu>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
