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
import { ActivationJourneyError } from "@/lib/wexpay-activation-journey";
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
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function mapError(error: unknown): WizardActionState {
  if (error instanceof ActivationWizardError || error instanceof ActivationJourneyError || error instanceof StaffInviteError) {
    return { ok: false, error: error.message, code: error.code };
  }
  console.error("[activation-wizard]", error instanceof Error ? error.name : "unknown");
  return { ok: false, error: "İşlem tamamlanamadı. Lütfen tekrar deneyin.", code: "UNKNOWN" };
}

async function requireWizardActor(organizationId: string) {
  return assertCustomerOrganizationRole(organizationId, ["OWNER", "ADMIN", "MANAGER"]);
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
    const { user } = await requireWizardActor(organizationId);
    const qr = await rotateWizardTableQr({
      organizationId,
      actorUserId: user.id,
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
