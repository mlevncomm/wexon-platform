import { cookies } from "next/headers";
import {
  AdminEmptyState,
  AdminInfoRow,
  AdminPanel,
  AdminResponsiveRows,
  AdminSectionTitle,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminActionMenu,
  AdminActionMenuSection,
  AdminButton,
  AdminFormPanel,
  AdminSelectField,
  AdminSubmitButton,
  AdminTextField,
} from "@/components/marketing/WexonAdminForms";
import { AdminInlineToggleForm, AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { createAdminApiKeyAction, createAdminWebhookAction, revokeAdminApiKeyAction, toggleAdminWebhookAction } from "@/lib/wexon-admin-actions";
import { getAdminIntegrationsData, getAdminOperationOptions } from "@/lib/wexon-admin";
import { generateAdminMutationKey } from "@/lib/wexon-admin-mutation-idempotency";

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

function ApiKeyActionsMenu({ apiKeyId }: { apiKeyId: string }) {
  return (
    <AdminActionMenu label="İşlem" ariaLabel="API anahtarı işlemleri">
      <AdminActionMenuSection title="Güvenlik">
        <form action={revokeAdminApiKeyAction.bind(null, apiKeyId)}>
          <input type="hidden" name="returnTo" value="/admin/integrations" />
          <AdminButton type="submit" variant="danger" className="w-full">
            Anahtarı iptal et
          </AdminButton>
        </form>
      </AdminActionMenuSection>
    </AdminActionMenu>
  );
}

export default async function AdminIntegrationsPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [{ apiKeys, webhookEndpoints }, options] = await Promise.all([getAdminIntegrationsData(), getAdminOperationOptions()]);
  const activeKeys = apiKeys.filter((key) => !key.revokedAt);
  const apiKeyFlash = await readApiKeyFlash();
  const apiKeyMutationId = generateAdminMutationKey();
  const webhookMutationId = generateAdminMutationKey();

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
            <input type="hidden" name="mutationId" value={apiKeyMutationId} />
            <AdminSelectField
              label="Müşteri"
              name="organizationId"
              options={[
                { value: "", label: "Seçin" },
                ...options.organizations.map((org) => ({ value: org.id, label: org.name })),
              ]}
            />
            <AdminSelectField
              label="Ürün (opsiyonel)"
              name="productId"
              defaultValue=""
              options={[
                { value: "", label: "Genel" },
                ...options.products.map((product) => ({ value: product.id, label: product.name })),
              ]}
            />
            <AdminTextField label="Anahtar adı" name="name" placeholder="Prod API" required />
            <AdminSubmitButton>API anahtarı oluştur</AdminSubmitButton>
          </form>
        </AdminFormPanel>

        <AdminFormPanel title="Webhook oluştur" description="HTTPS endpoint tanımlayın." collapsible>
          <form action={createAdminWebhookAction} className="grid gap-4">
            <input type="hidden" name="returnTo" value="/admin/integrations" />
            <input type="hidden" name="mutationId" value={webhookMutationId} />
            <AdminSelectField
              label="Müşteri"
              name="organizationId"
              options={[
                { value: "", label: "Seçin" },
                ...options.organizations.map((org) => ({ value: org.id, label: org.name })),
              ]}
            />
            <AdminSelectField
              label="Ürün (opsiyonel)"
              name="productId"
              defaultValue=""
              options={[
                { value: "", label: "Genel" },
                ...options.products.map((product) => ({ value: product.id, label: product.name })),
              ]}
            />
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
          <AdminTableShell
            mobile={
              <AdminResponsiveRows
                rows={apiKeys.map((apiKey) => ({
                  key: apiKey.id,
                  primary: (
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{apiKey.name}</p>
                      <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                        <AdminOrgLink id={apiKey.organizationId} name={apiKey.organization.name} />
                      </div>
                    </div>
                  ),
                  secondary: (
                    <span className="truncate">
                      {apiKey.product?.name ?? "Genel"}
                      {apiKey.prefix ? ` · ${apiKey.prefix}` : ""}
                    </span>
                  ),
                  meta: (
                    <AdminStatusPill tone={apiKey.revokedAt ? "failed" : "active"}>
                      {apiKey.revokedAt ? "İptal" : "Aktif"}
                    </AdminStatusPill>
                  ),
                  actions: apiKey.revokedAt ? undefined : <ApiKeyActionsMenu apiKeyId={apiKey.id} />,
                }))}
              />
            }
          >
            <table className="w-full table-fixed text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="w-[24%]">Ad</th>
                  <th className="w-[24%]">Müşteri</th>
                  <th className="hidden w-[16%] xl:table-cell">Ürün</th>
                  <th className="hidden w-[14%] 2xl:table-cell">Prefix</th>
                  <th className="w-[14%]">Durum</th>
                  <th className="w-[140px]">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((apiKey) => (
                  <tr key={apiKey.id}>
                    <td className="min-w-0 truncate font-semibold text-slate-950">{apiKey.name}</td>
                    <td className="min-w-0">
                      <div className="truncate">
                        <AdminOrgLink id={apiKey.organizationId} name={apiKey.organization.name} />
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500 xl:hidden">
                        {apiKey.product?.name ?? "Genel"}
                      </p>
                    </td>
                    <td className="hidden min-w-0 truncate text-slate-600 xl:table-cell">
                      {apiKey.product?.name ?? "-"}
                    </td>
                    <td className="hidden min-w-0 truncate font-mono text-xs text-slate-600 2xl:table-cell">
                      {apiKey.prefix}
                    </td>
                    <td className="min-w-0">
                      <AdminStatusPill tone={apiKey.revokedAt ? "failed" : "active"}>
                        {apiKey.revokedAt ? "İptal" : "Aktif"}
                      </AdminStatusPill>
                    </td>
                    <td className="min-w-0">
                      {apiKey.revokedAt ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <ApiKeyActionsMenu apiKeyId={apiKey.id} />
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
              <div key={endpoint.id} className="rounded-[12px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 break-all text-sm font-bold text-slate-950">{endpoint.url}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusPill active={endpoint.isActive}>{endpoint.isActive ? "Aktif" : "Pasif"}</AdminStatusPill>
                    <AdminActionMenu label="İşlem" ariaLabel="Webhook işlemleri">
                      <AdminActionMenuSection title="Endpoint durumu">
                        <AdminInlineToggleForm
                          action={toggleAdminWebhookAction.bind(null, endpoint.id)}
                          returnTo="/admin/integrations"
                          isActive={endpoint.isActive}
                        />
                      </AdminActionMenuSection>
                    </AdminActionMenu>
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  <AdminOrgLink id={endpoint.organizationId} name={endpoint.organization.name} /> · {endpoint.product?.name ?? "Genel"}
                </p>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
