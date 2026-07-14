import Link from "next/link";
import {
  AdminInfoRow,
  AdminPanel,
  AdminSectionTitle,
  AdminStatusPill,
  AdminSummaryCard,
} from "@/components/marketing/WexonAdminCards";
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

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleDateString("tr-TR");
}

export default async function AdminWexPayMigrationPage() {
  const rows = await buildWexPayPlanMigrationReport();
  const needsReview = rows.filter((row) => row.migrationStatus === "not_reviewed");
  const atRiskCount = rows.filter((row) => row.capabilitiesAtRisk.length > 0).length;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Geçiş önizlemesi"
          title="WexPay plan geçiş raporu"
          description="Salt okunur önizleme. Lisans veya abonelik kayıtları değiştirilmez; üretimde otomatik remap yapılmaz."
        />
        <Link
          href="/admin/plans"
          className="inline-flex text-sm font-bold text-emerald-700 hover:underline"
        >
          ← Paket yönetimine dön
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <AdminSummaryCard label="Aktif lisans" value={rows.length} />
        <AdminSummaryCard label="İncelenmeli" value={needsReview.length} />
        <AdminSummaryCard label="Zaten uyumlu" value={rows.filter((row) => row.migrationStatus === "migrated").length} />
        <AdminSummaryCard label="Yetenek riski" value={atRiskCount} helper="Grandfathering gerekebilir" />
      </section>

      <div className="grid gap-5">
        {rows.length === 0 ? (
          <AdminPanel>
            <p className="text-sm font-semibold text-slate-600">Aktif WexPay lisansı bulunamadı.</p>
          </AdminPanel>
        ) : (
          rows.map((row) => (
            <AdminPanel key={row.licenseId}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{row.organizationName}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {row.currentPlanName ?? row.currentPlanKey ?? "-"} → {row.suggestedTier}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AdminStatusPill active={row.migrationStatus === "migrated"}>
                    {migrationStatusLabel(row.migrationStatus)}
                  </AdminStatusPill>
                  <AdminStatusPill active={row.isActive}>{row.isActive ? "Org aktif" : "Org pasif"}</AdminStatusPill>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AdminInfoRow label="Mevcut plan" value={row.currentPlanKey ?? "-"} />
                <AdminInfoRow label="Önerilen kademe" value={row.suggestedTier} />
                <AdminInfoRow label="Lisans durumu" value={row.licenseStatus} />
                <AdminInfoRow label="Geçiş nedeni" value={row.reason} />
                <AdminInfoRow
                  label="Abonelik"
                  value={row.subscription ? `${row.subscription.status} · ${row.subscription.interval}` : "Yok"}
                />
                <AdminInfoRow
                  label="Dönem bitişi"
                  value={formatDate(row.subscription?.currentPeriodEnd ?? null)}
                />
                <AdminInfoRow
                  label="Risk altındaki özellikler"
                  value={row.capabilitiesAtRisk.length ? row.capabilitiesAtRisk.join(", ") : "Yok"}
                />
              </div>

              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-950">
                {row.grandfatheringRecommendation}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/admin/organizations/${row.organizationId}`}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  Müşteri detayı
                </Link>
                {row.isDemo ? (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    Demo
                  </span>
                ) : null}
              </div>
            </AdminPanel>
          ))
        )}
      </div>
    </div>
  );
}
