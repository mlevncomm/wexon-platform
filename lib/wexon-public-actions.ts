"use server";

import { Prisma } from "@prisma/client";
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

function resolvePublicSubmissionError(error: unknown, source?: string) {
  if (error instanceof PublicValidationError) {
    return error.message;
  }

  const prismaCode =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;

  if (
    prismaCode === "P1001" ||
    prismaCode === "P1000" ||
    prismaCode === "P1017" ||
    prismaCode === "ECONNREFUSED" ||
    prismaCode === "ENOTFOUND"
  ) {
    return source === "on-basvuru"
      ? "Ön başvuru şu anda kaydedilemiyor. Veritabanı bağlantısı kurulamadı. Lütfen kısa süre sonra tekrar deneyin."
      : "Talep şu anda kaydedilemiyor. Veritabanı bağlantısı kurulamadı. Lütfen kısa süre sonra tekrar deneyin.";
  }

  console.error("[demo-request] create error", error);
  return source === "on-basvuru"
    ? "Ön başvuru kaydedilemedi. Lütfen bilgilerinizi kontrol edip tekrar deneyin."
    : "Talep kaydedilemedi. Lütfen biraz sonra tekrar deneyin.";
}

export async function createDemoRequestAction(
  _prev: DemoRequestFormState,
  formData: FormData,
): Promise<DemoRequestFormState> {
  let source = "direct";

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
    source = payload.source;

    const submissionLabel = payload.source === "on-basvuru" ? "ön başvuru" : "demo talebi";

    await writeAuditLog({
      action: "public.demo_request.created",
      entityType: "DemoRequest",
      ipAddress: ip,
      source: "demo_request_form",
      message: `${payload.product} ${submissionLabel} — ${payload.company}`,
      metadata: {
        fullName: payload.fullName,
        company: payload.company,
        email: payload.email,
        phone: payload.phone,
        product: payload.product,
        message: payload.message,
        source: payload.source,
        leadStatus: "new",
        status: "NEW",
      },
    });

    return { submitted: true, error: null };
  } catch (error) {
    return {
      submitted: false,
      error: resolvePublicSubmissionError(error, source),
    };
  }
}

export { initialDemoRequestState };
