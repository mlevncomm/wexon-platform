import Link from "next/link";
import { AdminEmptyState, AdminSectionTitle, AdminStatusPill, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminFormPanel } from "@/components/marketing/WexonAdminForms";
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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ adminError?: string; q?: string }>;
}) {
  const { adminError, q } = await searchParams;
  const users = await getAdminUsersData(q);
  const activeUsers = users.filter((user) => user.isActive);
  const mustChange = users.filter((user) => user.mustChangePassword);

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

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="min-w-[240px] flex-1">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Ara</span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="E-posta veya ad..."
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300"
          />
        </label>
        <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-[#48e050]">
          Filtrele
        </button>
      </form>

      {users.length === 0 ? (
        <AdminEmptyState>Kullanıcı bulunamadı.</AdminEmptyState>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-5 py-4 font-bold">Kullanıcı</th>
                <th className="px-5 py-4 font-bold">Üyelikler</th>
                <th className="px-5 py-4 font-bold">Son giriş</th>
                <th className="px-5 py-4 font-bold">Durum</th>
                <th className="px-5 py-4 font-bold">Şifre sıfırla</th>
                <th className="px-5 py-4 font-bold">Hesap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const resetPassword = resetAdminUserPasswordAction.bind(null, user.id);
                const toggleActive = toggleAdminUserActiveAction.bind(null, user.id);
                return (
                  <tr key={user.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-950">{user.name ?? "—"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{user.email}</p>
                      {user.mustChangePassword ? (
                        <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Şifre değişimi gerekli</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      {user.memberships.length === 0 ? (
                        <span className="text-slate-400">Üyelik yok</span>
                      ) : (
                        <div className="space-y-2">
                          {user.memberships.map((membership) => (
                            <div key={membership.id} className="text-xs">
                              <AdminOrgLink id={membership.organizationId} name={membership.organization.name} />
                              <span className="ml-2 text-slate-500">
                                {formatAdminStatus(membership.role)} · {formatAdminStatus(membership.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatAdminDate(user.lastLoginAt)}</td>
                    <td className="px-5 py-4">
                      <AdminStatusPill active={user.isActive}>{user.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>
                    </td>
                    <td className="px-5 py-4">
                      <form action={resetPassword} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="returnTo" value={`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`} />
                        <input
                          name="temporaryPassword"
                          type="password"
                          placeholder="Yeni şifre"
                          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          required
                          minLength={8}
                        />
                        <input type="hidden" name="mustChangePassword" value="true" />
                        <button type="submit" className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#48e050]">
                          Sıfırla
                        </button>
                      </form>
                    </td>
                    <td className="px-5 py-4">
                      <form action={toggleActive}>
                        <input type="hidden" name="returnTo" value={`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`} />
                        <button
                          type="submit"
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                            user.isActive
                              ? "border border-amber-200 bg-amber-50 text-amber-800"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          {user.isActive ? "Pasife al" : "Aktifleştir"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
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
