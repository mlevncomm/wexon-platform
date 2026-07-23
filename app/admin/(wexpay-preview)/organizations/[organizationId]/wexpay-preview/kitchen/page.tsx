import Link from "next/link";
import WexPayKitchenBoard from "@/components/wexpay/WexPayKitchenBoard";
import { WexPayEmptyNotice, WexPayErrorNotice, WexPayPanel } from "@/components/wexpay/WexPayBusinessUI";
import { listBranchKitchenOrders, listOrgBranches, resolveActiveBranch } from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";

type SearchParams = Promise<{ wexpayError?: string; branchId?: string }>;

export default async function WexPayKitchenPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: SearchParams  }) {
  const { organizationId } = await params;
  const basePath = wexpayAdminPreviewBasePath(organizationId);
  const context = await resolveWexPaySessionContext({ organizationId });
  if (!context.ok) return null;

  const { wexpayError, branchId } = await searchParams;
  const branches = await listOrgBranches(context.organizationId);

  if (branches.length === 0) {
    return (
      <WexPayPanel title="Mutfak" description="Şube siparişlerini hazırlık akışında takip edin.">
        <WexPayEmptyNotice>
          Mutfak ekranı için en az bir şube gereklidir.{" "}
          <Link href={`${basePath}/branches`} className="font-bold text-emerald-700">
            Şube oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  const activeBranch = await resolveActiveBranch(context.organizationId, branchId);
  if (!activeBranch) return null;

  const orders = await listBranchKitchenOrders(context.organizationId, activeBranch.id);
  const redirectTo = `${basePath}/kitchen?branchId=${activeBranch.id}`;

  return (
    <>
      {wexpayError ? <WexPayErrorNotice message={wexpayError} /> : null}
      <WexPayKitchenBoard
        orders={orders}
        canManage={context.canOperateKitchen}
        redirectTo={redirectTo}
        organizationId={context.organizationId}
        branchId={activeBranch.id}
      />
    </>
  );
}
