"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  closeTable,
  createBranch,
  createCategory,
  createOrder,
  createPayment,
  createProduct,
  createRestaurant,
  createTable,
  markReceiptPrinted,
  regeneratePaytrCheckout,
  updateBranch,
  updateCategory,
  updateOrderStatus,
  updatePayment,
  updateProduct,
  updateRestaurant,
  updateTable,
  type WexPayMutationContext,
} from "@/lib/wexpay-service";
import { writeAuditFailure } from "@/lib/wexon-audit";
import { resolveWexPaySessionContext, WexPayAccessError } from "@/lib/wexpay-tenant";
import {
  parseBranchCreate,
  parseBranchUpdate,
  parseCategoryCreate,
  parseCategoryUpdate,
  parseOrderCreate,
  parseOrderStatusUpdate,
  parsePaymentCreate,
  parsePaymentUpdate,
  parseProductCreate,
  parseProductUpdate,
  parseRestaurantCreate,
  parseRestaurantUpdate,
  parseTableClose,
  parseTableCreate,
  parseTableReceiptPrinted,
  parseTableUpdate,
  parseProviderCredentialUpsert,
  parseProviderCredentialDeactivate,
  parseProviderCredentialTest,
  WexPayValidationError,
} from "@/lib/wexpay-validation";
import { WexPayProviderNotConfiguredError, WexPayPaymentProviderError } from "@/lib/wexpay-payment-provider";
import {
  deactivateWexPayProviderCredential,
  prepareProviderCredentialUpsert,
  testProviderCredential,
  upsertWexPayProviderCredential,
  WexPayProviderCredentialStorageError,
} from "@/lib/wexpay-provider-credentials";

const RESTAURANTS_PATH = "/apps/wexpay/restaurants";
const BRANCHES_PATH = "/apps/wexpay/branches";
const TABLES_PATH = "/apps/wexpay/tables";
const MENU_PATH = "/apps/wexpay/menu";
const ORDERS_PATH = "/apps/wexpay/orders";
const PAYMENTS_PATH = "/apps/wexpay/payments";
const KITCHEN_PATH = "/apps/wexpay/kitchen";
const SETTINGS_PATH = "/apps/wexpay/settings";
const OVERVIEW_PATH = "/apps/wexpay";

function revalidateWexPayOperations() {
  revalidatePath(OVERVIEW_PATH);
  revalidatePath(TABLES_PATH);
  revalidatePath(ORDERS_PATH);
  revalidatePath(KITCHEN_PATH);
}

function readRedirect(formData: FormData, fallback: string) {
  const value = formData.get("redirectTo");
  return typeof value === "string" && value.startsWith("/apps/wexpay") ? value : fallback;
}

function throwIfRedirectError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}

function resolveWexPayUiErrorMessage(error: unknown): { message: string; reason: string } {
  if (error instanceof WexPayValidationError) {
    return { message: error.message, reason: "validation" };
  }
  if (error instanceof WexPayAccessError) {
    return { message: error.message, reason: error.reason };
  }
  if (error instanceof WexPayProviderNotConfiguredError) {
    return {
      message:
        error.provider === "paytr"
          ? "Sanal POS bağlantısı eksik. Ayarlar bölümünden PayTR sanal POS bilgilerinizi girin."
          : error.message,
      reason: "provider_not_configured",
    };
  }
  if (error instanceof WexPayPaymentProviderError) {
    return { message: error.message, reason: "validation" };
  }
  if (error instanceof WexPayProviderCredentialStorageError) {
    return { message: error.message, reason: "validation" };
  }
  return { message: "İşlem sırasında beklenmeyen bir hata oluştu.", reason: "internal" };
}

