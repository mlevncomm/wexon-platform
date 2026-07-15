"use client";

import { PaymentStatus } from ".prisma/client";
import {
  formatLira,
  PaymentStatusBadge,
  WexPayEmptyNotice,
  WexPayMetricCard,
  WexPayPage,
  WexPayPanel,
  WexPayTableShell,
} from "@/components/wexpay/WexPayBusinessUI";
import { formatWexPayPaymentProvider } from "@/lib/wexpay-payment-display";

type PaymentRow = {
  id: string;
  amount: number;
  status: PaymentStatus;
  provider: string | null;
  providerRef: string | null;
  tableLabel: string;
  orderNo: string | null;
  createdAt: string;
};

function maskRef(value: string | null) {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function WexPayPaymentsBoard({ payments }: { payments: PaymentRow[] }) {
  const paidPayments = payments.filter((payment) => payment.status === PaymentStatus.PAID);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPayments = paidPayments.filter((payment) => new Date(payment.createdAt) >= today);
  const todayTotal = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const averagePayment =
    paidPayments.length > 0
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
        description="Operasyonel WexPay ödeme kayıtları. Core faturalandırmasından ayrıdır. Sağlayıcı referansları maskelenir."
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
        {payments.length === 0 ? (
          <WexPayEmptyNotice>Gösterilecek ödeme bulunmuyor.</WexPayEmptyNotice>
        ) : (
          <WexPayTableShell>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-slate-400">
                <tr>
                  <th className="font-black">Sağlayıcı</th>
                  <th className="font-black">Masa</th>
                  <th className="font-black">Referans</th>
                  <th className="font-black">Tarih</th>
                  <th className="font-black">Durum</th>
                  <th className="font-black">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-bold text-slate-950">{formatWexPayPaymentProvider(payment.provider)}</td>
                    <td className="font-semibold text-slate-600">
                      {payment.tableLabel}
                      {payment.orderNo ? ` · ${payment.orderNo}` : ""}
                    </td>
                    <td className="font-mono text-xs font-semibold text-slate-500">{maskRef(payment.providerRef) ?? "—"}</td>
                    <td className="whitespace-nowrap font-semibold text-slate-600">
                      {new Date(payment.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td>
                      <PaymentStatusBadge status={payment.status} />
                    </td>
                    <td className="font-black text-slate-950">{formatLira(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </WexPayTableShell>
        )}
      </WexPayPanel>
    </WexPayPage>
  );
}
