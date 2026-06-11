"use server";

import { getServerActionIpAddress, writeAuditLog } from "@/lib/wexon-audit";
import { buildRateLimitKey, checkRateLimit } from "@/lib/wexon-rate-limit";
import { parseDemoRequestPayload, PublicValidationError } from "@/lib/wexon-public-validation";

export type DemoRequestFormState = {
  submitted: boolean;
  error: string | null;
};

const initialDemoRequestState: DemoRequestFormState = {
  submitted: false,
  error: null,
};

const publicDemoRequestLimit = { limit: 6, windowMs: 15 * 60 * 1000 };

export async function createDemoRequestAction(
  _prev: DemoRequestFormState,
  formData: FormData,
): Promise<DemoRequestFormState> {
  try {
    const ip = await getServerActionIpAddress();
    const rateKey = buildRateLimitKey("public_demo_request", ip);
    const rate = checkRateLimit(rateKey, publicDemoRequestLimit);
    if (!rate.ok) {
      return {
        submitted: false,
        error: `Çok fazla deneme. ${rate.retryAfterSeconds} saniye sonra tekrar deneyin.`,
      };
    }

    const payload = parseDemoRequestPayload(formData);

    await writeAuditLog({
      action: "public.demo_request.created",
      entityType: "DemoRequest",
      ipAddress: ip,
      source: "demo_request_form",
      message: `${payload.product} demo talebi — ${payload.company}`,
      metadata: {
        fullName: payload.fullName,
        company: payload.company,
        email: payload.email,
        phone: payload.phone,
        product: payload.product,
        message: payload.message,
        status: "NEW",
      },
    });

    return { submitted: true, error: null };
  } catch (error) {
    if (error instanceof PublicValidationError) {
      return { submitted: false, error: error.message };
    }
    console.error("[demo-request] create error", error);
    return {
      submitted: false,
      error: "Talep kaydedilemedi. Lütfen biraz sonra tekrar deneyin.",
    };
  }
}

export { initialDemoRequestState };
