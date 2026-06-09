import Link from "next/link";
import {
  ActiveBadge,
  DemoInput,
  DemoPrimaryButton,
  DemoSelect,
  formatLira,
  WexPayEmptyNotice,
  WexPayErrorNotice,
  WexPayMetricCard,
  WexPayMetricStrip,
  WexPayPage,
  WexPayPanel,
  WexPayPanelGrid,
  WexPaySurface,
} from "@/components/wexpay/WexPayBusinessUI";
import {
  createCategoryAction,
  createProductAction,
  updateCategoryAction,
  updateProductAction,
} from "@/lib/wexpay-actions";
import { listBranchCategories, listBranchProducts, listOrgBranches, resolveActiveBranch } from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";

type SearchParams = Promise<{ wexpayError?: string; branchId?: string }>;

export default async function WexPayMenuPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await resolveWexPaySessionContext();
  if (!context.ok) return null;

  const { wexpayError, branchId } = await searchParams;
  const branches = await listOrgBranches(context.organizationId);

  if (branches.length === 0) {
    return (
      <WexPayPanel title="Menü / ürünler" description="QR menüde tanımlı kategori ve ürünler.">
        <WexPayEmptyNotice>
          Menü yönetimi için en az bir şube gereklidir.{" "}
          <Link href="/apps/wexpay/branches" className="font-bold text-emerald-700">
            Şube oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  const activeBranch = await resolveActiveBranch(context.organizationId, branchId);
  if (!activeBranch) return null;

  const [categories, products] = await Promise.all([
    listBranchCategories(context.organizationId, activeBranch.id),
    listBranchProducts(context.organizationId, activeBranch.id),
  ]);
  const redirectTo = `/apps/wexpay/menu?branchId=${activeBranch.id}`;

  return (
    <WexPayPage>
      {wexpayError && <WexPayErrorNotice message={wexpayError} />}

      <WexPayMetricStrip
        eyebrow="Menü"
        title="Ürün özeti"
        gridClassName="grid gap-3 bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5"
      >
        <WexPayMetricCard label="Toplam ürün" value={String(products.length)} detail="QR menüde tanımlı" accent={products.length > 0} />
        <WexPayMetricCard
          label="Aktif ürün"
          value={String(products.filter((product) => product.isActive).length)}
          detail="Satışa açık"
          accent={products.some((product) => product.isActive)}
        />
        <WexPayMetricCard
          label="Stokta olmayan"
          value={String(products.filter((product) => !product.inStock).length)}
          detail="Geçici kapalı"
          accent={products.some((product) => !product.inStock)}
        />
        <WexPayMetricCard label="Kategori sayısı" value={String(categories.length)} detail="Menü grubu" accent={categories.length > 0} />
      </WexPayMetricStrip>

      <WexPayPanel
        eyebrow="Bilgi"
        title="Menü yönetimi"
        description="QR menü ve temel ürün yönetimi tüm WexPay paketlerinde bulunur. Plan limitleri Wexon Core entitlement kararından gelir."
      />

      <WexPayPanelGrid className="items-start xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
        <WexPayPanel title="Kategoriler" description="QR menü grupları">
          {categories.length === 0 ? (
            <WexPayEmptyNotice>Bu şubede kategori yok.</WexPayEmptyNotice>
          ) : (
            <div className="grid min-w-0 gap-3">
              {categories.map((category) => (
                <WexPaySurface key={category.id}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{category.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{category._count.products} ürün</p>
                    </div>
                    <ActiveBadge active={category.isActive} />
                  </div>
                  {context.canManage && (
                    <form action={updateCategoryAction} className="grid gap-3">
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <DemoInput label="Kategori adı" name="name" defaultValue={category.name} required />
                      <DemoInput label="Sıra" name="sortOrder" type="number" defaultValue={category.sortOrder} />
                      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-900/5">
                        <input name="isActive" value="true" type="checkbox" defaultChecked={category.isActive} className="h-4 w-4 rounded border-slate-300" />
                        Aktif
                      </label>
                      <DemoPrimaryButton>Kaydet</DemoPrimaryButton>
                    </form>
                  )}
                </WexPaySurface>
              ))}
            </div>
          )}

          {context.canManage && (
            <form action={createCategoryAction} className="mt-5 grid gap-3 border-t border-slate-100 pt-5">
              <input type="hidden" name="branchId" value={activeBranch.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <DemoInput label="Yeni kategori adı" name="name" required placeholder="Örn. Ana Yemekler" />
              <DemoPrimaryButton>Kategori ekle</DemoPrimaryButton>
            </form>
          )}
        </WexPayPanel>

        <WexPayPanel
          title="Menü / ürünler"
          description={`${activeBranch.restaurant.name} · ${activeBranch.name} — QR menüde görünen ürünler`}
        >
          {products.length === 0 ? (
            <WexPayEmptyNotice>Bu şubede ürün yok.</WexPayEmptyNotice>
          ) : (
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {products.map((product) => (
                <WexPaySurface key={product.id}>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{product.name}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        {product.category.name} · {formatLira(Number(product.price))}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActiveBadge active={product.isActive} />
                      {!product.inStock && (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-rose-800">
                          Stok yok
                        </span>
                      )}
                    </div>
                  </div>
                  {context.canManage && (
                    <form action={updateProductAction} className="grid min-w-0 gap-3 md:grid-cols-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <DemoInput label="Ürün adı" name="name" defaultValue={product.name} required />
                      <DemoInput label="Fiyat" name="price" defaultValue={Number(product.price)} required />
                      <DemoSelect
                        label="Kategori"
                        name="categoryId"
                        defaultValue={product.category.id}
                        options={categories.map((category) => ({ value: category.id, label: category.name }))}
                      />
                      <DemoInput label="Görsel URL" name="imageUrl" defaultValue={product.imageUrl ?? ""} />
                      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-900/5">
                        <input name="isActive" value="true" type="checkbox" defaultChecked={product.isActive} className="h-4 w-4 rounded border-slate-300" />
                        Aktif
                      </label>
                      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-900/5">
                        <input name="inStock" value="true" type="checkbox" defaultChecked={product.inStock} className="h-4 w-4 rounded border-slate-300" />
                        Stokta
                      </label>
                      <div className="md:col-span-2">
                        <DemoPrimaryButton>Kaydet</DemoPrimaryButton>
                      </div>
                    </form>
                  )}
                </WexPaySurface>
              ))}
            </div>
          )}

          {context.canManage &&
            (categories.length === 0 ? (
              <p className="mt-5 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-500">
                Ürün eklemek için önce en az bir kategori oluşturun.
              </p>
            ) : (
              <form action={createProductAction} className="mt-5 grid min-w-0 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2 xl:grid-cols-4">
                <input type="hidden" name="branchId" value={activeBranch.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <DemoInput label="Ürün adı" name="name" required placeholder="Örn. Cheeseburger" />
                <DemoSelect
                  label="Kategori"
                  name="categoryId"
                  defaultValue={categories[0]?.id}
                  options={categories.map((category) => ({ value: category.id, label: category.name }))}
                />
                <DemoInput label="Fiyat (TRY)" name="price" required placeholder="Örn. 250" />
                <DemoInput label="Görsel URL (opsiyonel)" name="imageUrl" placeholder="https://..." />
                <div className="md:col-span-2">
                  <DemoPrimaryButton>Ürün ekle</DemoPrimaryButton>
                </div>
              </form>
            ))}
        </WexPayPanel>
      </WexPayPanelGrid>
    </WexPayPage>
  );
}
