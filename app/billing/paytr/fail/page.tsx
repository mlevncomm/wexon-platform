import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomerUser } from "@/lib/wexon-customer-auth";

type SearchParams = Promise<{ paymentId?: string }>;

export default async function PaytrBillingFailPage({ searchParams }: { searchParams: SearchParams }) {
  const { paymentId } = await searchParams;
  const user = await getCurrentCustomerUser();
  const payment =
    paymentId && user
      ? await prisma.subscriptionPayment.findFirst({
          where: { id: paymentId, userId: user.id },
          include: { plan: true },
        })
      : null;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-6 py-16 text-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-700">Ödeme başarısız</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Ödeme tamamlanamadı</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-600">
        Bu sayfa yalnızca bilgilendirme içindir. Kesin başarısız durumu PayTR callback ile kaydedilir. Abonelik
        aktifleştirilmez. Kartınızdan tahsilat olmadıysa tekrar deneyebilirsiniz.
      </p>
      {payment ? (
        <dl className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Durum</dt>
            <dd className="font-semibold">{payment.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Paket</dt>
            <dd className="font-semibold">{payment.plan.name}</dd>
          </div>
          {payment.failedReasonMsg ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Neden</dt>
              <dd className="text-right font-medium text-rose-700">{payment.failedReasonMsg}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/checkout?product=wexpay${payment ? `&plan=${encodeURIComponent(payment.plan.key.replace(/^wexpay_/, ""))}` : ""}`}
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Tekrar dene
        </Link>
        <Link href="/dashboard" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
