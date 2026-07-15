import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatGrid,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import { AdminSoftNotice } from "@/components/marketing/WexonAdminContent";
import { buildWexPayPlanMigrationReport, type WexPayMigrationStatus } from "@/lib/wexpay-plan-migration";

function migrationStatusLabel(status: WexPayMigrationStatus) {
  switch (status) {
    case "migrated":
      return "Geçiş tamam";
    case "approved":
      return "Onaylandı";
    case "skipped":
      return "Atlandı";
    default:
      return "İncelenmedi";
  }
}

export default async function AdminWexPayMigrationPage() {
  const rows = await buildWexPayPlanMigrationReport();
  const needsReview = rows.filter((row) => row.migrationStatus === "not_reviewed");
  const atRiskCount = rows.filter((row) => row.capabilitiesAtRisk.length > 0).length;
  const byTier = {
    essential: rows.filter((row) => row.suggestedTier === "essential").length,
    growth: rows.filter((row) => row.suggestedTier === "growth").length,
    scale: rows.filter((row) => row.suggestedTier === "scale").length,
    business_suite: rows.filter((row) => row.suggestedTier === "business_suite").length,
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        badge="Geçiş önizlemesi"
        title="WexPay plan geçiş raporu"
        description="Salt okunur önizleme. Lisans veya abonelik kayıtları değiştirilmez."
        actions={
          <Link
            href="/admin/plans"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Paket yönetimine dön
          </Link>
        }
      />

      <AdminSoftNotice>Bu ekran yalnızca önizlemedir. Toplu geçiş veya entitlement değişikliği uygulanmaz.</AdminSoftNotice>

      <AdminStatGrid>
        <AdminSummaryCard label="Legacy / aktif lisans" value={rows.length} helper="Rapora dahil kayıtlar" />
        <AdminSummaryCard label="Önerilen Essential" value={byTier.essential} helper="suggestedTier" />
        <AdminSummaryCard label="Önerilen Growth" value={byTier.growth} helper="suggestedTier" />
        <AdminSummaryCard label="Önerilen Scale" value={byTier.scale} helper="suggestedTier" />
        <AdminSummaryCard label="Önerilen Business Suite" value={byTier.business_suite} helper="suggestedTier" />
        <AdminSummaryCard
          label="Manuel inceleme"
          value={needsReview.length}
          helper="Henüz incelenmemiş"
          tone="warning"
        />
        <AdminSummaryCard
          label="Capability kaybı riski"
          value={atRiskCount}
          helper="Grandfathering gerekebilir"
          tone={atRiskCount ? "danger" : "default"}
        />
      </AdminStatGrid>

      {rows.length === 0 ? (
        <AdminEmptyState>Aktif WexPay lisansı bulunamadı.</AdminEmptyState>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                  Organizasyon
                </th>
                <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                  Mevcut plan
                </th>
                <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                  Önerilen
                </th>
                <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                  Gerekçe
                </th>
                <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                  Risk
                </th>
                <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                  Durum
                </th>
                <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                  Aksiyon
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.licenseId}>
                  <td>
                    <p className="font-black text-slate-950">{row.organizationName}</p>
                    <p className="text-xs font-semibold text-slate-500">{row.isActive ? "Org aktif" : "Org pasif"}</p>
                  </td>
                  <td className="font-semibold text-slate-700">{row.currentPlanName ?? row.currentPlanKey ?? "—"}</td>
                  <td className="font-semibold text-slate-700">{row.suggestedTier}</td>
                  <td className="max-w-[220px] text-xs font-semibold text-slate-600">
                    <span className="line-clamp-3" title={row.reason}>
                      {row.reason}
                    </span>
                  </td>
                  <td className="max-w-[180px] text-xs font-semibold text-slate-600">
                    {row.capabilitiesAtRisk.length > 0 ? row.capabilitiesAtRisk.join(", ") : "—"}
                  </td>
                  <td>
                    <AdminStatusPill active={row.migrationStatus === "migrated"}>
                      {migrationStatusLabel(row.migrationStatus)}
                    </AdminStatusPill>
                  </td>
                  <td>
                    <Link
                      href={`/admin/organizations/${row.organizationId}`}
                      className="text-xs font-black text-emerald-700 hover:underline"
                    >
                      Müşteri detayı
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </div>
  );
}
