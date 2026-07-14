"use server";

import { buildRateLimitKey, checkRateLimit } from "@/lib/wexon-rate-limit";
import type { DemoRequestFormState } from "@/lib/wexon-demo-request-form-state";
import { resolvePreApplicationSubmissionError } from "@/lib/wexon-pre-application-errors";
import {
  runPreApplicationSideEffects,
  savePreApplicationLead,
} from "@/lib/wexon-pre-application-persistence";
import { parseDemoRequestPayload, PublicValidationError } from "@/lib/wexon-public-validation";
import { getServerActionIpAddressSafe } from "@/lib/wexon-server-request";

const publicDemoRequestLimit = { limit: 6, windowMs: 15 * 60 * 1000 };

function failureState(message: string): DemoRequestFormState {
  return {
    success: false,
    submitted: false,
    error: message,
    message,
  };
}

function successState(applicantMessage?: string | null): DemoRequestFormState {
  return {
    success: true,
    submitted: true,
    error: null,
    message: null,
    applicantMessage: applicantMessage ?? null,
  };
}

export async function createDemoRequestAction(
  _prev: DemoRequestFormState,
  formData: FormData,
): Promise<DemoRequestFormState> {
  let source = "direct";

  try {
    const ip = await getServerActionIpAddressSafe();
    const rateKey = buildRateLimitKey("public_demo_request", ip);
    const rate = checkRateLimit(rateKey, publicDemoRequestLimit);
    if (!rate.ok) {
      return failureState(`Çok fazla deneme. ${rate.retryAfterSeconds} saniye sonra tekrar deneyin.`);
    }

    const payload = parseDemoRequestPayload(formData);
    source = payload.source;

    const saved = await savePreApplicationLead(payload, ip);
    if (!saved.ok) {
      return failureState(resolvePreApplicationSubmissionError(saved.error, source));
    }

    void runPreApplicationSideEffects(payload, ip, saved.id);

    return successState(saved.applicantMessage);
  } catch (error) {
    console.error("[pre-application] unhandled submission error", error);

    if (error instanceof PublicValidationError) {
      return failureState(error.message);
    }

    return failureState(resolvePreApplicationSubmissionError(error, source));
  }
}
