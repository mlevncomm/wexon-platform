import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardPanel,
  DashboardSectionTitle,
} from "@/components/marketing/WexonDashboardCards";
import { getCustomerDashboardData } from "@/lib/wexon-core-dashboard";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

export default async function DashboardActivityPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const { organization } = await getCustomerDashboardData(params);

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bulunamadı."
        description="Bağlantıdaki organizasyon kaydı artık mevcut olmayabilir."
      />
    );
  }

  return (
    <div className="space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Aktiviteler"
        title="Son aktiviteler"
        description="Güvenlik, lisans, kullanıcı ve ürün erişimi işlemleri burada kayıt altına alınır."
      />
      <DashboardPanel>
        {organization.auditLogs.length === 0 ? (
          <DashboardEmptyState
            title="Henüz işlem geçmişi bulunmuyor."
            description="Güvenlik, lisans, kullanıcı ve ürün erişimi işlemleri burada kayıt altına alınır."
          />
        ) : (
          <div className="space-y-3">
            {organization.auditLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">{log.action}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{log.createdAt.toLocaleString("tr-TR")}</p>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
