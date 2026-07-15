import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminStatGrid,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import { AdminResultCount } from "@/components/marketing/WexonAdminContent";
import { AdminActionNotice, AdminFormPanel, AdminSubmitButton } from "@/components/marketing/WexonAdminForms";
import {
  createAdminOrganizationAction,
  deactivateAdminOrganizationAction,
  reactivateAdminOrganizationAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminDate, formatAdminStatus, getAdminOrganizationsData } from "@/lib/wexon-admin";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ adminError?: string; q?: string; status?: string }>;
}) {
  const { adminError, q, status } = await searchParams;
  const organizations = await getAdminOrganizationsData();
  const query = q?.trim().toLowerCase() ?? "";
  const filtered = organizations.filter((organization) => {
    if (status === "active" && !organization.isActive) return false;
    if (status === "inactive" && organization.isActive) return false;
    if (status === "demo" && !organization.isDemo) return false;
    if (status === "real" && organization.isDemo) return false;
    if (!query) return true;
    const haystack = [organization.name, organization.email, organization.slug, organization.phone]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  const activeCount = organizations.filter((org) => org.isActive).length;
  const demoCount = organizations.filter((org) => org.isDemo).length;
  const wexPayCount = organizations.filter((org) =>
    org.licenses.some((license) => license.product.key === "wexpay" && license.status === "ACTIVE"),
  ).length;
  const withSubscription = organizations.filter((org) => org.subscriptions.length > 0).length;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        badge="Müşteriler"
        title="Müşteri operasyon merkezi"
        description="Organizasyon kartlarından lisans, ürün ve kullanıcı özetine hızlı erişim."
        actions={
          <>
            <Link
              href="/admin/licenses"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Lisanslar
            </Link>
            <Link
              href="/admin/billing"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Faturalar
            </Link>
            <Link
              href="/admin/support"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Destek
            </Link>
          </>
        }
      />

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <AdminStatGrid>
        <AdminSummaryCard label="Toplam müşteri" value={organizations.length} helper="Tüm organizasyonlar" />
        <AdminSummaryCard label="Aktif" value={activeCount} helper="Aktif organizasyonlar" tone="success" />
        <AdminSummaryCard label="Pasif" value={organizations.length - activeCount} helper="Pasife alınanlar" />
        <AdminSummaryCard label="Demo" value={demoCount} helper="isDemo işaretli" />
        <AdminSummaryCard label="WexPay kullanan" value={wexPayCount} helper="Aktif WexPay lisansı" />
        <AdminSummaryCard label="Aboneliği olan" value={withSubscription} helper="Subscription kaydı bulunan" />
      </AdminStatGrid>

      <AdminFormPanel
        title="Hızlı müşteri oluştur"
        description="Temel kayıt oluşturur; WexPay erişimi müşteri detayından açılır."
        collapsible
        defaultOpen={organizations.length === 0}
      >
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

      <AdminPanel>
        <form method="get" className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">Ara</span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Ad, e-posta veya slug"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">Durum</span>
            <select name="status" defaultValue={status ?? "all"} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold">
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="demo">Demo</option>
              <option value="real">Gerçek</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-black text-white hover:bg-emerald-700">
              Filtrele
            </button>
            {q || (status && status !== "all") ? (
              <Link href="/admin/customers" className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700">
                Temizle
              </Link>
            ) : null}
          </div>
        </form>

        <div className="mb-4">
          <AdminResultCount
            shown={filtered.length}
            total={organizations.length}
            filtered={Boolean(q || (status && status !== "all"))}
          />
        </div>

        {organizations.length === 0 ? (
          <AdminEmptyState description="Yeni müşteri oluşturarak başlayın.">Henüz müşteri kaydı bulunmuyor.</AdminEmptyState>
        ) : filtered.length === 0 ? (
          <AdminEmptyState description="Filtreleri temizleyerek tekrar deneyin.">Seçili filtrelerle eşleşen kayıt yok.</AdminEmptyState>
        ) : (
          <AdminTableShell>
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="min-w-[180px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Müşteri
                  </th>
                  <th scope="col" className="min-w-[180px] font-black uppercase tracking-[0.12em] text-slate-500">
                    İletişim
                  </th>
                  <th scope="col" className="min-w-[140px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Plan
                  </th>
                  <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                    Ürünler
                  </th>
                  <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                    Kullanıcı
                  </th>
                  <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                    Durum
                  </th>
                  <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                    Oluşturma
                  </th>
                  <th scope="col" className="sticky right-0 bg-slate-50/95 font-black uppercase tracking-[0.12em] text-slate-500">
                    Aksiyon
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((organization) => {
                  const license =
                    organization.licenses.find((item) => item.product.key === "wexpay") ?? organization.licenses[0];
                  const deactivate = deactivateAdminOrganizationAction.bind(null, organization.id);
                  const reactivate = reactivateAdminOrganizationAction.bind(null, organization.id);
                  const products = Array.from(new Set(organization.licenses.map((item) => item.product.name))).join(", ");
                  return (
                    <tr key={organization.id}>
                      <td>
                        <p className="font-black text-slate-950">{organization.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{organization.slug}</p>
                        {organization.isDemo ? (
                          <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Demo
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <p className="line-clamp-2 break-all text-sm font-semibold text-slate-700">{organization.email ?? "—"}</p>
                        <p className="text-xs font-semibold text-slate-500">{organization.phone ?? "—"}</p>
                      </td>
                      <td className="font-semibold text-slate-700">
                        {license ? displayPlanName(license.plan.name) : "—"}
                        {license ? (
                          <span className="mt-1 block text-xs text-slate-500">{formatAdminStatus(license.status)}</span>
                        ) : null}
                      </td>
                      <td className="max-w-[160px] truncate text-sm font-semibold text-slate-600" title={products || undefined}>
                        {products || "—"}
                      </td>
                      <td className="font-semibold text-slate-700">{organization.memberships.length}</td>
                      <td>
                        <AdminStatusPill active={organization.isActive}>{organization.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>
                      </td>
                      <td className="whitespace-nowrap text-xs font-semibold text-slate-500">
                        {formatAdminDate(organization.createdAt)}
                      </td>
                      <td className="sticky right-0 bg-white">
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/admin/organizations/${organization.id}`}
                            className="inline-flex rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
                          >
                            Yönet
                          </Link>
                          {organization.isActive ? (
                            <form action={deactivate}>
                              <input type="hidden" name="returnTo" value="/admin/customers" />
                              <button type="submit" className="text-xs font-bold text-amber-800 hover:underline">
                                Pasifleştir
                              </button>
                            </form>
                          ) : (
                            <form action={reactivate}>
                              <input type="hidden" name="returnTo" value="/admin/customers" />
                              <button type="submit" className="text-xs font-bold text-emerald-800 hover:underline">
                                Aktifleştir
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableShell>
        )}
      </AdminPanel>
    </div>
  );
}
