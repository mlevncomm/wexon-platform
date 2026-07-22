"use server";

import { MembershipRole } from ".prisma/client";
import { revalidatePath } from "next/cache";
import {
  saveBusinessProfileStep,
  saveBranchSetupStep,
  createTablesWithOpaqueQr,
  acknowledgeTableQrPack,
  completeStaffInviteWizardStep,
  rotateWizardTableQr,
  recoverWizardTableQrPack,
  ActivationWizardError,
  type WizardIssuedQr,
} from "@/lib/wexpay-activation-wizard";
import {
  createStaffInvite,
  revokeStaffInvite,
  StaffInviteError,
} from "@/lib/wexpay-staff-invite";
import {
  uploadAndDryRunMenuImport,
  applyMenuImportChunk,
  cancelMenuImportJob,
  skipMenuImportEmptyStart,
  MenuImportError,
  type MenuImportJobView,
} from "@/lib/wexpay-menu-import";
import { MenuImportParseError } from "@/lib/wexpay-menu-import-parse";
import { ActivationJourneyError } from "@/lib/wexpay-activation-journey";
import {
  ActivationPaymentProviderError,
  parseActivationPaymentProviderInput,
  saveActivationPaymentProviderStep,
} from "@/lib/wexpay-activation-payment-provider";
import {
  runWexPayActivationValidation,
  type ActivationValidationReport,
} from "@/lib/wexpay-activation-validation";
import { goLiveWexPayActivation } from "@/lib/wexpay-activation-go-live";
import { assertCustomerOrganizationRole } from "@/lib/wexon-customer-auth";
import {
  buildRateLimitKey,
  checkRateLimit,
  RATE_LIMITS,
} from "@/lib/wexon-rate-limit";
import { getServerActionIpAddressSafe } from "@/lib/wexon-server-request";

export type WizardActionState = {
  ok: boolean;
  error?: string;
  code?: string;
  oneTimeInviteUrl?: string | null;
  issuedQrs?: WizardIssuedQr[];
  journeyVersion?: number;
  menuImportJob?: MenuImportJobView;
  /** Menu import: false when more chunks remain — UI should continue. */
  menuImportDone?: boolean;
  message?: string;
  validationReport?: ActivationValidationReport;
  activated?: boolean;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readExpectedVersion(formData: FormData) {
  const raw = readString(formData, "expectedVersion");
  const value = Number(raw);
  if (!raw || !Number.isSafeInteger(value) || value < 1) {
    throw new ActivationJourneyError(
      "INVALID_VERSION",
      "Kurulum sürümü geçersiz. Sayfayı yenileyip tekrar deneyin.",
    );
  }
  return value;
}

function readChecked(formData: FormData, key: string) {
  const value = readString(formData, key).toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

function mapError(error: unknown): WizardActionState {
  if (
    error instanceof ActivationWizardError ||
    error instanceof ActivationJourneyError ||
    error instanceof ActivationPaymentProviderError ||
    error instanceof StaffInviteError ||
    error instanceof MenuImportError ||
    error instanceof MenuImportParseError
  ) {
    return { ok: false, error: error.message, code: error.code };
  }
  console.error("[activation-wizard]", error instanceof Error ? error.name : "unknown");
  return { ok: false, error: "İşlem tamamlanamadı. Lütfen tekrar deneyin.", code: "UNKNOWN" };
}

async function requireWizardActor(organizationId: string) {
  return assertCustomerOrganizationRole(organizationId, ["OWNER", "ADMIN", "MANAGER"]);
}

async function requireGoLiveActor(organizationId: string) {
  return assertCustomerOrganizationRole(organizationId, ["OWNER", "ADMIN"]);
}

export async function saveBusinessProfileAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    await saveBusinessProfileStep({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      name: readString(formData, "name"),
      legalName: readString(formData, "legalName") || null,
      taxNo: readString(formData, "taxNo") || null,
      phone: readString(formData, "phone") || null,
      email: readString(formData, "email") || null,
      country: readString(formData, "country") || "TR",
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true };
  } catch (error) {
    return mapError(error);
  }
}

export async function saveBranchSetupAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    await saveBranchSetupStep({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      restaurantName: readString(formData, "restaurantName"),
      branchName: readString(formData, "branchName"),
      branchAddress: readString(formData, "branchAddress"),
      existingRestaurantId: readString(formData, "existingRestaurantId") || null,
      existingBranchId: readString(formData, "existingBranchId") || null,
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true };
  } catch (error) {
    return mapError(error);
  }
}

