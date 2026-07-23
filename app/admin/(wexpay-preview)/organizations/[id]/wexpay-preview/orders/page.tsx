import Link from "next/link";
import WexPayOrdersBoard from "@/components/wexpay/WexPayOrdersBoard";
import WexPayOrderComposer from "@/components/wexpay/WexPayOrderComposer";
import {
  WexPayEmptyNotice,
  WexPayErrorNotice,
  WexPayPage,
  WexPayPanel,
} from "@/components/wexpay/WexPayBusinessUI";
import {
  listBranchActiveTables,
  listBranchOrderableProducts,
  listBranchOrders,
  listOrgBranches,
  resolveActiveBranch,
} from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";

type SearchParams = Promise<{ wexpayError?: string; branchId?: string }>;

export default async function WexPayOrdersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams  }) {
  const { id: organizationId } = await params;
  const basePath = wexpayAdminPreviewBasePath(organizationId);
  const context = await resolveWexPaySessionContext({ organizationId });
  if (!context.ok) return null;

  const { wexpayError, branchId } = await searchParams;
  const branches = await listOrgBranches(context.organizationId);

  if (branches.length === 0) {
    return (
      <WexPayPanel title="Siparişler" description="Masa siparişlerini yönetin.">
        <WexPayEmptyNotice>
          Sipariş yönetimi için en az bir şube gereklidir.{" "}
          <Link href={`${basePath}/branches`} className="font-bold text-emerald-700">
            Şube oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  const activeBranch = await resolveActiveBranch(context.organizationId, branchId);
  if (!activeBranch) return null;

  const [orders, tables, products] = await Promise.all([
    listBranchOrders(context.organizationId, activeBranch.id),
    listBranchActiveTables(context.organizationId, activeBranch.id),
    listBranchOrderableProducts(context.organizationId, activeBranch.id),
  ]);
  const redirectTo = `${basePath}/orders?branchId=${activeBranch.id}`;

  const orderRows = orders.map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    subtotal: Number(order.subtotal),
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    tableLabel: order.table.label,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.productName,
      quantity: item.quantity,
      lineTotal: Number(item.totalPrice),
    })),
  }));

  return (
    <WexPayPage>
      {wexpayError && <WexPayErrorNotice message={wexpayError} />}

      <WexPayOrdersBoard orders={orderRows} canManage={context.canOperateKitchen} redirectTo={redirectTo} />

      {context.canManage &&
        (tables.length === 0 || products.length === 0 ? (
          <WexPayPanel title="Yeni sipariş">
            <WexPayEmptyNotice>
              Sipariş oluşturmak için bu şubede en az bir aktif masa ve stokta bir ürün gereklidir.
            </WexPayEmptyNotice>
          </WexPayPanel>
        ) : (
          <WexPayPanel
            title="Yeni sipariş"
            description="Masa ve ürünleri seçin; tutar sunucu tarafında hesaplanır."
          >
            <WexPayOrderComposer
              branchId={activeBranch.id}
              redirectTo={redirectTo}
              tables={tables.map((table) => ({ id: table.id, label: table.label }))}
              products={products.map((product) => ({
                id: product.id,
                name: product.name,
                price: Number(product.price),
                categoryName: product.category.name,
              }))}
            />
          </WexPayPanel>
        ))}
    </WexPayPage>
  );
}
