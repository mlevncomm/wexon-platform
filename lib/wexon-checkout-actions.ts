"use server";

import { redirect } from "next/navigation";
import { createCustomerSessionCookie, getCurrentCustomerUser, getCustomerSession } from "@/lib/wexon-customer-auth";
import { hashPassword, verifyPassword } from "@/lib/wexon-passwords";
import { prisma } from "@/lib/prisma";
import { computePlanPrice, CheckoutValidationError, parseCheckoutPayload } from "@/lib/wexon-checkout-validation";
import { normalizeSignupSlug } from "@/lib/wexon-signup-validation";

function checkoutError(message: string, productKey = "wexpay", planKey = "standard"): never {
  const params = new URLSearchParams({ product: productKey, plan: planKey, checkoutError: message });
  redirect(`/checkout?${params.toString()}`);
}

function addPeriod(date: Date, interval: "monthly" | "yearly") {
  const next = new Date(date);
  if (interval === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

async function uniqueSlug(name: string) {
  const base = normalizeSignupSlug(name) || "wexon-musteri";
  let candidate = base;
  let index = 2;
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

export async function createMockCheckoutSubscriptionAction(formData: FormData) {
  const customerSession = await getCustomerSession();
  const payload = parseCheckoutPayload(formData, Boolean(customerSession));

  if (process.env.NODE_ENV === "production") {
    checkoutError("Mock ödeme production ortamında devre dışıdır.", payload.productKey, payload.planKey);
  }

  const product = await prisma.product.findUnique({ where: { key: payload.productKey } });
  if (!product || !product.isActive || product.status !== "ACTIVE") checkoutError("Ürün aboneliği şu anda aktif değil.", payload.productKey, payload.planKey);

  const plan = await prisma.plan.findFirst({
    where: {
      productId: product.id,
      isActive: true,
      isPublic: true,
      OR: [{ key: `wexpay_${payload.planKey}` }, { name: { equals: payload.planKey, mode: "insensitive" } }],
    },
  });
  if (!plan) checkoutError("Seçilen paket bulunamadı.", payload.productKey, payload.planKey);

  const now = new Date();
  const periodEnd = addPeriod(now, payload.billingInterval);
  let price;
  try {
    price = computePlanPrice(plan, payload.billingInterval);
  } catch (error) {
    if (error instanceof CheckoutValidationError) checkoutError(error.message, payload.productKey, payload.planKey);
    throw error;
  }
  const interval = payload.billingInterval === "yearly" ? "YEARLY" : "MONTHLY";
  const mockRef = `mock_${Date.now()}`;

  const result = await prisma.$transaction(async (tx) => {
    let user;
    let organization;

    if (customerSession) {
      const currentUser = await getCurrentCustomerUser();
      if (!currentUser || currentUser.memberships.length === 0) throw new CheckoutValidationError("Aktif müşteri oturumu bulunamadı.");
      user = currentUser;
      organization = currentUser.memberships[0].organization;
    } else {
      const existingUser = await tx.user.findUnique({
        where: { email: payload.email },
        include: { memberships: { where: { status: "ACTIVE" }, include: { organization: true }, orderBy: { createdAt: "asc" } } },
      });
      if (existingUser) {
        const valid = existingUser.passwordHash ? await verifyPassword(payload.password, existingUser.passwordHash) : false;
        if (!valid) throw new CheckoutValidationError("E-posta veya şifre hatalı.");
        user = existingUser;
        organization = existingUser.memberships[0]?.organization;
        if (!organization) {
          const slug = await uniqueSlug(payload.organizationName);
          organization = await tx.organization.create({ data: { name: payload.organizationName, slug, email: payload.email, phone: payload.phone, country: payload.country } });
          await tx.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "OWNER", status: "ACTIVE", acceptedAt: now } });
        }
      } else {
        const slug = await uniqueSlug(payload.organizationName);
        const passwordHash = await hashPassword(payload.password);
        organization = await tx.organization.create({ data: { name: payload.organizationName, slug, email: payload.email, phone: payload.phone, country: payload.country } });
        user = await tx.user.create({ data: { email: payload.email, name: payload.name, phone: payload.phone, isActive: true, passwordHash, passwordSetAt: now, mustChangePassword: false } });
        await tx.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "OWNER", status: "ACTIVE", acceptedAt: now } });
      }
    }

    const existingActiveLicense = await tx.license.findFirst({ where: { organizationId: organization.id, productId: product.id, status: "ACTIVE" } });
    if (existingActiveLicense) throw new CheckoutValidationError("Bu organizasyon için aktif WexPay aboneliği zaten bulunuyor.");

    const license = await tx.license.create({ data: { organizationId: organization.id, productId: product.id, planId: plan.id, status: "ACTIVE", licenseType: interval, startsAt: now, endsAt: periodEnd } });
    const subscription = await tx.subscription.create({ data: { organizationId: organization.id, licenseId: license.id, planId: plan.id, status: "ACTIVE", interval, currentPeriodStart: now, currentPeriodEnd: periodEnd, provider: "mock", providerRef: mockRef } });
    const invoice = await tx.invoice.create({ data: { organizationId: organization.id, subscriptionId: subscription.id, invoiceNo: `INV-${Date.now()}`, status: "PAID", subtotal: price.subtotal, tax: price.tax, total: price.total, currency: price.currency, issuedAt: now, paidAt: now } });
    await tx.billingPayment.create({ data: { organizationId: organization.id, subscriptionId: subscription.id, invoiceId: invoice.id, amount: price.total, currency: price.currency, status: "PAID", provider: "mock", providerRef: mockRef, paidAt: now } });
    await tx.appInstallation.upsert({ where: { organizationId_productId: { organizationId: organization.id, productId: product.id } }, update: { status: "ACTIVE", licenseId: license.id, settingsJson: { onboardingStatus: "PENDING_SETUP", message: "Kurulum süreciniz başlatıldı. Ekibimiz 5 iş günü içinde kurulum detaylarını netleştirmek için sizinle iletişime geçecektir.", estimatedBusinessDays: 5, source: "mock_checkout" } }, create: { organizationId: organization.id, productId: product.id, licenseId: license.id, status: "ACTIVE", settingsJson: { onboardingStatus: "PENDING_SETUP", message: "Kurulum süreciniz başlatıldı. Ekibimiz 5 iş günü içinde kurulum detaylarını netleştirmek için sizinle iletişime geçecektir.", estimatedBusinessDays: 5, source: "mock_checkout" } } });

    await tx.auditLog.create({ data: { organizationId: organization.id, userId: user.id, action: "customer.checkout.completed", entityType: "Subscription", entityId: subscription.id, metadataJson: { productKey: payload.productKey, planKey: payload.planKey, billingInterval: payload.billingInterval, mockPayment: true, amount: price.total, currency: price.currency, onboardingStatus: "PENDING_SETUP" } } });
    await tx.auditLog.create({ data: { organizationId: organization.id, userId: user.id, action: "customer.subscription.created", entityType: "Subscription", entityId: subscription.id, metadataJson: { productKey: payload.productKey, planKey: payload.planKey, billingInterval: payload.billingInterval } } });
    await tx.auditLog.create({ data: { organizationId: organization.id, userId: user.id, action: "customer.onboarding.started", entityType: "AppInstallation", entityId: license.id, metadataJson: { onboardingStatus: "PENDING_SETUP", estimatedBusinessDays: 5 } } });

    return { organization, user };
  }).catch((error) => {
    if (error instanceof CheckoutValidationError) checkoutError(error.message, payload.productKey, payload.planKey);
    throw error;
  });

  await createCustomerSessionCookie(result.user.id);
  redirect(`/dashboard?organizationId=${result.organization.id}&checkout=success`);
}
