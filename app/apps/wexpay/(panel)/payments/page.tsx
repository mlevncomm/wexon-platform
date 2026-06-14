import Link from "next/link";
import { PaymentStatus } from ".prisma/client";
import WexPayPaymentsBoard from "@/components/wexpay/WexPayPaymentsBoard";
import { WexPayReceiptRequestField } from "@/components/wexpay/WexPayReceiptRequestField";
import {
  DemoInput,
  DemoPrimaryButton,
  DemoSelect,
  WexPayEmptyNotice,
  WexPayErrorNotice,
  WexPayPage,
  WexPayPanel,
  WexPaySurface,
} from "@/components/wexpay/WexPayBusinessUI";
import { createPaymentAction, updatePaymentAction } from "@/lib/wexpay-actions";
import {
  listBranchActiveTables,
  listBranchOrders,
  listBranchPayments,
  listOrgBranches,
  resolveActiveBranch,
} from "@/lib/wexpay-read";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";

type SearchParams = Promise<{ wexpayError?: string; branchId?: string }>;

const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: PaymentStatus.PENDING, label: "Bekliyor" },
  { value: PaymentStatus.PAID, label: "Ödendi" },
  { value: PaymentStatus.PARTIAL, label: "Kısmi" },
  { value: PaymentStatus.FAILED, label: "Başarısız" },
  { value: PaymentStatus.REFUNDED, label: "İade" },
];

export default async function WexPayPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await resolveWexPaySessionContext();
  if (!context.ok) return null;

  const { wexpayError, branchId } = await searchParams;
  const branches = await listOrgBranches(context.organizationId);

  if (branches.length === 0) {
    return (
      <WexPayPanel title="Ödemeler" description="Operasyonel ödeme kayıtları.">
        <WexPayEmptyNotice>
          Ödeme kaydı için en az bir şube gereklidir.{" "}
          <Link href="/apps/wexpay/branches" className="font-bold text-emerald-700">
            Şube oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  const activeBranch = await resolveActiveBranch(context.organizationId, branchId);
  if (!activeBranch) return null;

  const [payments, tables, orders] = await Promise.all([
    listBranchPayments(context.organizationId, activeBranch.id),
    listBranchActiveTables(context.organizationId, activeBranch.id),
    listBranchOrders(context.organizationId, activeBranch.id),
  ]);
  const redirectTo = `/apps/wexpay/payments?branchId=${activeBranch.id}`;

  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount),
    status: payment.status,
    provider: payment.provider,
    tableLabel: payment.table.label,
    orderNo: payment.order?.orderNo ?? null,
    createdAt: payment.createdAt.toISOString(),
  }));

  return (
    <WexPayPage>
      {wexpayError && <WexPayErrorNotice message={wexpayError} />}

      <WexPayPaymentsBoard payments={paymentRows} />

      {context.canManage && payments.length > 0 && (
        <WexPayPanel title="Ödeme durumu güncelle">
          <div className="grid min-w-0 gap-3">
            {payments.slice(0, 10).map((payment) => (
              <WexPaySurface key={payment.id}>
              <form action={updatePaymentAction} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{payment.table.label}</p>
                  <p className="text-xs text-slate-500">{Number(payment.amount).toLocaleString("tr-TR")} ₺</p>
                </div>
                <DemoSelect
                  label="Durum"
                  name="status"
                  defaultValue={payment.status}
                  options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  className="min-w-0"
                />
                <DemoPrimaryButton>Kaydet</DemoPrimaryButton>
              </form>
              </WexPaySurface>
            ))}
          </div>
        </WexPayPanel>
      )}

      {context.canManage &&
        (tables.length === 0 ? (
          <WexPayPanel title="Ödeme kaydet">
            <WexPayEmptyNotice>Ödeme kaydı için bu şubede en az bir aktif masa gereklidir.</WexPayEmptyNotice>
          </WexPayPanel>
        ) : (
          <WexPayPanel title="Ödeme kaydet" description="Operasyonel ödeme kaydı oluşturun.">
            <form action={createPaymentAction} className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input type="hidden" name="branchId" value={activeBranch.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <DemoSelect
                label="Masa"
                name="tableId"
                required
                options={tables.map((table) => ({ value: table.id, label: table.label }))}
              />
              <DemoSelect
                label="Sipariş (opsiyonel)"
                name="orderId"
                defaultValue=""
                options={[{ value: "", label: "Sipariş bağlama" }, ...orders.map((order) => ({ value: order.id, label: `${order.orderNo} · ${order.table.label}` }))]}
              />
              <DemoInput label="Tutar (TRY)" name="amount" required placeholder="Örn. 250" />
              <DemoSelect
                label="Durum"
                name="status"
                defaultValue={PaymentStatus.PAID}
                options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
              <div className="md:col-span-2 xl:col-span-4">
                <WexPayReceiptRequestField />
              </div>
              <div className="md:col-span-2">
                <DemoPrimaryButton>Ödeme kaydet</DemoPrimaryButton>
              </div>
            </form>
          </WexPayPanel>
        ))}
    </WexPayPage>
  );
}
