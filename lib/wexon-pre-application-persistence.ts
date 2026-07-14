import { parseDemoRequestPayload, PublicValidationError } from "@/lib/wexon-public-validation";
import {
  applicantFacingEligibilityMessage,
  evaluateWexPayEligibility,
} from "@/lib/wexpay-eligibility";
import { resolveWexPayTierKey } from "@/lib/wexpay-tier-config";

export type PreApplicationPayload = ReturnType<typeof parseDemoRequestPayload>;

type SavePreApplicationResult =
  | { ok: true; id: string; applicantMessage?: string }
  | { ok: false; error: unknown };

export async function savePreApplicationLead(
  payload: PreApplicationPayload,
  ipAddress: string,
): Promise<SavePreApplicationResult> {
  try {
    const { writeAuditLog } = await import("@/lib/wexon-audit");
    const { prisma } = await import("@/lib/prisma");
    const submissionLabel = payload.source === "on-basvuru" ? "ön başvuru" : "demo talebi";

    if (payload.preferredTier) {
      const tierKey = resolveWexPayTierKey(payload.preferredTier);
      if (tierKey) {
        const plan = await prisma.plan.findFirst({
          where: {
            product: { key: "wexpay" },
            OR: [{ tierKey }, { key: `wexpay_${tierKey}` }, { key: payload.preferredTier }],
          },
        });
        if (plan && (!plan.isActive || !plan.isPublic)) {
          throw new PublicValidationError(
            "Seçilen paket şu anda başvuruya açık değil. Lütfen başka bir paket seçin veya ekibimizle iletişime geçin.",
          );
        }
      }
    }

    const eligibility =
      payload.product === "WexPay" || payload.intent === "eligibility"
        ? evaluateWexPayEligibility({
            companyType: payload.companyType,
            sector: payload.sector,
            monthlyGmvBand: payload.monthlyGmvBand,
            locationCount: payload.locationCount,
            avgTicket: payload.avgTicket,
            onlineOfflineSplit: payload.onlineOfflineSplit,
            needsSubscriptions: payload.needsSubscriptions,
            needsQr: payload.needsQr,
            needsIntegration: payload.needsIntegration,
            needsMarketplaceOrPayout: payload.needsMarketplaceOrPayout,
            preferredTier: payload.preferredTier,
          })
        : null;

    const applicantMessage = eligibility ? applicantFacingEligibilityMessage(eligibility) : undefined;

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
        plan: payload.preferredTier,
        intent: payload.intent,
        companyType: payload.companyType,
        sector: payload.sector,
        monthlyGmvBand: payload.monthlyGmvBand,
        locationCount: payload.locationCount,
        avgTicket: payload.avgTicket,
        onlineOfflineSplit: payload.onlineOfflineSplit,
        needsSubscriptions: payload.needsSubscriptions,
        needsQr: payload.needsQr,
        needsIntegration: payload.needsIntegration,
        needsMarketplaceOrPayout: payload.needsMarketplaceOrPayout,
        recommendedTier: eligibility?.recommendedTier ?? null,
        reviewStatus: eligibility?.reviewStatus ?? null,
        riskReasons: eligibility?.riskReasons ?? null,
        leadStatus: "new",
        status: "NEW",
      },
    });

    return { ok: true, id: row.id, applicantMessage };
  } catch (error) {
    if (error instanceof PublicValidationError) {
      throw error;
    }
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
