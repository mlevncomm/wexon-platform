"use client";

import { regeneratePaytrCheckoutAction, updatePaymentAction } from "@/lib/wexpay-actions";

export function WexPayPaytrPendingActions({
  paymentId,
  redirectTo,
}: {
  paymentId: string;
  redirectTo: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <form action={regeneratePaytrCheckoutAction}>
        <input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button
          type="submit"
          className="rounded-lg bg-amber-700 px-3 py-2 text-[11px] font-black text-white transition-colors hover:bg-amber-800"
        >
          PayTR ekranını yenile
        </button>
      </form>
      <form action={updatePaymentAction}>
        <input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="status" value="FAILED" />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button
          type="submit"
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold text-amber-900 transition-colors hover:bg-amber-100"
        >
          Başarısız işaretle
        </button>
      </form>
    </div>
  );
}
