"use server";

import { redirect } from "next/navigation";
import { createCustomerSessionCookie } from "@/lib/wexon-customer-auth";
import { hashPassword } from "@/lib/wexon-passwords";
import { prisma } from "@/lib/prisma";
import { normalizeSignupSlug, parseCustomerSignupPayload, SignupValidationError } from "@/lib/wexon-signup-validation";

function redirectSignupError(message: string): never {
  const params = new URLSearchParams({ signupError: message });
  redirect(`/signup?${params.toString()}`);
}

async function uniqueOrganizationSlug(name: string) {
  const base = normalizeSignupSlug(name) || "wexon-musteri";
  let candidate = base;
  let index = 2;

  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

export async function createCustomerSignupAction(formData: FormData) {
  try {
    const payload = parseCustomerSignupPayload(formData);
    const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existingUser) throw new SignupValidationError("Bu e-posta ile kayıtlı bir kullanıcı var.");

    const passwordHash = await hashPassword(payload.password);
    const slug = await uniqueOrganizationSlug(payload.organizationName);

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: payload.organizationName,
          slug,
          email: payload.email,
          phone: payload.phone,
          country: payload.country,
          isActive: true,
          isDemo: false,
        },
      });

      const user = await tx.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          phone: payload.phone,
          isActive: true,
          passwordHash,
          passwordSetAt: new Date(),
          mustChangePassword: false,
        },
      });

      await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          action: "customer.signup.created",
          entityType: "Organization",
          entityId: organization.id,
          metadataJson: {
            source: "public_signup",
            productInterest: payload.productInterest,
          },
        },
      });

      return { organization, user };
    });

    await createCustomerSessionCookie(result.user.id);
    redirect(`/dashboard?organizationId=${result.organization.id}`);
  } catch (error) {
    if (error instanceof SignupValidationError) redirectSignupError(error.message);
    throw error;
  }
}
