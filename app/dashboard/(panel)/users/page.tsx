import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardPanel,
  DashboardRoleCard,
  DashboardSectionTitle,
} from "@/components/marketing/WexonDashboardCards";
import {
  addCustomerOrganizationUserAction,
  deactivateCustomerMembershipAction,
  reactivateCustomerMembershipAction,
  updateCustomerMembershipRoleAction,
} from "@/lib/wexon-customer-actions";
import { canManageOrganizationUsers, getCurrentCustomerUser } from "@/lib/wexon-customer-auth";
import { formatCoreDate, formatCoreStatus, getCustomerDashboardData, roleDescriptions } from "@/lib/wexon-core-dashboard";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string; customerError?: string }>;

export default async function DashboardUsersPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const [{ organization }, currentUser] = await Promise.all([
    getCustomerDashboardData(params),
    getCurrentCustomerUser(),
  ]);

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bilgileri bulunamadı."
        description="Kullanıcı bilgilerini görüntülemek için organizasyon kaydı gereklidir."
      />
    );
  }

  const currentMembership = currentUser?.memberships.find((membership) => membership.organizationId === organization.id);
  const canManageUsers = currentMembership ? canManageOrganizationUsers(currentMembership.role) : false;
  const roleOptions = [
    ["OWNER", "Sahip"],
    ["ADMIN", "Yönetici"],
    ["MANAGER", "Müdür"],
    ["STAFF", "Personel"],
    ["BILLING", "Faturalama"],
    ["VIEWER", "Görüntüleyici"],
  ];

  return (
    <div className="space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Kullanıcılar"
        title="Kullanıcılar ve erişim"
        description="Organizasyon kullanıcılarını, rollerini ve erişim durumlarını bu alandan takip edin."
      />
      {params.customerError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {params.customerError}
        </div>
      )}

      <DashboardPanel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950">Organizasyon kullanıcıları</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Toplam kullanıcı: {organization.memberships.length}</p>
          </div>
        </div>
      {organization.memberships.length === 0 ? (
        <DashboardEmptyState
          title="Henüz kullanıcı daveti oluşturulmadı."
          description="Kullanıcılar ve roller bu alanda görüntülenecektir."
        />
      ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-black">Ad</th>
                  <th className="px-4 py-3 font-black">E-posta</th>
                  <th className="px-4 py-3 font-black">Rol</th>
                  <th className="px-4 py-3 font-black">Durum</th>
                  <th className="px-4 py-3 font-black">Eklenme</th>
                  <th className="px-4 py-3 font-black">Aksiyonlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
            {organization.memberships.map((membership) => (
                  <tr key={membership.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-950">{membership.user.name ?? "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{membership.user.email}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatCoreStatus(membership.role)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatCoreStatus(membership.status)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatCoreDate(membership.createdAt)}</td>
                    <td className="px-4 py-3">
                      {canManageUsers ? (
                        <div className="flex flex-wrap gap-2">
                          <form action={updateCustomerMembershipRoleAction} className="flex gap-2">
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <input type="hidden" name="membershipId" value={membership.id} />
                            <select name="role" defaultValue={membership.role} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">
                              {roleOptions.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                            <button type="submit" className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Güncelle</button>
                          </form>
                          <form action={membership.status === "ACTIVE" ? deactivateCustomerMembershipAction : reactivateCustomerMembershipAction}>
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <input type="hidden" name="membershipId" value={membership.id} />
                            <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                              {membership.status === "ACTIVE" ? "Pasife al" : "Aktif et"}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">Sadece görüntüleme</span>
                      )}
                    </td>
                  </tr>
            ))}
              </tbody>
            </table>
          </div>
      )}
      </DashboardPanel>

      {canManageUsers ? (
        <DashboardPanel>
          <DashboardSectionTitle
            badge="Kullanıcı ekle"
            title="Yeni kullanıcı oluştur"
            description="Geçici şifre müşterinin Wexon Core müşteri paneline giriş yapması için kullanılır."
          />
          <form action={addCustomerOrganizationUserAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="organizationId" value={organization.id} />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Ad</span>
              <input name="name" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">E-posta</span>
              <input name="email" type="email" required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Rol</span>
              <select name="role" defaultValue="STAFF" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100">
                {roleOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Geçici şifre</span>
              <input name="temporaryPassword" type="password" required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <input name="mustChangePassword" value="true" type="checkbox" defaultChecked className="mt-1 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="block text-sm font-black text-slate-950">İlk girişte şifre değiştirmeye zorla</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">Kullanıcı ilk girişten sonra kendi şifresini belirler.</span>
              </span>
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                Kullanıcı ekle
              </button>
            </div>
          </form>
        </DashboardPanel>
      ) : (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="text-sm font-black">Bu alanı yönetme yetkiniz yok.</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed">
            Kullanıcı yönetimini yalnızca sahip veya yönetici rolündeki kullanıcılar yapabilir.
          </p>
        </div>
      )}

      <DashboardPanel>
        <h2 className="mb-5 text-2xl font-black tracking-[-0.02em] text-slate-950">Rol açıklamaları</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roleDescriptions.map((role) => (
            <DashboardRoleCard key={role.title} title={role.title} description={role.description} />
          ))}
        </div>
      </DashboardPanel>
    </div>
  );
}
