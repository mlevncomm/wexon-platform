import {
  AdminEmptyState,
  AdminResponsiveRows,
  AdminSectionTitle,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminActionMenu,
  AdminActionMenuSection,
  AdminButton,
  AdminFormPanel,
  AdminSubmitButton,
  AdminTextField,
  ADMIN_FIELD_CONTROL_COMPACT,
} from "@/components/marketing/WexonAdminForms";
import { AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { AdminStatusBadge } from "@/components/marketing/admin-ui/AdminStatusBadge";
import {
  createPlatformAdminAction,
  setPlatformAdminActiveAction,
  updatePlatformAdminDisplayNameAction,
} from "@/lib/wexon-platform-admin-actions";
import {
  countActivePlatformAdmins,
  evaluatePlatformAdminReadiness,
  formatCloudflareSubjectStatus,
  listPlatformAdmins,
} from "@/lib/wexon-platform-admin";
import { formatAdminDate } from "@/lib/wexon-admin";
import { prisma } from "@/lib/prisma";

function PlatformAdminActionsMenu({
  adminId,
  email,
  displayName,
  isActive,
}: {
  adminId: string;
  email: string;
  displayName: string;
  isActive: boolean;
}) {
  const updateDisplayName = updatePlatformAdminDisplayNameAction.bind(null, adminId);
  const setActive = setPlatformAdminActiveAction.bind(null, adminId);

  return (
    <AdminActionMenu label="İşlemler" ariaLabel={`${email} işlemleri`}>
      <AdminActionMenuSection title="Görünen ad">
        <form action={updateDisplayName} className="grid gap-2">
          <input type="hidden" name="returnTo" value="/admin/platform-admins" />
          <input
            name="displayName"
            defaultValue={displayName}
            required
            maxLength={120}
            className={ADMIN_FIELD_CONTROL_COMPACT}
          />
          <AdminButton type="submit" variant="primary" className="w-full">
            Adı kaydet
          </AdminButton>
        </form>
      </AdminActionMenuSection>
      <AdminActionMenuSection title="Hesap">
        <form action={setActive}>
          <input type="hidden" name="returnTo" value="/admin/platform-admins" />
          <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
          <AdminButton type="submit" variant="secondary" className="w-full">
            {isActive ? "Pasife al" : "Aktifleştir"}
          </AdminButton>
        </form>
      </AdminActionMenuSection>
    </AdminActionMenu>
  );
}

export default async function AdminPlatformAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ adminError?: string }>;
}) {
  const { adminError } = await searchParams;
  const [admins, activeCount] = await Promise.all([
    listPlatformAdmins(prisma),
    countActivePlatformAdmins(prisma),
  ]);
  const readiness = evaluatePlatformAdminReadiness(activeCount);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Platform yöneticileri"
          title="PlatformAdmin yönetimi"
          description="Wexon platform operatörlerini yönetin. Tenant kullanıcılarından (/admin/users) ayrıdır; rol sistemi yoktur."
        />
        <AdminQuickLinks
          links={[
            { label: "Ayarlar", href: "/admin/settings" },
            { label: "İşlem geçmişi", href: "/admin/audit-logs" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:rounded-[32px] sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Hazırlık paneli</p>
        <h3 className="mt-1 text-xl font-black text-slate-950">PR2B kimlik durumu</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">{readiness.message}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <AdminSummaryCard label="Aktif PlatformAdmin" value={readiness.activeCount} />
          <AdminSummaryCard
            label="Öneri"
            value={readiness.recommendAtLeastTwo ? "En az 2 aktif" : "Yeterli"}
          />
          <AdminSummaryCard label="Cloudflare kimliği" value={readiness.cloudflareIdentity} />
        </div>
        <ul className="mt-5 space-y-2 text-sm font-semibold text-slate-600">
          <li>Her istekte Cloudflare Access JWT doğrulanır; oturum çerezi tek başına yetmez.</li>
          <li>İlk girişte Cloudflare subject, eşleşen aktif PlatformAdmin kaydına bağlanır.</li>
          <li>Bu ekranda secret, JWT veya ortam değişkeni değeri gösterilmez.</li>
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <AdminSummaryCard label="Toplam kayıt" value={admins.length} />
        <AdminSummaryCard label="Aktif" value={activeCount} />
      </section>

      <AdminFormPanel
        title="Yeni platform yöneticisi"
        description="E-posta trim+lowercase ile tekilleştirilir. Cloudflare subject ilk başarılı girişte bağlanır."
        collapsible
        defaultOpen={admins.length === 0}
      >
        <form action={createPlatformAdminAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="returnTo" value="/admin/platform-admins" />
          <AdminTextField label="E-posta" name="email" type="email" required placeholder="admin@ornek.com" />
          <AdminTextField label="Görünen ad" name="displayName" required placeholder="Operatör adı" />
          <div className="sm:col-span-2">
            <AdminSubmitButton>Ekle</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {admins.length === 0 ? (
        <AdminEmptyState>Henüz PlatformAdmin kaydı yok. İlk operatörü ekleyin.</AdminEmptyState>
      ) : (
        <AdminTableShell
          mobile={
            <AdminResponsiveRows
              rows={admins.map((admin) => {
                const cloudflareLabel = formatCloudflareSubjectStatus(admin.cloudflareSubject);
                return {
                  key: admin.id,
                  primary: (
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">{admin.displayName}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{admin.email}</p>
                    </div>
                  ),
                  secondary: (
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge tone={cloudflareLabel === "Bağlandı" ? "active" : "inactive"}>
                        {cloudflareLabel}
                      </AdminStatusBadge>
                      <span className="truncate text-xs text-slate-500">
                        Son giriş: {formatAdminDate(admin.lastLoginAt)}
                      </span>
                    </div>
                  ),
                  meta: (
                    <AdminStatusPill active={admin.isActive}>
                      {admin.isActive ? "Aktif" : "Pasif"}
                    </AdminStatusPill>
                  ),
                  actions: (
                    <PlatformAdminActionsMenu
                      adminId={admin.id}
                      email={admin.email}
                      displayName={admin.displayName}
                      isActive={admin.isActive}
                    />
                  ),
                };
              })}
            />
          }
        >
          <table className="w-full table-fixed text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="w-[36%]">Yönetici</th>
                <th className="hidden w-[18%] xl:table-cell">Cloudflare</th>
                <th className="hidden w-[18%] 2xl:table-cell">Son giriş</th>
                <th className="w-[14%]">Durum</th>
                <th className="w-[140px]">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const cloudflareLabel = formatCloudflareSubjectStatus(admin.cloudflareSubject);
                return (
                  <tr key={admin.id} className="align-middle">
                    <td className="min-w-0">
                      <p className="truncate font-black text-slate-950">{admin.displayName}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{admin.email}</p>
                      <div className="mt-2 xl:hidden">
                        <AdminStatusBadge tone={cloudflareLabel === "Bağlandı" ? "active" : "inactive"}>
                          {cloudflareLabel}
                        </AdminStatusBadge>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500 2xl:hidden">
                        Son giriş: {formatAdminDate(admin.lastLoginAt)}
                      </p>
                    </td>
                    <td className="hidden min-w-0 xl:table-cell">
                      <AdminStatusBadge tone={cloudflareLabel === "Bağlandı" ? "active" : "inactive"}>
                        {cloudflareLabel}
                      </AdminStatusBadge>
                    </td>
                    <td className="hidden min-w-0 truncate text-slate-600 2xl:table-cell">
                      {formatAdminDate(admin.lastLoginAt)}
                    </td>
                    <td className="min-w-0">
                      <AdminStatusPill active={admin.isActive}>
                        {admin.isActive ? "Aktif" : "Pasif"}
                      </AdminStatusPill>
                    </td>
                    <td className="min-w-0">
                      <PlatformAdminActionsMenu
                        adminId={admin.id}
                        email={admin.email}
                        displayName={admin.displayName}
                        isActive={admin.isActive}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </div>
  );
}
