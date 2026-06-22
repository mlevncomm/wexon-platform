import {
  WexPayPaymentProviderError,
  type WexPayPaymentCheckoutContext,
  type WexPayPaymentIntentResult,
  type WexPayPaymentProviderAdapter,
  type WexPayProviderCallbackPayload,
} from "@/lib/wexpay-payment-provider";
import type { WexPayProviderCredentialConfig } from "@/lib/wexpay-provider-credentials";

const NOT_IMPLEMENTED_MESSAGE =
  "Param entegrasyonu henüz aktif değil. Credential kaydı hazır; canlı ödeme yakında.";

export function mapParamCredentialConfig(config: WexPayProviderCredentialConfig) {
  const clientCode = config.merchantId?.trim() || config.clientCode?.trim();
  const clientUsername = config.apiKey?.trim() || config.clientUsername?.trim();
  const clientPassword = (config.secretKey || config.clientPassword || config.secret)?.trim();
  if (!clientCode || !clientUsername || !clientPassword) return null;
  return { clientCode, clientUsername, clientPassword };
}

function guardNotImplemented(_context: WexPayPaymentCheckoutContext): Promise<WexPayPaymentIntentResult> {
  void _context;
  throw new WexPayPaymentProviderError(NOT_IMPLEMENTED_MESSAGE);
}

export function createParamPaymentProviderAdapter(): WexPayPaymentProviderAdapter {
  return {
    key: "param",
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