function redirectWithError(path: string, error: unknown, context?: WexPayMutationContext): never {
  const { message, reason } = resolveWexPayUiErrorMessage(error);

  writeAuditFailure({
    action: `wexpay.ui.${reason}`,
    message,
    level: reason === "internal" ? "ERROR" : "WARN",
    organizationId: context?.organizationId,
    userId: context?.actor.type === "customer_session" ? context.actor.userId : undefined,
    ipAddress: context?.ipAddress,
    source: "wexpay_ui",
    metadata: { path, reason },
  });

  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}wexpayError=${encodeURIComponent(message)}`);
}

async function getManageContext(): Promise<WexPayMutationContext> {
  const resolved = await resolveWexPaySessionContext({ manage: true });
  if (!resolved.ok) {
    throw new WexPayAccessError(resolved.message, resolved.reason);
  }

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() || null : headerList.get("x-real-ip");

  return {
    organizationId: resolved.organizationId,
    actor: resolved.actor,
    entitlementMap: resolved.entitlementMap,
    canManage: resolved.canManage,
    ipAddress,
  };
}

// --- Restaurant ------------------------------------------------------------

export async function createRestaurantAction(formData: FormData) {
  const redirectTo = readRedirect(formData, RESTAURANTS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseRestaurantCreate(formData);
    context = await getManageContext();
    await createRestaurant(context, input);
    revalidatePath(RESTAURANTS_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateRestaurantAction(formData: FormData) {
  const redirectTo = readRedirect(formData, RESTAURANTS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseRestaurantUpdate(formData);
    context = await getManageContext();
    await updateRestaurant(context, input);
    revalidatePath(RESTAURANTS_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

// --- Branch ----------------------------------------------------------------

export async function createBranchAction(formData: FormData) {
  const redirectTo = readRedirect(formData, BRANCHES_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseBranchCreate(formData);
    context = await getManageContext();
    await createBranch(context, input);
    revalidatePath(BRANCHES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateBranchAction(formData: FormData) {
  const redirectTo = readRedirect(formData, BRANCHES_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseBranchUpdate(formData);
    context = await getManageContext();
    await updateBranch(context, input);
    revalidatePath(BRANCHES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

// --- Table -----------------------------------------------------------------

export async function createTableAction(formData: FormData) {
  const redirectTo = readRedirect(formData, TABLES_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableCreate(formData);
    context = await getManageContext();
    await createTable(context, input);
    revalidatePath(TABLES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateTableAction(formData: FormData) {
  const redirectTo = readRedirect(formData, TABLES_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableUpdate(formData);
    context = await getManageContext();
    await updateTable(context, input);
    revalidatePath(TABLES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function closeTableAction(formData: FormData) {
  const redirectTo = readRedirect(formData, TABLES_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableClose(formData);
    context = await getManageContext();
    await closeTable(context, input);
    revalidateWexPayOperations();
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function markReceiptPrintedAction(formData: FormData) {
  const redirectTo = readRedirect(formData, TABLES_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableReceiptPrinted(formData);
    context = await getManageContext();
    await markReceiptPrinted(context, input);
    revalidateWexPayOperations();
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

// --- Menu category ---------------------------------------------------------

export async function createCategoryAction(formData: FormData) {
  const redirectTo = readRedirect(formData, MENU_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseCategoryCreate(formData);
    context = await getManageContext();
    await createCategory(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateCategoryAction(formData: FormData) {
  const redirectTo = readRedirect(formData, MENU_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseCategoryUpdate(formData);
    context = await getManageContext();
    await updateCategory(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

// --- Menu product ----------------------------------------------------------

export async function createProductAction(formData: FormData) {
  const redirectTo = readRedirect(formData, MENU_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProductCreate(formData);
    context = await getManageContext();
    await createProduct(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateProductAction(formData: FormData) {
  const redirectTo = readRedirect(formData, MENU_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProductUpdate(formData);
    context = await getManageContext();
    await updateProduct(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

// --- Orders ----------------------------------------------------------------

export async function createOrderAction(formData: FormData) {
  const redirectTo = readRedirect(formData, ORDERS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseOrderCreate(formData);
    context = await getManageContext();
    await createOrder(context, input);
    revalidatePath(ORDERS_PATH);
    revalidatePath(TABLES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateOrderStatusAction(formData: FormData) {
  const redirectTo = readRedirect(formData, ORDERS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseOrderStatusUpdate(formData);
    context = await getManageContext();
    await updateOrderStatus(context, input);
    revalidateWexPayOperations();
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

// --- Payments --------------------------------------------------------------

export async function createPaymentAction(formData: FormData) {
  const redirectTo = readRedirect(formData, PAYMENTS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parsePaymentCreate(formData);
    context = await getManageContext();
    const result = await createPayment(context, input);
    revalidatePath(PAYMENTS_PATH);
    revalidatePath(TABLES_PATH);
    if (result.externalCheckoutUrl) {
      const separator = redirectTo.includes("?") ? "&" : "?";
      redirect(
        `${redirectTo}${separator}paytrCheckout=${encodeURIComponent(result.externalCheckoutUrl)}&paymentId=${encodeURIComponent(result.payment.id)}`,
      );
    }
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function regeneratePaytrCheckoutAction(formData: FormData) {
  const redirectTo = readRedirect(formData, PAYMENTS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const paymentId = formData.get("paymentId");
    if (typeof paymentId !== "string" || !paymentId.trim()) {
      throw new WexPayValidationError("Ödeme zorunludur.");
    }
    context = await getManageContext();
    const result = await regeneratePaytrCheckout(context, { paymentId: paymentId.trim() });
    revalidatePath(PAYMENTS_PATH);
    revalidatePath(TABLES_PATH);
    const separator = redirectTo.includes("?") ? "&" : "?";
    redirect(
      `${redirectTo}${separator}paytrCheckout=${encodeURIComponent(result.externalCheckoutUrl)}&paymentId=${encodeURIComponent(result.paymentId)}`,
    );
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updatePaymentAction(formData: FormData) {
  const redirectTo = readRedirect(formData, PAYMENTS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parsePaymentUpdate(formData);
    context = await getManageContext();
    await updatePayment(context, input);
    revalidatePath(PAYMENTS_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

// --- Provider credentials --------------------------------------------------

function credentialAuditContext(context: WexPayMutationContext) {
  return {
    organizationId: context.organizationId,
    userId: context.actor.type === "customer_session" ? context.actor.userId : null,
    ipAddress: context.ipAddress ?? null,
  };
}

export async function upsertProviderCredentialAction(formData: FormData) {
  const redirectTo = readRedirect(formData, SETTINGS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProviderCredentialUpsert(formData);
    context = await getManageContext();
    const prepared = await prepareProviderCredentialUpsert(context.organizationId, input);
    await upsertWexPayProviderCredential(credentialAuditContext(context), {
      provider: input.provider,
      displayName: input.displayName,
      mode: input.mode,
      config: prepared.config,
      primarySecret: prepared.primarySecret,
      isActive: true,
    });
    revalidatePath(SETTINGS_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function deactivateProviderCredentialAction(formData: FormData) {
  const redirectTo = readRedirect(formData, SETTINGS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProviderCredentialDeactivate(formData);
    context = await getManageContext();
    await deactivateWexPayProviderCredential(credentialAuditContext(context), input);
    revalidatePath(SETTINGS_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function testProviderCredentialAction(formData: FormData) {
  const redirectTo = readRedirect(formData, SETTINGS_PATH);
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProviderCredentialTest(formData);
    context = await getManageContext();
    const result = await testProviderCredential(credentialAuditContext(context), input);
    revalidatePath(SETTINGS_PATH);
    const separator = redirectTo.includes("?") ? "&" : "?";
    const status = result.ok ? "ok" : "warn";
    redirect(
      `${redirectTo}${separator}wexpayTest=${status}&wexpayTestMsg=${encodeURIComponent(result.message)}&wexpayTestDetails=${encodeURIComponent(result.details.join(" · "))}`,
    );
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}
