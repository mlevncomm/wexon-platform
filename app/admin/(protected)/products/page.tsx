import { AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminFormPanel, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
import { AdminInlineSelectForm, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { createAdminProductAction, updateAdminProductAction, updateAdminProductStatusAction } from "@/lib/wexon-admin-actions";
import { formatAdminStatus, getAdminProductsData } from "@/lib/wexon-admin";

const productStatusOptions = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "UPCOMING", label: "Yakında" },
  { value: "INTERNAL", label: "İç kullanım" },
  { value: "DISABLED", label: "Pasif" },
];

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const products = await getAdminProductsData();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Ürünler"
          title="Ürün kataloğu yönetimi"
          description="Yeni ürün ekleyin, açıklamaları düzenleyin ve durumlarını kontrol edin."
        />
        <AdminQuickLinks
          links={[
            { label: "Paketler", href: "/admin/plans" },
            { label: "Lisanslar", href: "/admin/licenses" },
            { label: "Abonelikler", href: "/admin/subscriptions" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminSummaryCard label="Toplam ürün" value={products.length} />
        <AdminSummaryCard label="Aktif ürün" value={products.filter((p) => p.status === "ACTIVE").length} />
        <AdminSummaryCard label="Toplam kurulum" value={products.reduce((sum, p) => sum + p.appInstallations.length, 0)} />
      </section>

      <AdminFormPanel title="Yeni ürün ekle" description="Kataloga yeni Wexon ürünü tanımlayın." collapsible>
        <form action={createAdminProductAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="returnTo" value="/admin/products" />
          <AdminTextField label="Key" name="key" placeholder="wexpay" required />
          <AdminTextField label="Ürün adı" name="name" required />
          <AdminSelectField label="Durum" name="status" defaultValue="UPCOMING">
            {productStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </AdminSelectField>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminTextField label="Açıklama" name="description" />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Ürün oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {products.map((product) => {
          const updateProduct = updateAdminProductAction.bind(null, product.id);
          return (
            <AdminPanel key={product.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <AdminStatusPill active={product.status === "ACTIVE"}>{formatAdminStatus(product.status)}</AdminStatusPill>
                <AdminInlineSelectForm
                  action={updateAdminProductStatusAction.bind(null, product.id)}
                  returnTo="/admin/products"
                  fieldName="status"
                  value={product.status}
                  options={productStatusOptions}
                  submitLabel="Durum"
                />
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">{product.name}</h2>
              <p className="mt-3 min-h-12 text-sm leading-relaxed text-slate-600">{product.description ?? "Ürün açıklaması tanımlanmamış."}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <AdminInfoRow label="Key" value={product.key} />
                <AdminInfoRow label="Plan sayısı" value={product.plans.length} />
                <AdminInfoRow label="Lisans sayısı" value={product.licenses.length} />
                <AdminInfoRow label="Kurulum sayısı" value={product.appInstallations.length} />
              </div>
              <form action={updateProduct} className="mt-6 grid gap-3 border-t border-slate-100 pt-5">
                <input type="hidden" name="returnTo" value="/admin/products" />
                <AdminTextField label="Ad" name="name" defaultValue={product.name} required />
                <AdminTextField label="Açıklama" name="description" defaultValue={product.description ?? ""} />
                <AdminSelectField label="Durum" name="status" defaultValue={product.status}>
                  {productStatusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </AdminSelectField>
                <AdminSelectField label="isActive" name="isActive" defaultValue={product.isActive ? "true" : "false"}>
                  <option value="true">Evet</option>
                  <option value="false">Hayır</option>
                </AdminSelectField>
                <AdminSubmitButton>Ürünü güncelle</AdminSubmitButton>
              </form>
            </AdminPanel>
          );
        })}
      </div>
    </div>
  );
}
