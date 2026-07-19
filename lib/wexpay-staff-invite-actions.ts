"use server";

import { acceptStaffInvite, lookupStaffInviteByPlaintext, StaffInviteError } from "@/lib/wexpay-staff-invite";
import {
  buildRateLimitKey,
  checkRateLimit,
  RATE_LIMITS,
} from "@/lib/wexon-rate-limit";
import { getServerActionIpAddressSafe } from "@/lib/wexon-server-request";
import { createCustomerSessionCookie, getCustomerSession } from "@/lib/wexon-customer-auth";
import { redirect } from "next/navigation";
import { customerLoginUrl } from "@/lib/wexon/urls";

export type InviteAcceptState = {
  ok: boolean;
  error?: string;
  code?: string;
  /** Safe relative path for login redirect when LOGIN_REQUIRED. */
  loginNext?: string;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Only allow relative invite paths — no open redirects. */
function safeInviteNextPath(token: string): string {
  const cleaned = token.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
  return `/invite/${cleaned}`;
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

    const session = await getCustomerSession();
    const result = await acceptStaffInvite({
      plaintextToken: token,
      email,
      name: readString(formData, "name") || undefined,
      password: readString(formData, "password") || undefined,
      customerSession: session,
    });

    if (result.shouldCreateSession) {
      await createCustomerSessionCookie(result.userId);
    }

    redirect(`/dashboard?organizationId=${encodeURIComponent(result.organizationId)}`);
  } catch (error) {
    if (error instanceof StaffInviteError) {
      if (error.code === "LOGIN_REQUIRED") {
        const token = readString(formData, "token");
        return {
          ok: false,
          error: error.message,
          code: "LOGIN_REQUIRED",
          loginNext: safeInviteNextPath(token),
        };
      }
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
  const nextRaw = readString(formData, "next");
  // Canonical relative path only
  const next =
    nextRaw.startsWith("/invite/") && !nextRaw.includes("//") && !nextRaw.includes("\\")
      ? nextRaw.slice(0, 200)
      : "/dashboard";
  redirect(customerLoginUrl({ next }));
}
