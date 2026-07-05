import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardPanel,
  DashboardSectionTitle,
  DashboardStatusPill,
} from "@/components/marketing/WexonDashboardCards";
import { cookies } from "next/headers";
import {
  createCustomerApiKeyAction,
  createCustomerWebhookAction,
  deactivateCustomerApiKeyAction,
  deactivateCustomerWebhookAction,
} from "@/lib/wexon-customer-actions";
import { canManageOrganizationUsers, getCurrentCustomerUser } from "@/lib/wexon-customer-auth";
import { getCustomerDashboardData } from "@/lib/wexon-core-dashboard";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string; customerError?: string }>;
type ApiKeyFlash = {
  name: string;
  prefix: string;
  rawKey: string;
};

function parseApiKeyFlash(value: string | undefined): ApiKeyFlash | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      name?: unknown;
      prefix?: unknown;
      rawKey?: unknown;
    };

    if (typeof parsed.name !== "string" || typeof parsed.prefix !== "string" || typeof parsed.rawKey !== "string") {
      return null;
    }

    return {
      name: parsed.name,
      prefix: parsed.prefix,
      rawKey: parsed.rawKey,
    };
  } catch {
    return null;
  }
}

export default async function DashboardIntegrationsPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const newApiKey = parseApiKeyFlash(cookieStore.get("wexon_api_key_flash")?.value);
  const [{ organization }, currentUser] = await Promise.all([
    getCustomerDashboardData(params),
    getCurrentCustomerUser(),
  ]);

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bulunamadı."
        description="Bağlantıdaki organizasyon kaydı artık mevcut olmayabilir."
      />
    );
  }

  const currentMembership = currentUser?.memberships.find((membership) => membership.organizationId === organization.id);
  const canManage = currentMembership ? canManageOrganizationUsers(currentMembership.role) : false;

  return (
    <div className="space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Entegrasyonlar"
        title="API ve entegrasyonlar"
        description="API anahtarları ve webhook endpointlerini organizasyonunuza bağlı şekilde yönetin."
      />
      {params.customerError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {params.customerError}
        </div>
      )}
      {newApiKey && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <p className="text-sm font-black">Yeni API anahtarınız oluşturuldu.</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed">
            Bu anahtar düz metin olarak saklanmaz. Şimdi kaydedin; daha sonra yalnızca prefix görüntülenir.
          </p>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">{newApiKey.name} / {newApiKey.prefix}</p>
            <code className="mt-2 block break-all text-sm font-black text-slate-950">{newApiKey.rawKey}</code>
          </div>
        </div>
      )}

      <DashboardPanel>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950">API anahtarları</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Anahtarın tamamı düz metin olarak saklanmaz; yalnızca hash ve prefix tutulur.</p>
          </div>
          {!canManage && <DashboardStatusPill>Salt görüntüleme</DashboardStatusPill>}
        </div>
        {canManage && (
          <form action={createCustomerApiKeyAction} className="mb-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input type="hidden" name="organizationId" value={organization.id} />
            <input name="name" required placeholder="Örn. WexPay POS entegrasyonu" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-[#48e050]">API anahtarı oluştur</button>
          </form>
        )}
        {organization.apiKeys.length === 0 ? (
          <DashboardEmptyState title="Henüz API anahtarı yok." description="Oluşturulan API anahtarları burada listelenir." />
        ) : (
          <div className="space-y-3">
            {organization.apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-black text-slate-950">{apiKey.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Prefix: {apiKey.prefix}</p>
                </div>
                <div className="flex items-center gap-2">
                  <DashboardStatusPill active={!apiKey.revokedAt}>{apiKey.revokedAt ? "Pasif" : "Aktif"}</DashboardStatusPill>
                  {canManage && !apiKey.revokedAt && (
                    <form action={deactivateCustomerApiKeyAction}>
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <input type="hidden" name="recordId" value={apiKey.id} />
                      <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Pasife al</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel>
        <div className="mb-5">
          <h2 className="text-xl font-black tracking-tight text-slate-950">Webhook endpointleri</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">WexPay ve Core olaylarını kendi sistemlerinize bildirmek için HTTPS endpoint tanımlayın.</p>
        </div>
        {canManage && (
          <form action={createCustomerWebhookAction} className="mb-6 grid gap-3">
            <input type="hidden" name="organizationId" value={organization.id} />
            <input name="url" type="url" required placeholder="https://example.com/webhooks/wexon" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {["payment.updated", "order.created", "license.updated"].map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" name="events" value={event} defaultChecked={event === "payment.updated"} />
                  {event}
                </label>
              ))}
            </div>
            <button type="submit" className="w-fit rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-[#48e050]">Webhook ekle</button>
          </form>
        )}
        {organization.webhookEndpoints.length === 0 ? (
          <DashboardEmptyState title="Henüz webhook endpoint yok." description="Tanımlanan webhook endpointleri burada listelenir." />
        ) : (
          <div className="space-y-3">
            {organization.webhookEndpoints.map((webhook) => (
              <div key={webhook.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="min-w-0">
                  <p className="break-all text-sm font-black text-slate-950">{webhook.url}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{webhook.events.join(", ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <DashboardStatusPill active={webhook.isActive}>{webhook.isActive ? "Aktif" : "Pasif"}</DashboardStatusPill>
                  {canManage && webhook.isActive && (
                    <form action={deactivateCustomerWebhookAction}>
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <input type="hidden" name="recordId" value={webhook.id} />
                      <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Pasife al</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
