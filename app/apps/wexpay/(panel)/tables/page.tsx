import Link from "next/link";
import {
  DemoInput,
  DemoPrimaryButton,
  WexPayEmptyNotice,
  WexPayErrorNotice,
  WexPayPage,
  WexPayPanel,
} from "@/components/wexpay/WexPayBusinessUI";
import { WexPayTableOperationsView } from "@/components/wexpay/WexPayTableOperations";
import { closeTableAction, createTableAction, updateTableAction } from "@/lib/wexpay-actions";
import { listBranchTableOperations, listBranchTables, listOrgBranches, resolveActiveBranch } from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";

type SearchParams = Promise<{ wexpayError?: string; branchId?: string }>;

export default async function WexPayTablesPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await resolveWexPaySessionContext();
  if (!context.ok) return null;

  const { wexpayError, branchId } = await searchParams;
  const branches = await listOrgBranches(context.organizationId);

  if (branches.length === 0) {
    return (
      <WexPayPanel title="Masalar" description="Şubelere bağlı masa kayıtları.">
        <WexPayEmptyNotice>
          Masa oluşturmadan önce en az bir şube gereklidir.{" "}
          <Link href="/apps/wexpay/branches" className="font-bold text-emerald-700">
            Şube oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  const activeBranch = await resolveActiveBranch(context.organizationId, branchId);
  if (!activeBranch) return null;

  const tables = await listBranchTableOperations(context.organizationId, activeBranch.id);
  const adminTables = await listBranchTables(context.organizationId, activeBranch.id);
  const redirectTo = `/apps/wexpay/tables?branchId=${activeBranch.id}`;

  return (
    <WexPayPage>
      {wexpayError && <WexPayErrorNotice message={wexpayError} />}

      <WexPayTableOperationsView
        tables={tables}
        canManage={context.canManage}
        activeBranchId={activeBranch.id}
        redirectTo={redirectTo}
        showRefresh
      />

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
                      <form action={updateTableAction} className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:flex-nowrap lg:gap-4">
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
                            className="w-full min-w-0 rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
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
                            className="w-full min-w-0 rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                          />
                        </label>
                        <label className="flex h-[42px] w-full shrink-0 items-center gap-2 rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 text-sm font-bold text-slate-700 sm:w-auto">
                          <input
                            name="isActive"
                            value="true"
                            type="checkbox"
                            defaultChecked={table.isActive}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Aktif
                        </label>
                        <button
                          type="submit"
                          className="shrink-0 rounded-[16px] bg-[#10b981] px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-700"
                        >
                          Kaydet
                        </button>
                      </form>
                      <form action={closeTableAction} className="shrink-0">
                        <input type="hidden" name="tableId" value={table.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <button
                          type="submit"
                          className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-slate-900/5 transition-colors hover:bg-slate-50 lg:w-auto"
                        >
                          Masayı kapat
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
