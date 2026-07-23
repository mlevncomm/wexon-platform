import Link from "next/link";
import { PaymentStatus } from ".prisma/client";
import WexPayPaymentsBoard from "@/components/wexpay/WexPayPaymentsBoard";
import { WexPayPaytrCheckoutNotice } from "@/components/wexpay/WexPayPaytrCheckoutNotice";
import { WexPayPaymentProviderField } from "@/components/wexpay/WexPayPaymentProviderField";
import { WexPayReceiptRequestField } from "@/components/wexpay/WexPayReceiptRequestField";
import {
  DemoInput,
  DemoPrimaryButton,
  WexPayEmptyNotice,
  WexPayErrorNotice,
  WexPayPage,
  WexPayPanel,
  WexPaySurface,
} from "@/components/wexpay/WexPayBusinessUI";
import { createPaymentAction, updatePaymentAction } from "@/lib/wexpay-actions";
import {
  listBranchActiveTables,
  listBranchNotifications,
  listBranchOrders,
  listBranchPayments,
  listOrgBranches,
  resolveActiveBranch,
} from "@/lib/wexpay-read";
import { buildOpsAlerts, WexPayOperationsAlertStrip } from "@/components/wexpay/WexPayOperationsAlertStrip";
import { resolveWexPaySessionContext } from "@/lib/wexpay-tenant";
import { wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";

type SearchParams = Promise<{
  wexpayError?: string;
  branchId?: string;
  paytrCheckout?: string;
  paymentId?: string;
  paytr?: string;
}>;

const ALL_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: PaymentStatus.PENDING, label: "Bekliyor" },
  { value: PaymentStatus.PAID, label: "Ödendi" },
  { value: PaymentStatus.PARTIAL, label: "Kısmi" },
  { value: PaymentStatus.FAILED, label: "Başarısız" },
  { value: PaymentStatus.REFUNDED, label: "İade" },
];

/** Manual create: only PAID / PARTIAL (PayTR create has no status field). */
const MANUAL_CREATE_STATUS_OPTIONS = ALL_STATUS_OPTIONS.filter(
  (option) => option.value === PaymentStatus.PAID || option.value === PaymentStatus.PARTIAL,
);

const STAFF_UPDATE_STATUS_OPTIONS = ALL_STATUS_OPTIONS.filter(
  (option) => option.value !== PaymentStatus.REFUNDED,
);

function isTerminalPaymentStatus(status: PaymentStatus) {
  return status === PaymentStatus.PAID || status === PaymentStatus.REFUNDED;
}

