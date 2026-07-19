"use server";

import { acceptStaffInvite, lookupStaffInviteByPlaintext, StaffInviteError } from "@/lib/wexpay-staff-invite";
import {
  buildRateLimitKey,
  checkRateLimit,
  RATE_LIMITS,
} from "@/lib/wexon-rate-limit";
import { getServerActionIpAddressSafe } from "@/lib/wexon-server-request";
import { createCustomerSessionCookie } from "@/lib/wexon-customer-auth";
import { redirect } from "next/navigation";
import { customerLoginUrl } from "@/lib/wexon/urls";

export type InviteAcceptState = {
  ok: boolean;
  error?: string;
  code?: string;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function acceptStaffInviteAction(
  _prev: InviteAcceptState,
  formData: FormData,
): Promise<InviteAcceptState> {
  try {
    const ip = await getServerActionIpAddressSafe();
    const rl = checkRateLimit(
      buildRateLimitKey("staffInviteAccept", ip),
      RATE_LIMITS.staffInviteAccept,
    );
    if (!rl.ok) {
      return { ok: false, error: "Çok fazla deneme. Lütfen sonra tekrar deneyin.", code: "RATE_LIMIT" };
    }

    const token = readString(formData, "token");
    const email = readString(formData, "email");
    const lookup = await lookupStaffInviteByPlaintext(token);
    if (!lookup.ok) {
      return { ok: false, error: "Davet geçersiz veya süresi dolmuş.", code: lookup.code };
    }

    const result = await acceptStaffInvite({
      plaintextToken: token,
      email,
      name: readString(formData, "name") || undefined,
      password: readString(formData, "password") || undefined,
    });

    await createCustomerSessionCookie(result.userId);
    redirect(`/dashboard?organizationId=${encodeURIComponent(result.organizationId)}`);
  } catch (error) {
    if (error instanceof StaffInviteError) {
      if (error.code === "EMAIL_MISMATCH") {
        return { ok: false, error: "E-posta davet ile eşleşmiyor.", code: error.code };
      }
      return { ok: false, error: error.message, code: error.code };
    }
    // Next.js redirect throws
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: "Davet kabul edilemedi.", code: "UNKNOWN" };
  }
}

export async function inviteLoginRedirectAction(formData: FormData) {
  const next = readString(formData, "next") || "/dashboard";
  redirect(customerLoginUrl({ next }));
}
