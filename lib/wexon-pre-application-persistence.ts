import { parseDemoRequestPayload } from "@/lib/wexon-public-validation";

export type PreApplicationPayload = ReturnType<typeof parseDemoRequestPayload>;

type SavePreApplicationResult =
  | { ok: true; id: string }
  | { ok: false; error: unknown };

export async function savePreApplicationLead(
  payload: PreApplicationPayload,
  ipAddress: string,
): Promise<SavePreApplicationResult> {
  try {
    const { writeAuditLog } = await import("@/lib/wexon-audit");
    const submissionLabel = payload.source === "on-basvuru" ? "ön başvuru" : "demo talebi";

    const row = await writeAuditLog({
      action: "public.demo_request.created",
      entityType: "DemoRequest",
      ipAddress,
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

    return { ok: true, id: row.id };
  } catch (error) {
    console.error("[pre-application] primary database save failed", error);
    return { ok: false, error };
  }
}

async function trySendPreApplicationMail(payload: PreApplicationPayload) {
  // Mail provider is not configured yet; submission must not depend on it.
  void payload;
}

async function tryRecordPreApplicationAnalytics(payload: PreApplicationPayload, leadId: string) {
  void payload;
  void leadId;
}

async function tryWriteSupplementaryAuditLog(
  payload: PreApplicationPayload,
  ipAddress: string,
  leadId: string,
) {
  try {
    const { writeAuditLog } = await import("@/lib/wexon-audit");
    await writeAuditLog({
      action: "public.demo_request.recorded",
      entityType: "DemoRequest",
      entityId: leadId,
      ipAddress,
      source: "pre_application_pipeline",
      message: `Pre-application pipeline recorded ${payload.email}`,
      metadata: {
        leadId,
        source: payload.source,
        product: payload.product,
      },
    });
  } catch (error) {
    console.error("[pre-application] supplementary audit log failed", error);
  }
}

export async function runPreApplicationSideEffects(
  payload: PreApplicationPayload,
  ipAddress: string,
  leadId: string,
) {
  await Promise.allSettled([
    tryWriteSupplementaryAuditLog(payload, ipAddress, leadId),
    trySendPreApplicationMail(payload),
    tryRecordPreApplicationAnalytics(payload, leadId),
  ]);
}