export default async function WexPayPaymentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams  }) {
  const { id: organizationId } = await params;
  const basePath = wexpayAdminPreviewBasePath(organizationId);
  const context = await resolveWexPaySessionContext({ organizationId });
  if (!context.ok) return null;

  const isStaffLimited =
    !context.canManage && context.actor.type === "customer_session" && context.actor.role === "STAFF";

  const { wexpayError, branchId, paytrCheckout, paymentId, paytr } = await searchParams;
  const branches = await listOrgBranches(context.organizationId);

  if (branches.length === 0) {
    return (
      <WexPayPanel title="Ödemeler" description="Operasyonel ödeme kayıtları.">
        <WexPayEmptyNotice>
          Ödeme kaydı için en az bir şube gereklidir.{" "}
          <Link href={`${basePath}/branches`} className="font-bold text-emerald-700">
            Şube oluştur
          </Link>
        </WexPayEmptyNotice>
      </WexPayPanel>
    );
  }

  const activeBranch = await resolveActiveBranch(context.organizationId, branchId);
  if (!activeBranch) return null;

  const [payments, tables, orders, notifications] = await Promise.all([
    listBranchPayments(context.organizationId, activeBranch.id),
    listBranchActiveTables(context.organizationId, activeBranch.id),
    listBranchOrders(context.organizationId, activeBranch.id),
    listBranchNotifications(context.organizationId, activeBranch.id, 20),
  ]);
  const redirectTo = `${basePath}/payments?branchId=${activeBranch.id}`;
  const paymentRequestAlerts = buildOpsAlerts(notifications, context.organizationId, activeBranch.id).filter(
    (alert) => alert.kind === "payment_request",
  );

  const checkoutPayment = paymentId ? payments.find((payment) => payment.id === paymentId) : null;

  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount),
    status: payment.status,
    provider: payment.provider,
    providerRef: payment.providerRef,
    tableLabel: payment.table.label,
    orderNo: payment.order?.orderNo ?? null,
    createdAt: payment.createdAt.toISOString(),
  }));

  const updateStatusOptions = isStaffLimited ? STAFF_UPDATE_STATUS_OPTIONS : ALL_STATUS_OPTIONS;

  return (
    <WexPayPage>
      {wexpayError && <WexPayErrorNotice message={wexpayError} />}

      {paytr === "success" && (
        <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          PayTR yönlendirmesi tamamlandı. Kesin sonuç webhook bildirimi ile operasyon kaydına yansır.
        </div>
      )}

      {paytr === "failed" && (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          PayTR ödeme ekranı başarısız veya iptal ile kapandı. Webhook geldiğinde kayıt FAILED olarak güncellenir.
        </div>
      )}

      {paytrCheckout ? (
        <WexPayPaytrCheckoutNotice
          checkoutUrl={paytrCheckout}
          paymentId={paymentId}
          providerRef={checkoutPayment?.providerRef}
        />
      ) : null}

      <WexPayPanel
        eyebrow="Ayrım"
        title="Müşteri ödeme istekleri ≠ tahsilat"
        description="Aşağıdaki kartlar bildirimdir; Payment kaydı oluşturmaz. Gerçek tahsilat tablosu ayrıdır."
      >
        <WexPayOperationsAlertStrip
          alerts={paymentRequestAlerts}
          emptyHint="Müşteriden gelen açık ödeme isteği yok."
        />
        <Link
          href={`${basePath}/tables?branchId=${encodeURIComponent(activeBranch.id)}`}
          className="mt-4 inline-flex text-xs font-black text-emerald-700 hover:underline"
        >
          Masalarda tahsilat al →
        </Link>
      </WexPayPanel>

      <WexPayPaymentsBoard payments={paymentRows} />

      {context.canOperateCashier && payments.length > 0 && (
        <WexPayPanel title="Ödeme durumu güncelle">
          <div className="grid min-w-0 gap-3">
            {payments.slice(0, 10).map((payment) => {
              const terminalReadOnly = isStaffLimited && isTerminalPaymentStatus(payment.status);
              return (
                <WexPaySurface key={payment.id}>
                  {terminalReadOnly ? (
                    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">{payment.table.label}</p>
                        <p className="text-xs text-slate-500">
                          {Number(payment.amount).toLocaleString("tr-TR")} ₺ · {payment.provider ?? "manual"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {payment.status} · salt okunur
                      </p>
                    </div>
                  ) : (
                    <form
                      action={updatePaymentAction}
                      className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
                    >
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">{payment.table.label}</p>
                        <p className="text-xs text-slate-500">
                          {Number(payment.amount).toLocaleString("tr-TR")} ₺ · {payment.provider ?? "manual"}
                        </p>
                      </div>
                      <label className="block min-w-0">
                        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                          Durum
                        </span>
                        <select
                          name="status"
                          defaultValue={payment.status}
                          className="w-full rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                        >
                          {updateStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <DemoPrimaryButton>Kaydet</DemoPrimaryButton>
                    </form>
                  )}
                </WexPaySurface>
              );
            })}
          </div>
        </WexPayPanel>
      )}

      {context.canOperateCashier &&
        (tables.length === 0 ? (
          <WexPayPanel title="Ödeme kaydet">
            <WexPayEmptyNotice>Ödeme kaydı için bu şubede en az bir aktif masa gereklidir.</WexPayEmptyNotice>
          </WexPayPanel>
        ) : (
          <WexPayPanel title="Ödeme kaydet" description="Operasyonel ödeme kaydı oluşturun.">
            <form action={createPaymentAction} className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input type="hidden" name="branchId" value={activeBranch.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Masa
                </span>
                <select
                  name="tableId"
                  required
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                >
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Sipariş (opsiyonel)
                </span>
                <select
                  name="orderId"
                  defaultValue=""
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                >
                  <option value="">Sipariş bağlama</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNo} · {order.table.label}
                    </option>
                  ))}
                </select>
              </label>
              <DemoInput label="Tutar (TRY)" name="amount" required placeholder="Örn. 250" />
              <WexPayPaymentProviderField showStatusField statusOptions={MANUAL_CREATE_STATUS_OPTIONS} />
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
