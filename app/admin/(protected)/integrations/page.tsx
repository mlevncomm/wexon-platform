import { cookies } from "next/headers";
import { AdminEmptyState, AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminFormPanel, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
import { AdminInlineToggleForm, AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { createAdminApiKeyAction, createAdminWebhookAction, revokeAdminApiKeyAction, toggleAdminWebhookAction } from "@/lib/wexon-admin-actions";
import { getAdminIntegrationsData, getAdminOperationOptions } from "@/lib/wexon-admin";

async function readApiKeyFlash() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("wexon_admin_api_key_flash")?.value;
    if (!raw) return null;
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { name: string; prefix: string; rawKey: string };
  } catch {
    return null;
  }
}

export default async function AdminIntegrationsPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [{ apiKeys, webhookEndpoints }, options] = await Promise.all([getAdminIntegrationsData(), getAdminOperationOptions()]);
  const activeKeys = apiKeys.filter((key) => !key.revokedAt);
  const apiKeyFlash = await readApiKeyFlash();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Entegrasyonlar"
          title="API ve webhook operasyonları"
          description="Müşteri adına anahtar oluşturun, webhook tanımlayın ve erişimleri yönetin."
        />
        <AdminQuickLinks
          links={[
            { label: "Müşteriler", href: "/admin/organizations" },
            { label: "İşlem geçmişi", href: "/admin/audit-logs" },
            { label: "Destek", href: "/admin/support" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}
      {apiKeyFlash ? (
        <AdminActionNotice tone="warning">
          Yeni API anahtarı oluşturuldu — <strong>{apiKeyFlash.name}</strong> ({apiKeyFlash.prefix}…). Tam anahtar:{" "}
          <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-xs">{apiKeyFlash.rawKey}</code> (5 dk içinde kaybolur)
        </AdminActionNotice>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminSummaryCard label="Aktif API anahtarı" value={activeKeys.length} />
        <AdminSummaryCard label="Webhook" value={webhookEndpoints.length} />
        <AdminSummaryCard label="Aktif webhook" value={webhookEndpoints.filter((w) => w.isActive).length} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AdminFormPanel title="API anahtarı oluştur" description="Müşteri adına tam yetkili anahtar üretir." collapsible>
          <form action={createAdminApiKeyAction} className="grid gap-4">
            <input type="hidden" name="returnTo" value="/admin/integrations" />
            <AdminSelectField label="Müşteri" name="organizationId">
              <option value="">Seçin</option>
              {options.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField label="Ürün (opsiyonel)" name="productId" defaultValue="">
              <option value="">Genel</option>
              {options.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </AdminSelectField>
            <AdminTextField label="Anahtar adı" name="name" placeholder="Prod API" required />
            <AdminSubmitButton>API anahtarı oluştur</AdminSubmitButton>
          </form>
        </AdminFormPanel>

        <AdminFormPanel title="Webhook oluştur" description="HTTPS endpoint tanımlayın." collapsible>
          <form action={createAdminWebhookAction} className="grid gap-4">
            <input type="hidden" name="returnTo" value="/admin/integrations" />
            <AdminSelectField label="Müşteri" name="organizationId">
              <option value="">Seçin</option>
              {options.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField label="Ürün (opsiyonel)" name="productId" defaultValue="">
              <option value="">Genel</option>
              {options.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </AdminSelectField>
            <AdminTextField label="Webhook URL" name="url" placeholder="https://..." required />
            <input type="hidden" name="events" value="payment.updated" />
            <AdminSubmitButton>Webhook oluştur</AdminSubmitButton>
          </form>
        </AdminFormPanel>
      </section>

      <AdminPanel>
        <AdminSectionTitle badge="Sanal POS" title="Ödeme bağlantısı" />
        <AdminInfoRow label="Durum" value="Manuel tahsilat /admin/billing üzerinden yapılabilir. Sanal POS sağlayıcı ayarları bir sonraki fazda." />
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle badge="API Anahtarları" title="Kayıtlı anahtarlar" />
        {apiKeys.length === 0 ? (
          <AdminEmptyState>Henüz API anahtarı bulunmuyor.</AdminEmptyState>
        ) : (
          <AdminTableShell>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-bold">Ad</th>
                  <th className="px-5 py-4 font-bold">Müşteri</th>
                  <th className="px-5 py-4 font-bold">Ürün</th>
                  <th className="px-5 py-4 font-bold">Prefix</th>
                  <th className="px-5 py-4 font-bold">Durum</th>
                  <th className="px-5 py-4 font-bold">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apiKeys.map((apiKey) => (
                  <tr key={apiKey.id}>
                    <td className="px-5 py-4 font-semibold text-slate-950">{apiKey.name}</td>
                    <td className="px-5 py-4">
                      <AdminOrgLink id={apiKey.organizationId} name={apiKey.organization.name} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{apiKey.product?.name ?? "-"}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{apiKey.prefix}</td>
                    <td className="px-5 py-4">
                      <AdminStatusPill active={!apiKey.revokedAt}>{apiKey.revokedAt ? "İptal" : "Aktif"}</AdminStatusPill>
                    </td>
                    <td className="px-5 py-4">
                      {apiKey.revokedAt ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <form action={revokeAdminApiKeyAction.bind(null, apiKey.id)}>
                          <input type="hidden" name="returnTo" value="/admin/integrations" />
                          <button type="submit" className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100">
                            İptal et
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
        )}
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle badge="Webhook" title="Endpoint kayıtları" />
        {webhookEndpoints.length === 0 ? (
          <AdminEmptyState>Henüz webhook endpoint kaydı bulunmuyor.</AdminEmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {webhookEndpoints.map((endpoint) => (
              <div key={endpoint.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 break-all text-sm font-bold text-slate-950">{endpoint.url}</p>
                  <AdminStatusPill active={endpoint.isActive}>{endpoint.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  <AdminOrgLink id={endpoint.organizationId} name={endpoint.organization.name} /> · {endpoint.product?.name ?? "Genel"}
                </p>
                <div className="mt-3">
                  <AdminInlineToggleForm
                    action={toggleAdminWebhookAction.bind(null, endpoint.id)}
                    returnTo="/admin/integrations"
                    isActive={endpoint.isActive}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
