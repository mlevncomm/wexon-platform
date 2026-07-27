import Link from "next/link";
import {
  AdminEmptyState,
  AdminPanel,
  AdminResponsiveRows,
  AdminSectionTitle,
  AdminStatusBadge,
  AdminSummaryCard,
  AdminTableShell,
  AdminTableToolbar,
} from "@/components/marketing/WexonAdminCards";
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
import { AdminSelectField, ADMIN_FIELD_CONTROL_COMPACT } from "@/components/marketing/WexonAdminForms";

function levelTone(level: string, status: string) {
  if (level === "ERROR" || status === "FAILURE") return "failed" as const;
  if (level === "WARN") return "pending" as const;
  return "inactive" as const;
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
          <AdminSelectField
            label="Müşteri"
            name="organizationId"
            defaultValue={filters.organizationId ?? ""}
            options={[
              { value: "", label: "Tüm müşteriler" },
              ...data.organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
              })),
            ]}
          />

          <AdminSelectField
            label="Seviye"
            name="level"
            defaultValue={filters.level ?? ""}
            options={[
              { value: "", label: "Tümü" },
              { value: "ERROR", label: "Hata" },
              { value: "WARN", label: "Uyarı" },
              { value: "INFO", label: "Bilgi" },
            ]}
          />

          <AdminSelectField
            label="Durum"
            name="status"
            defaultValue={filters.status ?? ""}
            options={[
              { value: "", label: "Tümü" },
              { value: "FAILURE", label: "Başarısız" },
              { value: "SUCCESS", label: "Başarılı" },
            ]}
          />

          <label className="grid gap-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">Ara</span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Olay, e-posta, mesaj…"
              className={ADMIN_FIELD_CONTROL_COMPACT}
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
          <AdminTableShell
            toolbar={<AdminTableToolbar title="Audit kayıtları" description={`${data.logs.length} kayıt bu sayfada`} />}
            mobile={
              <AdminResponsiveRows
                rows={data.logs.map((log) => {
                  const metadata = formatMetadata(log.metadataJson);
                  return {
                    key: log.id,
                    primary: (
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{getAuditActionLabel(log.action)}</p>
                        {log.message ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{log.message}</p>
                        ) : null}
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {log.organization?.name ?? "Sistem"}
                          {log.user?.email ? ` · ${log.user.email}` : ""}
                          {" · "}
                          {formatAdminDateTime(log.createdAt)}
                        </p>
                      </div>
                    ),
                    meta: (
                      <div className="flex flex-col items-end gap-1.5">
                        <AdminStatusBadge tone={levelTone(log.level, log.status)}>
                          {getAuditLevelLabel(log.level)}
                        </AdminStatusBadge>
                        <span className="text-[11px] font-medium text-slate-400">{getAuditStatusLabel(log.status)}</span>
                      </div>
                    ),
                    actions: (
                      <details className="group w-full">
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
                    ),
                  };
                })}
              />
            }
          >
            <table className="w-full table-fixed text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="w-[12%]">Seviye</th>
                  <th className="w-[28%]">Olay</th>
                  <th className="hidden w-[14%] xl:table-cell">Müşteri</th>
                  <th className="hidden w-[16%] 2xl:table-cell">Kullanıcı</th>
                  <th className="hidden w-[10%] 2xl:table-cell">Kaynak</th>
                  <th className="hidden w-[14%] xl:table-cell">Zaman</th>
                  <th className="w-[140px]">Detay</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => {
                  const metadata = formatMetadata(log.metadataJson);
                  const source = readAuditMetadataSource(log.metadataJson);
                  return (
                    <tr key={log.id} className="align-top">
                      <td className="min-w-0">
                        <div className="flex flex-col gap-1.5">
                          <AdminStatusBadge tone={levelTone(log.level, log.status)}>
                            {getAuditLevelLabel(log.level)}
                          </AdminStatusBadge>
                          <span className="text-[11px] font-medium text-slate-400">{getAuditStatusLabel(log.status)}</span>
                        </div>
                      </td>
                      <td className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{getAuditActionLabel(log.action)}</p>
                        {log.message ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{log.message}</p>
                        ) : null}
                        <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{log.action}</p>
                        <p className="mt-1 truncate text-xs text-slate-400 xl:hidden">
                          {log.organization?.name ?? "Sistem"}
                          {" · "}
                          {formatAdminDateTime(log.createdAt)}
                        </p>
                      </td>
                      <td className="hidden min-w-0 truncate text-slate-600 xl:table-cell">
                        {log.organization?.name ?? "Sistem"}
                      </td>
                      <td className="hidden min-w-0 truncate text-slate-600 2xl:table-cell">
                        {log.user?.email ?? "-"}
                      </td>
                      <td className="hidden min-w-0 truncate text-slate-500 2xl:table-cell">{source ?? "-"}</td>
                      <td className="hidden min-w-0 truncate text-slate-600 xl:table-cell">
                        {formatAdminDateTime(log.createdAt)}
                      </td>
                      <td className="min-w-0">
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
