import {
  WexPayPaymentProviderError,
  type WexPayPaymentCheckoutContext,
  type WexPayPaymentIntentResult,
  type WexPayPaymentProviderAdapter,
  type WexPayProviderCallbackPayload,
} from "@/lib/wexpay-payment-provider";
import type { WexPayProviderCredentialConfig } from "@/lib/wexpay-provider-credentials";

const NOT_IMPLEMENTED_MESSAGE =
  "iyzico entegrasyonu henüz aktif değil. Credential kaydı hazır; canlı ödeme yakında.";

export function mapIyzicoCredentialConfig(config: WexPayProviderCredentialConfig) {
  const apiKey = config.apiKey?.trim();
  const secretKey = (config.secretKey || config.secret)?.trim();
  const merchantId = config.merchantId?.trim();
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey, merchantId: merchantId ?? null };
}

function guardNotImplemented(_context: WexPayPaymentCheckoutContext): Promise<WexPayPaymentIntentResult> {
  void _context;
  throw new WexPayPaymentProviderError(NOT_IMPLEMENTED_MESSAGE);
}

export function createIyzicoPaymentProviderAdapter(): WexPayPaymentProviderAdapter {
  return {
    key: "iyzico",
    createPaymentIntent: guardNotImplemented,
    createCheckoutSession: guardNotImplemented,
    async verifyCallback(_payload: WexPayProviderCallbackPayload) {
      void _payload;
      throw new WexPayPaymentProviderError(NOT_IMPLEMENTED_MESSAGE);
    },
    mapProviderStatus() {
      throw new WexPayPaymentProviderError(NOT_IMPLEMENTED_MESSAGE);
    },
  };
}