export async function createTablesWizardAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    const result = await createTablesWithOpaqueQr({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      branchId: readString(formData, "branchId"),
      count: Number(readString(formData, "count") || "0"),
      prefix: readString(formData, "prefix") || "Masa",
      seats: Number(readString(formData, "seats") || "4"),
      startNumber: Number(readString(formData, "startNumber") || "1"),
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true, issuedQrs: result.qrs, journeyVersion: result.journeyVersion };
  } catch (error) {
    return mapError(error);
  }
}

export async function recoverQrPackAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    const result = await recoverWizardTableQrPack({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true, issuedQrs: result.qrs, journeyVersion: result.journeyVersion };
  } catch (error) {
    return mapError(error);
  }
}

export async function acknowledgeQrPackAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    await acknowledgeTableQrPack({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      branchId: readString(formData, "branchId"),
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true };
  } catch (error) {
    return mapError(error);
  }
}

export async function rotateTableQrWizardAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    const qr = await rotateWizardTableQr({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      tableId: readString(formData, "tableId"),
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true, issuedQrs: [qr] };
  } catch (error) {
    return mapError(error);
  }
}

export async function createStaffInviteAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const { user } = await assertCustomerOrganizationRole(organizationId, ["OWNER", "ADMIN"]);
    const ip = await getServerActionIpAddressSafe();
    const rl = checkRateLimit(
      buildRateLimitKey("staffInviteCreate", `${organizationId}:${ip}`),
      RATE_LIMITS.staffInviteCreate,
    );
    if (!rl.ok) {
      return { ok: false, error: "Çok fazla davet denemesi. Lütfen sonra tekrar deneyin.", code: "RATE_LIMIT" };
    }

    const roleRaw = readString(formData, "role") || "STAFF";
    const role = (Object.values(MembershipRole) as string[]).includes(roleRaw)
      ? (roleRaw as MembershipRole)
      : MembershipRole.STAFF;

    const result = await createStaffInvite({
      organizationId,
      actorUserId: user.id,
      email: readString(formData, "email"),
      role,
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true, oneTimeInviteUrl: result.oneTimeInviteUrl };
  } catch (error) {
    return mapError(error);
  }
}

export async function revokeStaffInviteAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const { user } = await assertCustomerOrganizationRole(organizationId, ["OWNER", "ADMIN"]);
    await revokeStaffInvite({
      organizationId,
      actorUserId: user.id,
      inviteId: readString(formData, "inviteId"),
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true };
  } catch (error) {
    return mapError(error);
  }
}

export async function completeStaffInviteStepAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    await completeStaffInviteWizardStep({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      skip: readString(formData, "skip") === "1",
    });
    revalidatePath("/dashboard/wexpay/activation");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return mapError(error);
  }
}

export async function uploadMenuImportDryRunAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const branchId = readString(formData, "branchId");
    const { user } = await requireWizardActor(organizationId);
    const ip = await getServerActionIpAddressSafe();
    const rl = checkRateLimit(
      buildRateLimitKey("menuImportUpload", `${organizationId}:${ip}`),
      RATE_LIMITS.menuImportUpload,
    );
    if (!rl.ok) {
      return { ok: false, error: "Çok fazla yükleme denemesi. Lütfen sonra tekrar deneyin.", code: "RATE_LIMIT" };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size < 1) {
      return { ok: false, error: "CSV veya XLSX dosyası seçin.", code: "FILE_REQUIRED" };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const job = await uploadAndDryRunMenuImport({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      branchId,
      buffer,
      originalFileName: file.name || "menu.csv",
      forceReimport: readString(formData, "forceReimport") === "1",
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true, menuImportJob: job };
  } catch (error) {
    return mapError(error);
  }
}

