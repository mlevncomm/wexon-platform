import Link from "next/link";
import WexPayOperationsBoard from "@/components/wexpay/WexPayOperationsBoard";
import { getWexPayAccess } from "@/lib/wexpay-auth";
import { getWexPayOperationsOverview } from "@/lib/wexpay-read";
import { formatCoreStatus } from "@/lib/wexon-core-dashboard";
import { appNavigationUrl } from "@/lib/wexon/urls";

type SearchParams = Promise<{ branchId?: string }>;

export default async function WexPayOperationsPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await getWexPayAccess();
  if (!access.allowed) return null;

  const { branchId } = await searchParams;

  const branchOptions = access.organization.restaurants.flatMap((restaurant) =>
    restaurant.branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ id: branch.id, name: branch.name, restaurantName: restaurant.name })),
  );

  if (branchOptions.length === 0) {
    return <OperationsEmptyState hasRestaurant={access.organization.restaurants.length > 0} />;
  }

  const activeBranch = branchOptions.find((branch) => branch.id === branchId) ?? branchOptions[0];
  const overview = await getWexPayOperationsOverview(access.organization.id, activeBranch.id);

  return (
    <WexPayOperationsBoard
      overview={overview}
      branchId={activeBranch.id}
      organizationId={access.organization.id}
      packageInfo={{
        planName: access.license.plan.name,
        licenseStatus: formatCoreStatus(access.license.status),
        installationStatus: formatCoreStatus(access.installation.status),
      }}
    />
  );
}

function OperationsEmptyState({ hasRestaurant }: { hasRestaurant: boolean }) {
  return (
    <div className="mx-auto max-w-md rounded-[18px] border border-slate-200/80 bg-white p-6 text-center shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:p-7">
      <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
        WexPay · Operasyon Merkezi
      </span>
      <h1 className="text-lg font-black text-slate-950">Operasyon ekranı için kurulum gerekli</h1>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
        {hasRestaurant
          ? "Operasyon merkezini kullanmak için en az bir aktif şube oluşturun."
          : "Operasyon merkezini kullanmak için önce restoran ve şube kurulumunuzu tamamlayın."}
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link
          href={hasRestaurant ? appNavigationUrl("/apps/wexpay/branches") : appNavigationUrl("/apps/wexpay/restaurants")}
          className="rounded-2xl bg-[#5dff65] px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-[#48e050]"
        >
          {hasRestaurant ? "Şube oluştur" : "Restoran oluştur"}
        </Link>
        <Link
          href={appNavigationUrl("/apps/wexpay/settings")}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Ayarlar
        </Link>
      </div>
    </div>
  );
}
