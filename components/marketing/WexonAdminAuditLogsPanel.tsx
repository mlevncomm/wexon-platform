import Link from "next/link";
import { AdminEmptyState, AdminPanel, AdminSectionTitle, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import {
  formatAdminDateTime,
  getAdminAuditLogsData,
  type AdminAuditLogFilters,
} from "@/lib/wexon-admin";
import {
  getAuditActionLabel,
  getAuditLevelLabel,
  getAuditStatusLabel,
  readAuditMetadataSource,
} from "@/lib/wexon-audit-labels";

function levelTone(level: string, status: string) {
  if (level === "ERROR" || status === "FAILURE") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (level === "WARN") return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-slate-100 text-slate-600 ring-slate-200/80";
}

function buildPageHref(filters: AdminAuditLogFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.organizationId) params.set("organizationId", filters.organizationId);
  if (filters.level) params.set("level", filters.level);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/audit-logs?${query}` : "/admin/audit-logs";
}

function formatMetadata(metadata: unknown) {
  if (metadata === null || metadata === undefined) return null;
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

export default async function WexonAdminAuditLogsPanel({
  filters,
}: {
  filters: AdminAuditLogFilters;
}) {
  const data = await getAdminAuditLogsData(filters);

  return (
    <div>
      <AdminSectionTitle
        badge="Sistem Logları"
        title="İşlem geçmişi ve hata kayıtları"
        description="Tüm müşterilerin panel, API ve sistem olaylarını tek yerden izleyin. Başarısız girişler, erişim reddleri ve işlem hataları dahil."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <AdminSummaryCard label="Başarısız kayıt" value={data.stats.failureCount} helper="Erişim, doğrulama ve sistem hataları" />
        <AdminSummaryCard label="Uyarı" value={data.stats.warnCount} helper="Dikkat gerektiren olaylar" />
        <AdminSummaryCard label="Kritik hata" value={data.stats.errorCount} helper="Beklenmeyen veya ciddi hatalar" />
      </div>

      <AdminPanel className="mb-6">
        <form method="get" className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_auto] lg:items-end">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">Müşteri</span>
            <select
              name="organizationId"
              defaultValue={filters.organizationId ?? ""}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-300"
            >
              <option value="">Tüm müşteriler</option>
              {data.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">Seviye</span>
            <select
              name="level"
              defaultValue={filters.level ?? ""}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-300"
            >
              <option value="">Tümü</option>
              <option value="ERROR">Hata</option>
              <option value="WARN">Uyarı</option>
              <option value="INFO">Bilgi</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">Durum</span>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-300"
            >
              <option value="">Tümü</option>
              <option value="FAILURE">Başarısız</option>
              <option value="SUCCESS">Başarılı</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">Ara</span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Olay, e-posta, mesaj…"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-300"
            />
          </label>

          <button
            type="submit"
            className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Filtrele
          </button>
        </form>
      </AdminPanel>

      {data.logs.length === 0 ? (
        <AdminEmptyState>Filtrelere uygun log kaydı bulunamadı.</AdminEmptyState>
      ) : (
        <>
          <AdminTableShell>
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-bold">Seviye</th>
                  <th className="px-5 py-4 font-bold">Olay</th>
                  <th className="px-5 py-4 font-bold">Müşteri</th>
                  <th className="px-5 py-4 font-bold">Kullanıcı</th>
                  <th className="px-5 py-4 font-bold">Kaynak</th>
                  <th className="px-5 py-4 font-bold">Zaman</th>
                  <th className="px-5 py-4 font-bold">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.logs.map((log) => {
                  const metadata = formatMetadata(log.metadataJson);
                  const source = readAuditMetadataSource(log.metadataJson);
                  return (
                    <tr key={log.id} className="align-top">
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${levelTone(log.level, log.status)}`}>
                            {getAuditLevelLabel(log.level)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">{getAuditStatusLabel(log.status)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950">{getAuditActionLabel(log.action)}</p>
                        {log.message ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{log.message}</p> : null}
                        <p className="mt-1 font-mono text-[10px] text-slate-400">{log.action}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{log.organization?.name ?? "Sistem"}</td>
                      <td className="px-5 py-4 text-slate-600">{log.user?.email ?? "-"}</td>
                      <td className="px-5 py-4 text-slate-500">{source ?? "-"}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-600">{formatAdminDateTime(log.createdAt)}</td>
                      <td className="px-5 py-4">
                        <details className="group">
                          <summary className="cursor-pointer list-none text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                            Görüntüle
                          </summary>
                          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                            {log.entityType ? (
                              <p>
                                <span className="font-semibold text-slate-500">Varlık:</span> {log.entityType}
                                {log.entityId ? ` · ${log.entityId}` : ""}
                              </p>
                            ) : null}
                            {log.ipAddress ? (
                              <p>
                                <span className="font-semibold text-slate-500">IP:</span> {log.ipAddress}
                              </p>
                            ) : null}
                            {metadata ? (
                              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">
                                {metadata}
                              </pre>
                            ) : (
                              <p className="text-slate-400">Ek metadata yok</p>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableShell>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <p>
              {data.total} kayıt · sayfa {data.page}/{data.pageCount}
            </p>
            <div className="flex items-center gap-2">
              {data.page > 1 ? (
                <Link
                  href={buildPageHref(filters, data.page - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Önceki
                </Link>
              ) : null}
              {data.page < data.pageCount ? (
                <Link
                  href={buildPageHref(filters, data.page + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sonraki
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
