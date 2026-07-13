import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomerUser } from "@/lib/wexon-customer-auth";

type SearchParams = Promise<{ paymentId?: string }>;

export default async function PaytrBillingSuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const { paymentId } = await searchParams;
  const user = await getCurrentCustomerUser();
  const payment =
    paymentId && user
      ? await prisma.subscriptionPayment.findFirst({
          where: {
            id: paymentId,
            userId: user.id,
          },
          include: { plan: true, subscription: true },
        })
      : null;

  const isPaid = payment?.status === "PAID";
  const isFailed = payment?.status === "FAILED";

  return (
    <main className="min-h-screen bg-[#f6f8f7] px-5 py-16 text-slate-900 sm:px-8">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">PayTR ödeme</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        {isPaid ? "Ödeme alındı" : isFailed ? "Ödeme doğrulanamadı" : "Ödemeniz kontrol ediliyor"}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-600">
        {isPaid
          ? "Aboneliğiniz aktifleştirildi. Dashboard üzerinden ürün erişiminizi yönetebilirsiniz."
          : isFailed
            ? "Ödeme başarısız görünüyor. Tekrar deneyebilir veya destek ile iletişime geçebilirsiniz."
            : "Bu sayfa yalnızca bilgilendirme içindir. Abonelik aktivasyonu PayTR bildirim (callback) doğrulamasından sonra yapılır. Birkaç saniye içinde dashboard’da durumu kontrol edin."}
      </p>
      {payment ? (
        <dl className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Ödeme durumu</dt>
            <dd className="font-semibold">{payment.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Paket</dt>
            <dd className="font-semibold">{payment.plan.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">merchant_oid</dt>
            <dd className="font-mono text-xs">{payment.merchantOid}</dd>
          </div>
        </dl>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard/subscription"
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Aboneliğe git
        </Link>
        <Link
          href="/checkout?product=wexpay"
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Checkout’a dön
        </Link>
      </div>
      </div>
    </main>
  );
}
