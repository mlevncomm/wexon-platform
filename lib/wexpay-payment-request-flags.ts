/**
 * Controlled rollout for payment-request v2 (PLAN §12).
 * Both global kill-switch and org allowlist must be true.
 */

import type { EnvMap } from "@/lib/wexon-deploy-env";

function parseTruthyFlag(value: string | undefined): boolean {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed === "true" || trimmed === "1" || trimmed === "yes" || trimmed === "on";
}

/** Global kill-switch — default false when unset. */
export function isPaymentRequestV2GlobalEnabled(env: EnvMap = process.env): boolean {
  return parseTruthyFlag(env.WEXPAY_PAYMENT_REQUEST_V2_ENABLED);
}

export function isPaymentRequestV2Enabled(input: {
  organizationPaymentRequestV2Enabled: boolean;
  env?: EnvMap;
}): boolean {
  return (
    isPaymentRequestV2GlobalEnabled(input.env ?? process.env) &&
    input.organizationPaymentRequestV2Enabled === true
  );
}
