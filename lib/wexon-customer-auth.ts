import { createHmac, timingSafeEqual } from "crypto";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieClearOptions, sessionCookieOptions } from "@/lib/wexon-canonical-host";
import { customerLoginUrl } from "@/lib/wexon/urls";
import { prisma } from "@/lib/prisma";

export const CUSTOMER_SESSION_COOKIE = "wexon_customer_session";
const SESSION_TTL_MS = 10 * 60 * 60 * 1000;

export type CustomerSession = {
  userId: string;
  expiresAt: number;
};

function customerLoginRedirect(message: string): never {
  redirect(customerLoginUrl({ customerError: message }));
}

type CustomerUserWithMemberships = Prisma.UserGetPayload<{
  include: {
    memberships: {
      where: { status: "ACTIVE" };
      include: { organization: true };
      orderBy: { createdAt: "asc" };
    };
  };
}>;

type CustomerResolveResult =
  | { user: CustomerUserWithMemberships | null; organizationId: null; reason: "inactive_user" | "missing_membership" | "forbidden" }
  | { user: CustomerUserWithMemberships; organizationId: string; reason: "selected" | "default" };

function getSessionSecret() {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) {
    throw new Error("CUSTOMER_SESSION_SECRET tanımlı olmalıdır.");
  }
  return secret;
}

function signSession(userId: string, expiresAt: number) {
  return createHmac("sha256", getSessionSecret()).update(`${userId}.${expiresAt}`).digest("hex");
}

function verifySignature(userId: string, expiresAt: number, signature: string) {
  const expected = signSession(userId, expiresAt);
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function parseSessionCookie(value: string | undefined): CustomerSession | null {
  if (!value) return null;

  const [encodedUserId, expiresAtValue, signature] = value.split(".");
  const userId = encodedUserId ? Buffer.from(encodedUserId, "base64url").toString("utf8") : null;
  const expiresAt = Number(expiresAtValue);

  if (!userId || !expiresAt || !signature) return null;
  if (expiresAt < Date.now()) return null;
  if (!verifySignature(userId, expiresAt, signature)) return null;

  return { userId, expiresAt };
}

export const getCustomerSession = cache(async function getCustomerSession() {
  const cookieStore = await cookies();
  return parseSessionCookie(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value);
});

export async function assertCustomerSession() {
  const session = await getCustomerSession();
  if (!session) {
    redirect(customerLoginUrl());
  }
  return session;
}

export async function createCustomerSessionCookie(userId: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const signature = signSession(userId, expiresAt);
  const encodedUserId = Buffer.from(userId, "utf8").toString("base64url");
  const cookieStore = await cookies();

  cookieStore.set(CUSTOMER_SESSION_COOKIE, `${encodedUserId}.${expiresAt}.${signature}`, sessionCookieOptions(new Date(expiresAt)));
}

export async function clearCustomerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, "", sessionCookieClearOptions());
}

export const getCurrentCustomerUser = cache(async function getCurrentCustomerUser() {
  const session = await getCustomerSession();
  if (!session) return null;

  // Shell + role gates only need membership/org identity — not the full license graph.
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          organizationId: true,
          role: true,
          status: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              email: true,
              phone: true,
              country: true,
              isActive: true,
              isDemo: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
});

export async function resolveCustomerOrganization(
  selector: { organizationId?: string; organizationSlug?: string } | undefined,
  session: CustomerSession,
): Promise<CustomerResolveResult> {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          organization: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user || !user.isActive) {
    return { user: null, organizationId: null, reason: "inactive_user" as const };
  }

  const activeMemberships = user.memberships;
  if (activeMemberships.length === 0) {
    return { user, organizationId: null, reason: "missing_membership" as const };
  }

  const requestedOrganizationId = selector?.organizationId?.trim();
  const requestedOrganizationSlug = selector?.organizationSlug?.trim();

  if (requestedOrganizationId) {
    const membership = activeMemberships.find((item) => item.organizationId === requestedOrganizationId);
    return membership
      ? { user, organizationId: membership.organizationId, reason: "selected" as const }
      : { user, organizationId: null, reason: "forbidden" as const };
  }

  if (requestedOrganizationSlug) {
    const membership = activeMemberships.find((item) => item.organization.slug === requestedOrganizationSlug);
    return membership
      ? { user, organizationId: membership.organizationId, reason: "selected" as const }
      : { user, organizationId: null, reason: "forbidden" as const };
  }

  return { user, organizationId: activeMemberships[0].organizationId, reason: "default" as const };
}

export async function assertCustomerDashboardAccess(selector?: { organizationId?: string; organizationSlug?: string }) {
  const session = await assertCustomerSession();
  const resolved = await resolveCustomerOrganization(selector, session);

  if (resolved.reason === "inactive_user") {
    customerLoginRedirect("Kullanıcı hesabı pasif durumda.");
  }

  if (resolved.reason === "missing_membership") {
    customerLoginRedirect("Aktif üyelik bulunamadı.");
  }

  if (resolved.reason === "forbidden") {
    redirect("/unauthorized");
  }

  if (!resolved.user || !resolved.organizationId) {
    customerLoginRedirect("Aktif üyelik bulunamadı.");
  }

  const membership =
    resolved.user.memberships.find((item) => item.organizationId === resolved.organizationId) ?? null;

  return { session, user: resolved.user, organizationId: resolved.organizationId, membership };
}

export function canUpdateOrganization(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageOrganizationUsers(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function assertCustomerOrganizationRole(organizationId: string, allowedRoles: string[]) {
  const session = await assertCustomerSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        where: { organizationId, status: "ACTIVE" },
        include: { organization: true },
        take: 1,
      },
    },
  });

  if (!user || !user.isActive) {
    redirect(customerLoginUrl());
  }

  const membership = user.memberships[0];
  if (!membership) {
    redirect("/unauthorized");
  }

  if (!allowedRoles.includes(membership.role)) {
    redirect("/unauthorized");
  }

  return { session, user, membership };
}