export async function applyMenuImportAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const jobId = readString(formData, "jobId");
    const jobExpectedVersion = Number(readString(formData, "jobExpectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    // One chunk (~50 rows) per request — UI continues until done.
    const result = await applyMenuImportChunk({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      jobId,
      jobExpectedVersion,
      confirmApply: readString(formData, "confirmApply") === "1",
      forceReimport: readString(formData, "forceReimport") === "1",
    });
    revalidatePath("/dashboard/wexpay/activation");
    if (result.done) {
      revalidatePath("/dashboard");
    }
    return {
      ok: true,
      menuImportJob: result.job,
      journeyVersion: result.journeyVersion,
      menuImportDone: result.done,
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function cancelMenuImportAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const jobId = readString(formData, "jobId");
    const jobExpectedVersion = Number(readString(formData, "jobExpectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    const job = await cancelMenuImportJob({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      jobId,
      jobExpectedVersion,
    });
    revalidatePath("/dashboard/wexpay/activation");
    return { ok: true, menuImportJob: job };
  } catch (error) {
    return mapError(error);
  }
}

export async function skipMenuImportEmptyStartAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = Number(readString(formData, "expectedVersion") || "0");
    const { user } = await requireWizardActor(organizationId);
    await skipMenuImportEmptyStart({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      confirmEmpty: readString(formData, "confirmEmpty") === "1",
    });
    revalidatePath("/dashboard/wexpay/activation");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return mapError(error);
  }
}

export async function saveActivationPaymentProviderAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = readExpectedVersion(formData);
    const { user } = await requireWizardActor(organizationId);
    const providerInput = parseActivationPaymentProviderInput(formData);
    await saveActivationPaymentProviderStep({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      providerInput,
    });
    revalidatePath("/dashboard/wexpay/activation");
    return {
      ok: true,
      message:
        providerInput.provider === "PAYTR" && process.env.WEXPAY_PAYTR_ENABLE_API !== "true"
          ? "PayTR yapılandırması kaydedildi. Wexon ödeme servisi etkinleştirilene kadar online QR kart ödemesi kapalıdır."
          : "Ödeme yöntemi kaydedildi.",
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function runActivationValidationAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = readExpectedVersion(formData);
    const { user } = await requireWizardActor(organizationId);
    const result = await runWexPayActivationValidation({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
    });
    revalidatePath("/dashboard/wexpay/activation");
    return {
      ok: result.report.failCount === 0,
      code: result.report.failCount === 0 ? undefined : "VALIDATION_FAILED",
      error:
        result.report.failCount > 0
          ? "Bazı kontroller başarısız. Sorunları giderip doğrulamayı yeniden çalıştırın."
          : undefined,
      message:
        result.report.failCount === 0
          ? "Kontroller tamamlandı. Yayına almaya hazırsınız."
          : undefined,
      validationReport: result.report,
      journeyVersion: result.journey.version,
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function goLiveActivationAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
  try {
    const organizationId = readString(formData, "organizationId");
    const expectedVersion = readExpectedVersion(formData);
    const { user } = await requireGoLiveActor(organizationId);
    const result = await goLiveWexPayActivation({
      organizationId,
      actorUserId: user.id,
      expectedVersion,
      confirmed: readChecked(formData, "confirmed"),
      confirmationText: readString(formData, "confirmationText"),
    });
    revalidatePath("/dashboard/wexpay/activation");
    revalidatePath("/dashboard");
    return {
      ok: result.activated,
      activated: result.activated,
      message: result.activated
        ? "WexPay aktivasyonu başarıyla yayına alındı."
        : "Son kontroller değişti. Sorunları giderip tekrar deneyin.",
      error: result.activated
        ? undefined
        : "Yayına alma tamamlanamadı; doğrulama adımına geri dönüldü.",
      code: result.activated ? undefined : "VALIDATION_REGRESSED",
      validationReport: result.report ?? undefined,
      journeyVersion: result.journey.version,
    };
  } catch (error) {
    return mapError(error);
  }
}
