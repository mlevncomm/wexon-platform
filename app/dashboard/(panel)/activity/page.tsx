import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardPanel,
  DashboardSectionTitle,
  DashboardTableShell,
} from "@/components/marketing/WexonDashboardCards";
import { getCustomerDashboardData } from "@/lib/wexon-core-dashboard";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

const ACTIVITY_LABELS: Record<string, string> = {
  "customer.support_ticket.created": "Destek talebi oluşturuldu",
  "customer.organization.updated": "Organizasyon güncellendi",
  "customer.membership.created": "Kullanıcı eklendi",
  "customer.membership.updated": "Kullanıcı güncellendi",
  "customer.membership.deactivated": "Kullanıcı pasife alındı",
  "customer.membership.reactivated": "Kullanıcı yeniden aktifleştirildi",
  "customer.api_key.created": "API anahtarı oluşturuldu",
  "customer.api_key.deactivated": "API anahtarı pasife alındı",
  "customer.webhook.created": "Webhook eklendi",
  "customer.webhook.deactivated": "Webhook pasife alındı",
  "license.updated": "Lisans güncellendi",
  "subscription.updated": "Abonelik güncellendi",
};

function humanActivityLabel(action: string) {
  if (ACTIVITY_LABELS[action]) return ACTIVITY_LABELS[action];
  return action
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" · ");
}

function summarizeMetadata(metadataJson: unknown): string | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const meta = metadataJson as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["subject", "status", "role", "name", "category", "priority"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) {
      parts.push(`${key}: ${value}`);
    }
  }
  // Never surface secrets / raw keys / tokens
  void meta.key;
  void meta.rawKey;
  void meta.secret;
  void meta.token;
  void meta.password;
  return parts.length > 0 ? parts.join(" · ") : null;
}

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
    <div className="space-y-6 sm:space-y-8">
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
          <DashboardTableShell>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="font-black">Olay</th>
                  <th className="font-black">Özet</th>
                  <th className="font-black">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organization.auditLogs.map((log) => {
                  const summary = summarizeMetadata(log.metadataJson);
                  return (
                    <tr key={log.id}>
                      <td className="font-bold text-slate-950">{humanActivityLabel(log.action)}</td>
                      <td className="font-semibold text-slate-600">{summary ?? "—"}</td>
                      <td className="whitespace-nowrap font-semibold text-slate-600">
                        {log.createdAt.toLocaleString("tr-TR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DashboardTableShell>
        )}
      </DashboardPanel>
    </div>
  );
}
