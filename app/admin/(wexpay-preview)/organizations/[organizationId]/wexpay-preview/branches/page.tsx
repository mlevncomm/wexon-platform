import Link from "next/link";
import {
  ActiveBadge,
  DemoInput,
  DemoPrimaryButton,
  DemoSelect,
  WexPayEmptyNotice,
  WexPayErrorNotice,
  WexPayPage,
  WexPayPanel,
  WexPaySurface,
} from "@/components/wexpay/WexPayBusinessUI";
import { WexPayFeatureHint } from "@/components/wexpay/WexPayFeatureLocked";
import { createBranchAction, updateBranchAction } from "@/lib/wexpay-actions";
import { isWexPayFeatureEnabled } from "@/lib/wexpay-entitlements";
import { listOrgBranches, listOrgRestaurants } from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";

type SearchParams = Promise<{ wexpayError?: string; restaurantId?: string }>;

export default async function WexPayBranchesPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: SearchParams  }) {
  const { organizationId } = await params;
  const basePath = wexpayAdminPreviewBasePath(organizationId);
  const context = await resolveWexPaySessionContext({ organizationId });
  if (!context.ok) return null;

  const { wexpayError, restaurantId } = await searchParams;
  const restaurants = await listOrgRestaurants(context.organizationId);
  const selectedRestaurantId = restaurants.some((r) => r.id === restaurantId) ? restaurantId : undefined;
  const [branches, allBranches] = await Promise.all([
    listOrgBranches(context.organizationId, selectedRestaurantId),
    listOrgBranches(context.organizationId),
  ]);
  const redirectTo = selectedRestaurantId
    ? `${basePath}/branches?restaurantId=${selectedRestaurantId}`
    : `${basePath}/branches`;
  const multiLocationEnabled = isWexPayFeatureEnabled(context.entitlementMap, "feature_multi_location");
  const activeBranchCount = allBranches.filter((branch) => branch.isActive).length;
  const canCreateBranch = context.canManage && (multiLocationEnabled || activeBranchCount === 0);

  if (restaurants.length === 0) {
    return (
      <WexPayPanel title="Şubeler" description="Restoranlara bağlı şube kayıtları.">
        <WexPayEmptyNotice>
          Şube oluşturmadan önce en az bir restoran kaydı gereklidir.{" "}
          <Link href={`${basePath}/restaurants`} className="font-bold text-emerald-700">
            Restoran oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  return (
    <WexPayPage>
      {wexpayError && <WexPayErrorNotice message={wexpayError} />}

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <FilterChip label="Tümü" href={`${basePath}/branches`} active={!selectedRestaurantId} />
        {restaurants.map((restaurant) => (
          <FilterChip
            key={restaurant.id}
            label={restaurant.name}
            href={`${basePath}/branches?restaurantId=${restaurant.id}`}
            active={selectedRestaurantId === restaurant.id}
          />
        ))}
      </div>

      <WexPayPanel title="Şube listesi" description={`Toplam ${branches.length} şube`}>
        {branches.length === 0 ? (
          <WexPayEmptyNotice>Bu seçim için şube kaydı yok.</WexPayEmptyNotice>
        ) : (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            {branches.map((branch) => (
              <WexPaySurface key={branch.id}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{branch.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {branch.restaurant.name} · {branch.slug} · {branch._count.tables} masa · {branch._count.products} ürün
                    </p>
                  </div>
                  <ActiveBadge active={branch.isActive} />
                </div>
                {context.canManage && (
                  <form action={updateBranchAction} className="grid min-w-0 gap-3 md:grid-cols-2">
                    <input type="hidden" name="branchId" value={branch.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <DemoInput label="Şube adı" name="name" defaultValue={branch.name} required />
                    <DemoInput label="Adres" name="address" defaultValue={branch.address ?? ""} />
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-900/5">
                      <input name="isActive" value="true" type="checkbox" defaultChecked={branch.isActive} className="h-4 w-4 rounded border-slate-300" />
                      Aktif
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
      </WexPayPanel>

      {context.canManage && !canCreateBranch ? (
        <WexPayFeatureHint>
          Çoklu şube (multi-location) paketinizde kapalı. Mevcut şubeyi yönetebilirsiniz; ek şube için paketi
          yükseltin.
        </WexPayFeatureHint>
      ) : null}

      {canCreateBranch && (
        <WexPayPanel title="Yeni şube oluştur">
          <form action={createBranchAction} className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <DemoSelect
              label="Restoran"
              name="restaurantId"
              defaultValue={selectedRestaurantId ?? restaurants[0]?.id}
              options={restaurants.map((restaurant) => ({ value: restaurant.id, label: restaurant.name }))}
            />
            <DemoInput label="Şube adı" name="name" required placeholder="Örn. Merkez Şube" />
            <DemoInput label="Slug (opsiyonel)" name="slug" placeholder="otomatik üretilir" />
            <DemoInput label="Adres (opsiyonel)" name="address" />
            <div className="md:col-span-2">
              <DemoPrimaryButton>Şube oluştur</DemoPrimaryButton>
            </div>
          </form>
        </WexPayPanel>
      )}
    </WexPayPage>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`min-w-0 rounded-2xl border px-4 py-2 text-center text-xs font-bold transition-colors ${
        active
          ? "border-emerald-200 bg-[#10b981] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="block truncate">{label}</span>
    </Link>
  );
}
