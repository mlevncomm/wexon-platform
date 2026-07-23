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
  createModifierGroupAction,
  createModifierOptionAction,
  createProductAction,
  setProductModifierGroupsAction,
  updateCategoryAction,
  updateModifierGroupAction,
  updateModifierOptionAction,
  updateProductAction,
} from "@/lib/wexpay-actions";
import {
  listBranchCategories,
  listBranchModifierGroups,
  listBranchProducts,
  listOrgBranches,
  resolveActiveBranch,
} from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";

type SearchParams = Promise<{ wexpayError?: string; branchId?: string }>;

export default async function WexPayMenuPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: SearchParams  }) {
  const { organizationId } = await params;
  const basePath = wexpayAdminPreviewBasePath(organizationId);
  const context = await resolveWexPaySessionContext({ organizationId });
  if (!context.ok) return null;

  const { wexpayError, branchId } = await searchParams;
  const branches = await listOrgBranches(context.organizationId);

  if (branches.length === 0) {
    return (
      <WexPayPanel title="Menü / ürünler" description="QR menüde tanımlı kategori ve ürünler.">
        <WexPayEmptyNotice>
          Menü yönetimi için en az bir şube gereklidir.{" "}
          <Link href={`${basePath}/branches`} className="font-bold text-emerald-700">
            Şube oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  const activeBranch = await resolveActiveBranch(context.organizationId, branchId);
  if (!activeBranch) return null;

  const [categories, products, modifierGroups] = await Promise.all([
    listBranchCategories(context.organizationId, activeBranch.id),
    listBranchProducts(context.organizationId, activeBranch.id),
    listBranchModifierGroups(context.organizationId, activeBranch.id),
  ]);
  const redirectTo = `${basePath}/menu?branchId=${activeBranch.id}`;

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
          label="Stokta değil"
          value={String(products.filter((product) => !product.inStock).length)}
          detail="Satışa kapalı (boolean)"
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
                          Stokta değil
                        </span>
                      )}
                      {product.inStock ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800">
                          Satışta
                        </span>
                      ) : null}
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
                        Satışta / stokta
                      </label>
                      <div className="md:col-span-2">
                        <DemoPrimaryButton>Kaydet</DemoPrimaryButton>
                      </div>
                    </form>
                  )}
                  {context.canManage && modifierGroups.length > 0 ? (
                    <form action={setProductModifierGroupsAction} className="mt-4 grid gap-2 border-t border-slate-100 pt-4">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Modifier grupları
                      </p>
                      <div className="grid gap-2">
                        {modifierGroups.map((group) => {
                          const linked = product.productModifierGroups.some((link) => link.groupId === group.id);
                          return (
                            <label
                              key={group.id}
                              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                            >
                              <input
                                type="checkbox"
                                name="groupIds"
                                value={group.id}
                                defaultChecked={linked}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              {group.name}
                              <span className="text-xs font-semibold text-slate-400">
                                ({group.selectionType === "MULTI" ? "çoklu" : "tekli"}
                                {group.minSelect > 0 ? ", zorunlu" : ""})
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <DemoPrimaryButton>Bağlantıları kaydet</DemoPrimaryButton>
                    </form>
                  ) : null}
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

      <WexPayPanel
        title="Modifier grupları"
        description="Boyut, ekstra gibi ürün seçenekleri. Ürün kartından gruba bağlayın."
      >
        {modifierGroups.length === 0 ? (
          <WexPayEmptyNotice>Bu şubede henüz modifier grubu yok.</WexPayEmptyNotice>
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            {modifierGroups.map((group) => (
              <WexPaySurface key={group.id}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{group.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {group.options.length} seçenek · {group._count.productLinks} ürün bağlantısı
                    </p>
                  </div>
                  <ActiveBadge active={group.isActive} />
                </div>
                {context.canManage ? (
                  <>
                    <form action={updateModifierGroupAction} className="grid gap-3 md:grid-cols-2">
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <DemoInput label="Grup adı" name="name" defaultValue={group.name} required />
                      <DemoSelect
                        label="Seçim tipi"
                        name="selectionType"
                        defaultValue={group.selectionType}
                        options={[
                          { value: "SINGLE", label: "Tekli" },
                          { value: "MULTI", label: "Çoklu" },
                        ]}
                      />
                      <DemoInput label="Min seçim" name="minSelect" type="number" defaultValue={group.minSelect} />
                      <DemoInput label="Max seçim" name="maxSelect" type="number" defaultValue={group.maxSelect} />
                      <DemoInput label="Sıra" name="sortOrder" type="number" defaultValue={group.sortOrder} />
                      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-900/5">
                        <input
                          name="isActive"
                          value="true"
                          type="checkbox"
                          defaultChecked={group.isActive}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Aktif
                      </label>
                      <div className="md:col-span-2">
                        <DemoPrimaryButton>Grubu kaydet</DemoPrimaryButton>
                      </div>
                    </form>

                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      {group.options.map((option) => (
                        <form
                          key={option.id}
                          action={updateModifierOptionAction}
                          className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-[minmax(0,1fr)_110px_90px_auto]"
                        >
                          <input type="hidden" name="optionId" value={option.id} />
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <DemoInput label="Seçenek" name="name" defaultValue={option.name} required />
                          <DemoInput
                            label="Fiyat +"
                            name="priceDelta"
                            defaultValue={Number(option.priceDelta)}
                          />
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <input
                              name="isActive"
                              value="true"
                              type="checkbox"
                              defaultChecked={option.isActive}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Aktif
                          </label>
                          <DemoPrimaryButton>Kaydet</DemoPrimaryButton>
                        </form>
                      ))}
                      <form action={createModifierOptionAction} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_110px_auto]">
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <DemoInput label="Yeni seçenek" name="name" required placeholder="Örn. Büyük" />
                        <DemoInput label="Fiyat +" name="priceDelta" defaultValue={0} />
                        <DemoPrimaryButton>Seçenek ekle</DemoPrimaryButton>
                      </form>
                    </div>
                  </>
                ) : null}
              </WexPaySurface>
            ))}
          </div>
        )}

        {context.canManage ? (
          <form action={createModifierGroupAction} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-2 xl:grid-cols-4">
            <input type="hidden" name="branchId" value={activeBranch.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <DemoInput label="Yeni grup adı" name="name" required placeholder="Örn. Boyut" />
            <DemoSelect
              label="Seçim tipi"
              name="selectionType"
              defaultValue="SINGLE"
              options={[
                { value: "SINGLE", label: "Tekli" },
                { value: "MULTI", label: "Çoklu" },
              ]}
            />
            <DemoInput label="Min seçim" name="minSelect" type="number" defaultValue={0} />
            <DemoInput label="Max seçim" name="maxSelect" type="number" defaultValue={1} />
            <div className="md:col-span-2 xl:col-span-4">
              <DemoPrimaryButton>Modifier grubu ekle</DemoPrimaryButton>
            </div>
          </form>
        ) : null}
      </WexPayPanel>
    </WexPayPage>
  );
}
