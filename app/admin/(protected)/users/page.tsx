import Link from "next/link";
import {
  AdminEmptyState,
  AdminResponsiveRows,
  AdminSectionTitle,
  AdminStatusBadge,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
  AdminTableToolbar,
} from "@/components/marketing/WexonAdminCards";
import {
  AdminActionMenu,
  AdminActionMenuSection,
  AdminActionNotice,
  AdminButton,
  AdminFormPanel,
  ADMIN_FIELD_CONTROL,
  ADMIN_FIELD_CONTROL_COMPACT,
} from "@/components/marketing/WexonAdminForms";
import { AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { resetAdminUserPasswordAction, toggleAdminUserActiveAction } from "@/lib/wexon-admin-actions";
import { formatAdminDate, formatAdminStatus, getAdminUsersData } from "@/lib/wexon-admin";

const membershipRoleOptions = [
  { value: "OWNER", label: "Sahip" },
  { value: "ADMIN", label: "Yönetici" },
  { value: "MANAGER", label: "Müdür" },
  { value: "STAFF", label: "Personel" },
  { value: "BILLING", label: "Faturalama" },
  { value: "VIEWER", label: "Görüntüleyici" },
];

function UserActionsMenu({
  userId,
  email,
  isActive,
  returnTo,
}: {
  userId: string;
  email: string;
  isActive: boolean;
  returnTo: string;
}) {
  const resetPassword = resetAdminUserPasswordAction.bind(null, userId);
  const toggleActive = toggleAdminUserActiveAction.bind(null, userId);

  return (
    <AdminActionMenu label="İşlemler" ariaLabel={`${email} işlemleri`} align="right">
      <AdminActionMenuSection title="Şifre sıfırla">
        <form action={resetPassword} className="grid gap-2">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input
            name="temporaryPassword"
            type="password"
            placeholder="Yeni şifre (min 8)"
            className={ADMIN_FIELD_CONTROL_COMPACT}
            required
            minLength={8}
          />
          <input type="hidden" name="mustChangePassword" value="true" />
          <AdminButton type="submit" variant="primary" className="w-full">
            Şifreyi sıfırla
          </AdminButton>
        </form>
      </AdminActionMenuSection>
      <AdminActionMenuSection title="Hesap durumu">
        <form action={toggleActive}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <AdminButton type="submit" variant="secondary" className="w-full">
            {isActive ? "Pasife al" : "Aktifleştir"}
          </AdminButton>
        </form>
      </AdminActionMenuSection>
    </AdminActionMenu>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ adminError?: string; q?: string }>;
}) {
  const { adminError, q } = await searchParams;
  const users = await getAdminUsersData(q);
  const activeUsers = users.filter((user) => user.isActive);
  const mustChange = users.filter((user) => user.mustChangePassword);
  const returnTo = `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Kullanıcılar"
          title="Global kullanıcı yönetimi"
          description="Tüm platform kullanıcılarını arayın, şifre sıfırlayın ve hesap durumunu yönetin."
        />
        <AdminQuickLinks
          links={[
            { label: "Müşteriler", href: "/admin/organizations" },
            { label: "Lisanslar", href: "/admin/licenses" },
            { label: "İşlem geçmişi", href: "/admin/audit-logs" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminSummaryCard label="Toplam kullanıcı" value={users.length} />
        <AdminSummaryCard label="Aktif hesap" value={activeUsers.length} />
        <AdminSummaryCard label="Şifre değişimi bekleyen" value={mustChange.length} />
      </section>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-[12px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
        <label className="min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[240px]">
          <span className="text-xs font-bold text-slate-600">Ara</span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="E-posta veya ad..."
            className={ADMIN_FIELD_CONTROL}
          />
        </label>
        <AdminButton type="submit" variant="primary">
          Filtrele
        </AdminButton>
      </form>

      {users.length === 0 ? (
        <AdminEmptyState>Kullanıcı bulunamadı.</AdminEmptyState>
      ) : (
        <AdminTableShell
          toolbar={<AdminTableToolbar title="Kullanıcı listesi" description={`${users.length} kayıt`} />}
          mobile={
            <AdminResponsiveRows
              rows={users.map((user) => ({
                key: user.id,
                primary: (
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">{user.name ?? "—"}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">{user.email}</p>
                    {user.mustChangePassword ? (
                      <AdminStatusBadge tone="pending" className="mt-2">
                        Şifre değişimi gerekli
                      </AdminStatusBadge>
                    ) : null}
                  </div>
                ),
                secondary:
                  user.memberships.length === 0 ? (
                    <span className="text-slate-400">Üyelik yok</span>
                  ) : (
                    <div className="space-y-1">
                      {user.memberships.map((membership) => (
                        <div key={membership.id} className="truncate text-xs">
                          <AdminOrgLink id={membership.organizationId} name={membership.organization.name} />
                          <span className="ml-2 text-slate-500">
                            {formatAdminStatus(membership.role)} · {formatAdminStatus(membership.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ),
                meta: <AdminStatusPill active={user.isActive}>{user.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>,
                actions: (
                  <UserActionsMenu userId={user.id} email={user.email} isActive={user.isActive} returnTo={returnTo} />
                ),
              }))}
            />
          }
        >
          <table className="w-full table-fixed text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="w-[32%]">Kullanıcı</th>
                <th className="hidden w-[28%] xl:table-cell">Üyelikler</th>
                <th className="hidden w-[16%] 2xl:table-cell">Son giriş</th>
                <th className="w-[16%]">Durum</th>
                <th className="w-[140px]">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="align-middle">
                  <td className="min-w-0">
                    <p className="truncate font-black text-slate-950">{user.name ?? "—"}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">{user.email}</p>
                    {user.mustChangePassword ? (
                      <AdminStatusBadge tone="pending" className="mt-2">
                        Şifre değişimi gerekli
                      </AdminStatusBadge>
                    ) : null}
                    <div className="mt-2 space-y-1 xl:hidden">
                      {user.memberships.length === 0 ? (
                        <span className="text-xs text-slate-400">Üyelik yok</span>
                      ) : (
                        user.memberships.slice(0, 2).map((membership) => (
                          <div key={membership.id} className="truncate text-xs text-slate-500">
                            <AdminOrgLink id={membership.organizationId} name={membership.organization.name} />
                            <span className="ml-1">· {formatAdminStatus(membership.role)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="hidden min-w-0 xl:table-cell">
                    {user.memberships.length === 0 ? (
                      <span className="text-slate-400">Üyelik yok</span>
                    ) : (
                      <div className="space-y-2">
                        {user.memberships.map((membership) => (
                          <div key={membership.id} className="truncate text-xs">
                            <AdminOrgLink id={membership.organizationId} name={membership.organization.name} />
                            <span className="ml-2 text-slate-500">
                              {formatAdminStatus(membership.role)} · {formatAdminStatus(membership.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="hidden truncate text-slate-600 2xl:table-cell">{formatAdminDate(user.lastLoginAt)}</td>
                  <td className="min-w-0">
                    <AdminStatusPill active={user.isActive}>{user.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>
                  </td>
                  <td className="min-w-0">
                    <UserActionsMenu userId={user.id} email={user.email} isActive={user.isActive} returnTo={returnTo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}

      <AdminFormPanel title="Rol referansı" description="Üyelik rolü değişiklikleri müşteri detay sayfasından yapılır." collapsible>
        <div className="flex flex-wrap gap-2">
          {membershipRoleOptions.map((role) => (
            <span key={role.value} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {role.label}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-500">
          Müşteri bazlı rol ve üyelik durumu için{" "}
          <Link href="/admin/organizations" className="font-bold text-emerald-700 hover:underline">
            müşteri detay
          </Link>{" "}
          sayfasını kullanın.
        </p>
      </AdminFormPanel>
    </div>
  );
}
