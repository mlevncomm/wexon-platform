import { AdminEmptyState, AdminPanel, AdminSectionTitle } from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminButton,
  AdminActionMenu,
  AdminActionMenuHint,
  AdminActionMenuSection,
  AdminFormPanel,
  AdminSelectField,
  AdminSubmitButton,
  AdminTextField,
} from "@/components/marketing/WexonAdminForms";
import { AdminOrganizationCard } from "@/components/marketing/admin-ui/AdminOrganizationCard";
import {
  createAdminOrganizationAction,
  deactivateAdminOrganizationAction,
  reactivateAdminOrganizationAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminStatus, getAdminOrganizationsData } from "@/lib/wexon-admin";
import { prisma } from "@/lib/prisma";
import { buildActivationJourneyView, WEXPAY_PRODUCT_KEY } from "@/lib/wexpay-activation-journey";
import Link from "next/link";

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ adminError?: string }>;
}) {
  const { adminError } = await searchParams;
  const [organizations, activationJourneys] = await Promise.all([
    getAdminOrganizationsData(),
    prisma.activationJourney.findMany({
      where: { product: { key: WEXPAY_PRODUCT_KEY } },
      include: { steps: true, organization: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const journeyByOrg = new Map(
    activationJourneys.map((journey) => [journey.organizationId, buildActivationJourneyView(journey)]),
  );

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

      {activationJourneys.length > 0 ? (
        <AdminPanel>
          <AdminSectionTitle
            badge="Akıllı Aktivasyon"
            title="Aktivasyon yolculukları"
            description="Read-only liste. Kurulum Modu / Canlıya Geçiş durumunu müşteri detayından inceleyin."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activationJourneys.slice(0, 12).map((journey) => {
              const view = buildActivationJourneyView(journey);
              return (
                <Link
                  key={journey.id}
                  href={`/admin/organizations/${journey.organizationId}`}
                  className="rounded-[12px] border border-slate-200 bg-white p-4 transition hover:border-emerald-300"
                >
                  <p className="text-sm font-black text-slate-950">{journey.organization.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {view.statusLabel}
                    {view.setupMode ? " · Kurulum Modu" : " · Canlı Kullanım"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{view.sourceLabel}</p>
                </Link>
              );
            })}
          </div>
        </AdminPanel>
      ) : null}

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
          <AdminSelectField
            label="Durum"
            name="isActive"
            defaultValue="true"
            options={[
              { value: "true", label: "Aktif" },
              { value: "false", label: "Pasif" },
            ]}
          />
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Müşteri oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {organizations.length === 0 ? (
        <AdminEmptyState>Henüz organizasyon bulunmuyor.</AdminEmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {organizations.map((organization) => {
            const license =
              organization.licenses.find((item) => item.product.key === "wexpay") ?? organization.licenses[0];
            return (
              <AdminOrganizationCard
                key={organization.id}
                name={organization.name}
                secondary={organization.email ?? organization.slug}
                isActive={organization.isActive}
                manageHref={`/admin/organizations/${organization.id}`}
                meta={[
                  { label: "Ürün", value: license?.product.name ?? "-" },
                  { label: "Paket", value: license ? displayPlanName(license.plan.name) : "-" },
                  { label: "Lisans", value: license ? formatAdminStatus(license.status) : "-" },
                  {
                    label: "Aktivasyon",
                    value: journeyByOrg.get(organization.id)?.statusLabel ?? "Başlamadı",
                  },
                  { label: "İşletme", value: organization.restaurants.length },
                ]}
                actions={
                  <AdminActionMenu label="İşlemler" ariaLabel={`${organization.name} işlemleri`}>
                    <AdminActionMenuSection title="Gelişmiş">
                      <AdminActionMenuHint>
                        {organization.isActive
                          ? "Müşteriyi silmez; pasife alır ve aktif WexPay erişimini durdurur."
                          : "Müşteriyi tekrar aktif hale getirir. Mevcut kayıtlar korunur."}
                      </AdminActionMenuHint>
                      {organization.isActive ? (
                        <form action={deactivateAdminOrganizationAction.bind(null, organization.id)}>
                          <AdminButton type="submit" variant="secondary" className="w-full">
                            Pasife al
                          </AdminButton>
                        </form>
                      ) : (
                        <form action={reactivateAdminOrganizationAction.bind(null, organization.id)}>
                          <AdminButton type="submit" variant="primary" className="w-full">
                            Tekrar aktif et
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
