import Link from "next/link";
import { Suspense } from "react";
import {
  DemoInput,
  DemoPrimaryButton,
  WexPayEmptyNotice,
  WexPayErrorNotice,
  WexPayPage,
  WexPayPanel,
} from "@/components/wexpay/WexPayBusinessUI";
import { WexPayCashierWorkspace } from "@/components/wexpay/WexPayCashierWorkspace";
import { WexPayPaytrCheckoutNotice } from "@/components/wexpay/WexPayPaytrCheckoutNotice";
import { createTableAction, createTablesBulkAction, updateTableAction } from "@/lib/wexpay-actions";
import { buildPublicTableQrUrl } from "@/lib/wexpay-public-table-url";
import {
  listBranchNotifications,
  listBranchOrderableProducts,
  listBranchTableOperations,
  listBranchTables,
  listOrgBranches,
  resolveActiveBranch,
} from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";

type SearchParams = Promise<{
  wexpayError?: string;
  branchId?: string;
  paytrCheckout?: string;
  paymentId?: string;
  tableId?: string;
  composer?: string;
}>;

export default async function WexPayTablesPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: SearchParams  }) {
  const { organizationId } = await params;
  const basePath = wexpayAdminPreviewBasePath(organizationId);
  const context = await resolveWexPaySessionContext({ organizationId });
  if (!context.ok) return null;

  const { wexpayError, branchId, paytrCheckout, paymentId } = await searchParams;
  const branches = await listOrgBranches(context.organizationId);

  if (branches.length === 0) {
    return (
      <WexPayPanel title="Masalar" description="Şubelere bağlı masa kayıtları.">
        <WexPayEmptyNotice>
          Masa oluşturmadan önce en az bir şube gereklidir.{" "}
          <Link href={`${basePath}/branches`} className="font-bold text-emerald-700">
            Şube oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  const activeBranch = await resolveActiveBranch(context.organizationId, branchId);
  if (!activeBranch) return null;

  const [tables, adminTables, products, notifications] = await Promise.all([
    listBranchTableOperations(context.organizationId, activeBranch.id),
    listBranchTables(context.organizationId, activeBranch.id),
    listBranchOrderableProducts(context.organizationId, activeBranch.id),
    listBranchNotifications(context.organizationId, activeBranch.id, 20),
  ]);

  const redirectTo = `${basePath}/tables?branchId=${activeBranch.id}`;
  const checkoutPayment =
    paymentId && paytrCheckout
      ? tables.flatMap((table) => table.payments).find((payment) => payment.id === paymentId)
      : null;

  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    price: Number(product.price),
    categoryName: product.category?.name ?? "",
  }));

  const cashierTables = tables.map((table) => ({
    ...table,
    publicQrUrl: buildPublicTableQrUrl(table.qrCode),
  }));

  return (
    <WexPayPage>
      {wexpayError && <WexPayErrorNotice message={wexpayError} />}

      {paytrCheckout ? (
        <WexPayPaytrCheckoutNotice
          checkoutUrl={paytrCheckout}
          paymentId={paymentId}
          providerRef={checkoutPayment?.providerRef}
        />
      ) : null}

      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-100" />}>
        <WexPayCashierWorkspace
          tables={cashierTables}
          canManage={context.canOperateCashier}
          activeBranchId={activeBranch.id}
          activeBranchName={activeBranch.name}
          organizationId={context.organizationId}
          redirectTo={redirectTo}
          products={productOptions}
          notifications={notifications}
        />
      </Suspense>

      {context.canManage && (
        <>
          <WexPayPanel title="Yeni masa ekle" description={`${activeBranch.restaurant.name} · ${activeBranch.name}`}>
            <form action={createTableAction} className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_140px_auto] lg:items-end">
              <input type="hidden" name="branchId" value={activeBranch.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <DemoInput label="Masa adı" name="label" required placeholder="Örn. Masa 01" />
              <DemoInput label="Koltuk sayısı" name="seats" type="number" min={1} max={100} defaultValue={4} />
              <DemoPrimaryButton>Masa ekle</DemoPrimaryButton>
            </form>
          </WexPayPanel>

          <WexPayPanel
            title="Toplu masa oluştur"
            description="Önek + numara ile birden fazla masa. Örn. Masa 01…Masa 12"
          >
            <form
              action={createTablesBulkAction}
              className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_100px_100px_120px_auto] xl:items-end"
            >
              <input type="hidden" name="branchId" value={activeBranch.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <DemoInput label="Önek" name="prefix" required placeholder="Örn. Masa" defaultValue="Masa" />
              <DemoInput label="Adet" name="count" type="number" min={1} max={50} defaultValue={10} required />
              <DemoInput label="Başlangıç" name="startNumber" type="number" min={1} max={9999} defaultValue={1} />
              <DemoInput label="Koltuk" name="seats" type="number" min={1} max={100} defaultValue={4} />
              <DemoPrimaryButton>Toplu oluştur</DemoPrimaryButton>
            </form>
          </WexPayPanel>

          <WexPayPanel title="Masa kayıtları" description="Etiket, koltuk ve aktiflik düzenlemesi">
            {adminTables.length === 0 ? (
              <WexPayEmptyNotice>Henüz masa kaydı yok.</WexPayEmptyNotice>
            ) : (
              <div className="overflow-hidden rounded-[16px] border border-slate-200/80">
                <div className="hidden border-b border-slate-200/80 bg-slate-50/90 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 lg:grid lg:grid-cols-[minmax(0,1fr)_110px_90px_200px] lg:gap-4">
                  <span>Masa adı</span>
                  <span>Koltuk</span>
                  <span>Aktif</span>
                  <span className="text-right">İşlemler</span>
                </div>
                <div className="divide-y divide-slate-200/80 bg-white">
                  {adminTables.map((table) => (
                    <div
                      key={table.id}
                      className="flex min-w-0 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-end lg:gap-4"
                    >
                      <form
                        action={updateTableAction}
                        className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:flex-nowrap lg:gap-4"
                      >
                        <input type="hidden" name="tableId" value={table.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <label className="min-w-0 flex-1 sm:min-w-[200px]">
                          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 lg:sr-only">
                            Masa adı
                          </span>
                          <input
                            name="label"
                            defaultValue={table.label}
                            required
                            className="w-full min-w-0 rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                          />
                        </label>
                        <label className="w-full sm:w-28">
                          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 lg:sr-only">
                            Koltuk
                          </span>
                          <input
                            name="seats"
                            type="number"
                            min={1}
                            max={100}
                            defaultValue={table.seats}
                            required
                            className="w-full rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <input type="checkbox" name="isActive" value="true" defaultChecked={table.isActive} />
                          Aktif
                        </label>
                        <button
                          type="submit"
                          className="rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
                        >
                          Güncelle
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </WexPayPanel>
        </>
      )}
    </WexPayPage>
  );
}
