import { processPaytrWebhookRequest } from "@/lib/wexpay-paytr-webhook";

/**
 * Inbound PayTR notification URL for operational WexPay payments.
 * WexPay para tutmaz; firmanin kendi PayTR sanal POS anlasmasi uzerinden gelen
 * callback burada dogrulanir ve Payment kaydi guncellenir.
 *
 * PayTR expects plain text "OK" response on success.
 */
export async function POST(request: Request) {
  const result = await processPaytrWebhookRequest(request);
  if (!result.ok) {
    return new Response(result.body, { status: result.status });
  }
  return new Response(result.body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
