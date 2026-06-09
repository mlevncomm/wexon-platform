import {
  ActiveBadge,
  DemoInput,
  DemoPrimaryButton,
  WexPayEmptyNotice,
  WexPayErrorNotice,
  WexPayPage,
  WexPayPanel,
  WexPaySurface,
} from "@/components/wexpay/WexPayBusinessUI";
import { createRestaurantAction, updateRestaurantAction } from "@/lib/wexpay-actions";
import { listOrgRestaurants } from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";

type SearchParams = Promise<{ wexpayError?: string }>;

export default async function WexPayRestaurantsPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await resolveWexPaySessionContext();
  if (!context.ok) return null;

  const { wexpayError } = await searchParams;
  const restaurants = await listOrgRestaurants(context.organizationId);
  const redirectTo = "/apps/wexpay/restaurants";

  return (
    <WexPayPage>
      {wexpayError && <WexPayErrorNotice message={wexpayError} />}

      <WexPayPanel
        title="Restoranlar"
        description="Organizasyonunuza bağlı WexPay işletmelerini yönetin."
      >
        {restaurants.length === 0 ? (
          <WexPayEmptyNotice>Henüz restoran kaydı yok. Aşağıdan ilk restoranınızı oluşturun.</WexPayEmptyNotice>
        ) : (
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {restaurants.map((restaurant) => (
              <WexPaySurface key={restaurant.id}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{restaurant.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {restaurant.slug} · {restaurant._count.branches} şube
                    </p>
                  </div>
                  <ActiveBadge active={restaurant.isActive} />
                </div>
                {context.canManage && (
                  <form action={updateRestaurantAction} className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <input type="hidden" name="restaurantId" value={restaurant.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <DemoInput label="Ad" name="name" defaultValue={restaurant.name} required />
                    <DemoInput label="Slug" name="slug" defaultValue={restaurant.slug} required />
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-900/5">
                      <input name="isActive" value="true" type="checkbox" defaultChecked={restaurant.isActive} className="h-4 w-4 rounded border-slate-300" />
                      Aktif
                    </label>
                    <div className="md:col-span-3">
                      <DemoPrimaryButton>Kaydet</DemoPrimaryButton>
                    </div>
                  </form>
                )}
              </WexPaySurface>
            ))}
          </div>
        )}
      </WexPayPanel>

      {context.canManage && (
        <WexPayPanel title="Yeni restoran oluştur">
          <form action={createRestaurantAction} className="grid min-w-0 gap-4 md:grid-cols-2">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <DemoInput label="Restoran adı" name="name" required placeholder="Örn. Mavi Bahçe Restaurant" />
            <DemoInput label="Slug" name="slug" required placeholder="Örn. mavi-bahce" />
            <div className="md:col-span-2">
              <DemoPrimaryButton>Restoran oluştur</DemoPrimaryButton>
            </div>
          </form>
        </WexPayPanel>
      )}
    </WexPayPage>
  );
}
