import Link from "next/link";
import { appNavigationUrl } from "@/lib/wexon/urls";

export function WexPayPaytrCheckoutNotice({
  checkoutUrl,
  paymentId,
  providerRef,
}: {
  checkoutUrl: string;
  paymentId?: string | null;
  providerRef?: string | null;
}) {
  return (
    <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm shadow-emerald-900/5">
      <p className="text-sm font-black text-emerald-900">PayTR ödeme oturumu oluşturuldu</p>
      <p className="mt-1 text-xs font-medium leading-relaxed text-emerald-800/90">
        Müşteri kart bilgilerini PayTR güvenli ödeme ekranında girer. Tahsilat tamamlandığında webhook ile
        operasyonel ödeme kaydı otomatik güncellenir; WexPay para tutmaz.
      </p>
      {(paymentId || providerRef) && (
        <p className="mt-2 font-mono text-[11px] font-semibold text-emerald-900/80">
          {paymentId ? `Kayıt: ${paymentId}` : null}
          {paymentId && providerRef ? " · " : null}
          {providerRef ? `merchant_oid: ${providerRef}` : null}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl bg-[#48e050] px-4 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-600/25 transition-colors hover:bg-[#48e050]"
        >
          PayTR ödeme ekranını aç
        </a>
        <Link
          href={appNavigationUrl("/apps/wexpay/payments")}
          className="inline-flex rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-50"
        >
          Ödeme kayıtlarına git
        </Link>
      </div>
    </div>
  );
}

export function WexPayPaytrPendingNotice({
  providerRef,
  actions,
}: {
  providerRef?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 ring-1 ring-amber-100">
      <p className="text-xs font-black text-amber-900">PayTR ödeme bekleniyor</p>
      <p className="mt-1 text-[11px] font-medium leading-relaxed text-amber-800/90">
        Sanal POS oturumu tamamlanana kadar masa PAYMENT_PENDING durumunda kalır. Webhook sonucu gelince kayıt
        otomatik PAID veya FAILED olur.
      </p>
      {providerRef ? (
        <p className="mt-2 font-mono text-[10px] font-semibold text-amber-900/80">merchant_oid: {providerRef}</p>
      ) : null}
      {actions}
    </div>
  );
}
