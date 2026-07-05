import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardInfoRow,
  DashboardPanel,
  DashboardSectionTitle,
  DashboardStatusPill,
} from "@/components/marketing/WexonDashboardCards";
import { updateCustomerOrganizationAction } from "@/lib/wexon-customer-actions";
import { canUpdateOrganization, getCurrentCustomerUser } from "@/lib/wexon-customer-auth";
import { getCustomerDashboardData } from "@/lib/wexon-core-dashboard";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string; customerError?: string }>;

export default async function DashboardOrganizationPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const [{ organization }, currentUser] = await Promise.all([
    getCustomerDashboardData(params),
    getCurrentCustomerUser(),
  ]);

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bilgileri bulunamadı."
        description="Organizasyon detaylarını görüntülemek için organizasyon kaydı gereklidir."
      />
    );
  }

  const currentMembership = currentUser?.memberships.find((membership) => membership.organizationId === organization.id);
  const canEdit = currentMembership ? canUpdateOrganization(currentMembership.role) : false;

  return (
    <div className="space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Organizasyon"
        title="Organizasyon ve bağlı işletmeler"
        description="Organizasyon bilgileri, iletişim alanları ve bağlı işletmeler burada görüntülenir."
      />
      <DashboardPanel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardInfoRow label="Organizasyon adı" value={organization.name} />
          <DashboardInfoRow label="Kısa ad" value={organization.slug} />
          <DashboardInfoRow label="Ülke" value={organization.country} />
          <DashboardInfoRow label="E-posta" value={organization.email ?? "-"} />
          <DashboardInfoRow label="Telefon" value={organization.phone ?? "-"} />
          <DashboardInfoRow label="Vergi / şirket bilgisi" value={organization.taxNo ?? "Henüz tanımlanmadı"} />
        </div>
      </DashboardPanel>
      <DashboardPanel>
        <DashboardSectionTitle
          badge="Self-service"
          title="Organizasyon bilgilerini düzenle"
          description="Bu alan yalnızca organizasyon sahibi veya yöneticileri tarafından güncellenebilir."
        />
        {params.customerError && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {params.customerError}
          </div>
        )}
        {canEdit ? (
          <form action={updateCustomerOrganizationAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="organizationId" value={organization.id} />
            <label className="block md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Organizasyon adı</span>
              <input name="name" defaultValue={organization.name} required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Ticari ünvan</span>
              <input name="legalName" defaultValue={organization.legalName ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Vergi / şirket bilgisi</span>
              <input name="taxNo" defaultValue={organization.taxNo ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">E-posta</span>
              <input name="email" type="email" defaultValue={organization.email ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Telefon</span>
              <input name="phone" defaultValue={organization.phone ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Ülke</span>
              <input name="country" defaultValue={organization.country} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-[#48e050] sm:w-auto">
                Bilgileri güncelle
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <p className="text-sm font-black">Bu alanı düzenleme yetkiniz yok.</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed">
              Organizasyon bilgilerini yalnızca sahip veya yönetici rolündeki kullanıcılar güncelleyebilir.
            </p>
          </div>
        )}
      </DashboardPanel>
      <DashboardPanel>
        <h2 className="mb-5 text-2xl font-black tracking-[-0.02em] text-slate-950">Bağlı işletmeler</h2>
        <div className="space-y-3">
          {organization.restaurants.map((restaurant) => (
            <div key={restaurant.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{restaurant.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{restaurant.slug}</p>
                </div>
                <DashboardStatusPill active={restaurant.isActive}>{restaurant.isActive ? "Aktif" : "Pasif"}</DashboardStatusPill>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Şube sayısı: {restaurant.branches.length}
              </p>
            </div>
          ))}
        </div>
      </DashboardPanel>
    </div>
  );
}
