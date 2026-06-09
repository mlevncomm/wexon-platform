import Link from "next/link";
import { InfoRow, WexPayPanel, WexPayPanelGrid } from "@/components/wexpay/WexPayBusinessUI";
import { getWexPayAccess } from "@/lib/wexpay-auth";
import { getEntitlementUsage } from "@/lib/wexpay-read";
import { coreEntitlementNumber } from "@/lib/wexon-core-access";
import { formatCoreStatus } from "@/lib/wexon-core-dashboard";
import { dashboardPreviewHref } from "@/lib/wexon-organization-context";

export default async function WexPaySettingsPage() {
  const access = await getWexPayAccess();
  if (!access.allowed) return null;

  const usage = await getEntitlementUsage(access.organization.id, access.entitlementMap);

  return (
    <WexPayPanelGrid className="xl:grid-cols-2">
      <WexPayPanel
        eyebrow="Aktif paket"
        title={access.license.plan.name}
        headerAction={
          <span className="rounded-full border border-emerald-300/30 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-100">
            {formatCoreStatus(access.license.status)}
          </span>
        }
      >
        <div className="grid min-w-0 gap-3">
          <InfoRow label="Organizasyon" value={access.organization.name} />
          <InfoRow label="Paket" value={access.license.plan.name} />
          <InfoRow label="Lisans durumu" value={formatCoreStatus(access.license.status)} />
          <InfoRow label="Kurulum durumu" value={formatCoreStatus(access.installation.status)} />
          <InfoRow
            label="Kullanıcı rolü"
            value={access.mode === "admin_preview" ? "Admin önizleme" : formatCoreStatus(access.membership?.role ?? "VIEWER")}
          />
          <InfoRow label="Yönetim yetkisi" value={access.canManage ? "Var" : "Yok"} />
        </div>
      </WexPayPanel>

      <WexPayPanel eyebrow="Ayarlar" title="Kullanım limitleri">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {usage.map((row) => {
            const limit = coreEntitlementNumber(access.entitlementMap, row.key);
            const limitLabel = limit === null ? "Sınırsız" : String(limit);
            return <InfoRow key={row.key} label={row.label} value={`${row.used} / ${limitLabel}`} />;
          })}
        </div>
      </WexPayPanel>

      <WexPayPanel eyebrow="Ayarlar" title="Paket açıklaması" className="xl:col-span-2">
        <p className="max-w-4xl text-sm font-medium leading-relaxed text-slate-600">
          QR menü ve temel operasyon tüm WexPay paketlerinde bulunur. Limitler, raporlama, yetki, destek ve
          entegrasyon seviyesi Wexon Core entitlement kararından gelir. BillingPayment (Core faturalandırması) ile
          operasyonel WexPay Payment kayıtları ayrı tutulur.
        </p>
      </WexPayPanel>

      <WexPayPanel
        eyebrow="Ayarlar"
        title="Lisans işlemleri"
        description="Lisans ve abonelik yönetimi Wexon Core panelinden yapılır."
        className="xl:col-span-2"
        headerAction={
          <Link
            href={dashboardPreviewHref(access.organization.id)}
            className="inline-flex rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            Wexon Core paneli
          </Link>
        }
      />
    </WexPayPanelGrid>
  );
}
