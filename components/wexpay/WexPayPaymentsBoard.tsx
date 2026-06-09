"use client";

import { PaymentStatus } from ".prisma/client";
import {
  formatLira,
  PaymentStatusBadge,
  WexPayEmptyNotice,
  WexPayMetricCard,
  WexPayPage,
  WexPayPanel,
  WexPaySurface,
} from "@/components/wexpay/WexPayBusinessUI";

type PaymentRow = {
  id: string;
  amount: number;
  status: PaymentStatus;
  provider: string | null;
  tableLabel: string;
  orderNo: string | null;
  createdAt: string;
};

export default function WexPayPaymentsBoard({ payments }: { payments: PaymentRow[] }) {
  const paidPayments = payments.filter((payment) => payment.status === PaymentStatus.PAID);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPayments = paidPayments.filter((payment) => new Date(payment.createdAt) >= today);
  const todayTotal = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const averagePayment = paidPayments.length > 0
    ? paidPayments.reduce((sum, payment) => sum + payment.amount, 0) / paidPayments.length
    : 0;
  const lastPayment = payments[0];

  const rows = [
    { label: "Bugünkü toplam ödeme", value: formatLira(todayTotal), detail: `${todayPayments.length} işlem`, accent: todayTotal > 0 },
    { label: "Başarılı ödeme sayısı", value: String(paidPayments.length), detail: "Tamamlanan ödeme", accent: paidPayments.length > 0 },
    { label: "Toplam kayıt", value: String(payments.length), detail: "Tüm ödeme kayıtları", accent: payments.length > 0 },
    { label: "Ortalama ödeme", value: formatLira(averagePayment), detail: "Başarılı ödemeler", accent: averagePayment > 0 },
    {
      label: "Son işlem tutarı",
      value: lastPayment ? formatLira(lastPayment.amount) : formatLira(0),
      detail: lastPayment?.tableLabel ?? "Henüz işlem yok",
      accent: Boolean(lastPayment),
    },
  ];

  return (
    <WexPayPage>
      <WexPayPanel
        eyebrow="Operasyon"
        title="Ödeme özeti"
        description="Operasyonel WexPay ödeme kayıtları. Core faturalandırmasından ayrıdır."
        headerAction={
          <span className="rounded-full border border-emerald-300/30 bg-emerald-500/20 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-emerald-100">
            Canlı
          </span>
        }
      >
        <div className="grid gap-3 rounded-2xl bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-5 sm:p-5">
          {rows.map((row) => (
            <WexPayMetricCard key={row.label} label={row.label} value={row.value} detail={row.detail} accent={row.accent} />
          ))}
        </div>
      </WexPayPanel>

      <WexPayPanel eyebrow="Hareketler" title="Son ödeme hareketleri">
        <div className="space-y-3">
          {payments.length === 0 && <WexPayEmptyNotice>Gösterilecek ödeme bulunmuyor.</WexPayEmptyNotice>}
          {payments.map((payment) => (
            <WexPaySurface key={payment.id} className="transition-colors hover:border-emerald-200/80">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-slate-950">{payment.provider ?? "Operasyonel ödeme"}</p>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {payment.tableLabel}
                    {payment.orderNo ? ` · Sipariş ${payment.orderNo}` : " · Masa ödemesi"} ·{" "}
                    {new Date(payment.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-black text-slate-950">{formatLira(payment.amount)}</p>
              </div>
            </WexPaySurface>
          ))}
        </div>
      </WexPayPanel>
    </WexPayPage>
  );
}
