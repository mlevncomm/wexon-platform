import {
  AdminEmptyState,
  AdminSectionTitle,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminFormPanel,
  AdminSubmitButton,
  AdminTextField,
} from "@/components/marketing/WexonAdminForms";
import { AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
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
        <h3 className="mt-1 text-xl font-black text-slate-950">PR2A hazırlık durumu</h3>
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
          <li>Paylaşılan admin şifresi geçiş sürecinde hâlâ kullanılmaktadır (PR2A).</li>
          <li>Cloudflare Access JWT doğrulama ve subject bağlama PR2B&apos;de yapılacaktır.</li>
          <li>Bu ekranda secret, JWT veya ortam değişkeni değeri gösterilmez.</li>
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <AdminSummaryCard label="Toplam kayıt" value={admins.length} />
        <AdminSummaryCard label="Aktif" value={activeCount} />
      </section>

      <AdminFormPanel
        title="Yeni platform yöneticisi"
        description="E-posta trim+lowercase ile tekilleştirilir. Cloudflare subject PR2B'de bağlanır."
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
        <AdminTableShell>
          <table className="w-full min-w-[640px] text-left text-sm lg:min-w-0">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-3 py-4 font-bold sm:px-5">Yönetici</th>
                <th className="hidden px-3 py-4 font-bold sm:px-5 md:table-cell">Cloudflare</th>
                <th className="hidden px-3 py-4 font-bold sm:px-5 xl:table-cell">Son giriş</th>
                <th className="px-3 py-4 font-bold sm:px-5">Durum</th>
                <th className="px-3 py-4 font-bold sm:px-5">Görünen ad</th>
                <th className="px-3 py-4 font-bold sm:px-5">Hesap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((admin) => {
                const updateDisplayName = updatePlatformAdminDisplayNameAction.bind(null, admin.id);
                const setActive = setPlatformAdminActiveAction.bind(null, admin.id);
                const cloudflareLabel = formatCloudflareSubjectStatus(admin.cloudflareSubject);
                return (
                  <tr key={admin.id} className="align-top">
                    <td className="min-w-0 px-3 py-4 sm:px-5">
                      <p className="break-words font-black text-slate-950">{admin.displayName}</p>
                      <p className="mt-1 break-all text-xs font-semibold text-slate-500">{admin.email}</p>
                    </td>
                    <td className="hidden px-3 py-4 sm:px-5 md:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          cloudflareLabel === "Bağlandı"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {cloudflareLabel}
                      </span>
                    </td>
                    <td className="hidden px-3 py-4 text-slate-600 sm:px-5 xl:table-cell">
                      {formatAdminDate(admin.lastLoginAt)}
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <AdminStatusPill active={admin.isActive}>
                        {admin.isActive ? "Aktif" : "Pasif"}
                      </AdminStatusPill>
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <form action={updateDisplayName} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="returnTo" value="/admin/platform-admins" />
                        <input
                          name="displayName"
                          defaultValue={admin.displayName}
                          required
                          maxLength={120}
                          className="w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Kaydet
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <form action={setActive}>
                        <input type="hidden" name="returnTo" value="/admin/platform-admins" />
                        <input type="hidden" name="isActive" value={admin.isActive ? "false" : "true"} />
                        <button
                          type="submit"
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                            admin.isActive
                              ? "border border-amber-200 bg-amber-50 text-amber-800"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          {admin.isActive ? "Pasife al" : "Aktifleştir"}
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
    </div>
  );
}
