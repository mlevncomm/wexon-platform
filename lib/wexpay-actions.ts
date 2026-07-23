"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  closeTable,
  createBranch,
  createCategory,
  createModifierGroup,
  createModifierOption,
  createOrder,
  createPayment,
  createProduct,
  createRestaurant,
  createTable,
  createTablesBulk,
  markReceiptPrinted,
  regeneratePaytrCheckout,
  setProductModifierGroups,
  updateBranch,
  updateCategory,
  updateModifierGroup,
  updateModifierOption,
  updateOrderStatus,
  updatePayment,
  updateProduct,
  updateRestaurant,
  updateTable,
  type WexPayMutationContext,
} from "@/lib/wexpay-service";
import { writeAuditFailure } from "@/lib/wexon-audit";
import { resolveSafeWexPayRedirectPath, wexpayAdminPreviewBasePath } from "@/lib/wexon-admin-preview-path";
import {
  assertAdminPreviewWriteAllowed,
  auditAdminPreviewWriteDenied,
} from "@/lib/wexon-admin-preview-write";
import { isAdminPreviewExternalBlockedAction } from "@/lib/wexon-admin-preview-mutation-coverage";
import { resolveWexPaySessionContext, WexPayAccessError } from "@/lib/wexpay-tenant";
import {
  parseBranchCreate,
  parseBranchUpdate,
  parseCategoryCreate,
  parseCategoryUpdate,
  parseModifierGroupCreate,
  parseModifierGroupUpdate,
  parseModifierOptionCreate,
  parseModifierOptionUpdate,
  parseOrderCreate,
  parseOrderStatusUpdate,
  parsePaymentCreate,
  parsePaymentUpdate,
  parseProductCreate,
  parseProductModifierLinks,
  parseProductUpdate,
  parseRestaurantCreate,
  parseRestaurantUpdate,
  parseTableBulkCreate,
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

/**
 * Resolve redirect after context is known.
 * - Customer `/apps/wexpay...` paths unchanged.
 * - Admin preview paths confined to the same organizationId (cross-org → base).
 */
function readRedirectForContext(
  formData: FormData,
  appFallback: string,
  context: WexPayMutationContext,
) {
  const requested = formData.get("redirectTo");
  const raw = typeof requested === "string" ? requested : "";
  const fallback =
    context.actor.type === "admin_session"
      ? wexpayAdminPreviewBasePath(context.organizationId)
      : appFallback;
  return resolveSafeWexPayRedirectPath(raw || null, context.organizationId, fallback);
}

/**
 * Bind admin preview write capability into the mutation context so the service
 * commits domain changes + `admin.preview.write` in one Prisma transaction.
 * External/provider side-effect ops are blocked (never claimed rollbackable).
 */
async function bindAdminPreviewWriteIfNeeded(
  context: WexPayMutationContext,
  actionKey: string,
): Promise<WexPayMutationContext> {
  if (context.actor.type !== "admin_session") return context;

  if (isAdminPreviewExternalBlockedAction(actionKey)) {
    await auditAdminPreviewWriteDenied({
      organizationId: context.organizationId,
      actionKey,
      denialReason: "capability_mismatch",
    });
    throw new WexPayAccessError(
      "Bu işlem harici sağlayıcı etkisi içerdiği için admin önizlemede desteklenmiyor.",
      "role",
    );
  }

  const allowed = await assertAdminPreviewWriteAllowed({
    organizationId: context.organizationId,
    actionKey,
    auditDenial: true,
  });
  if (!allowed.ok) {
    throw new WexPayAccessError(allowed.message, "role");
  }

  return {
    ...context,
    adminPreviewWrite: {
      actionKey,
      organizationId: allowed.capability.organizationId,
      adminId: allowed.session.adminId,
      email: allowed.session.email,
      cloudflareSubject: allowed.capability.cloudflareSubject,
      reasonHash: allowed.capability.reasonHash,
      writeSessionId: allowed.capability.writeSessionId,
      writeModeExpiry: allowed.capability.expiresAt,
    },
  };
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

async function getCapabilityContext(
  options: { kitchen?: boolean; cashier?: boolean; settings?: boolean },
): Promise<WexPayMutationContext> {
  const resolved = await resolveWexPaySessionContext(options);
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
  let redirectTo = RESTAURANTS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseRestaurantCreate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, RESTAURANTS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_restaurant");
    await createRestaurant(context, input);
    revalidatePath(RESTAURANTS_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateRestaurantAction(formData: FormData) {
  let redirectTo = RESTAURANTS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseRestaurantUpdate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, RESTAURANTS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_restaurant");
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
  let redirectTo = BRANCHES_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseBranchCreate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, BRANCHES_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_branch");
    await createBranch(context, input);
    revalidatePath(BRANCHES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateBranchAction(formData: FormData) {
  let redirectTo = BRANCHES_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseBranchUpdate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, BRANCHES_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_branch");
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
  let redirectTo = TABLES_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableCreate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, TABLES_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_table");
    await createTable(context, input);
    revalidatePath(TABLES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function createTablesBulkAction(formData: FormData) {
  let redirectTo = TABLES_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableBulkCreate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, TABLES_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_tables_bulk");
    await createTablesBulk(context, input);
    revalidatePath(TABLES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateTableAction(formData: FormData) {
  let redirectTo = TABLES_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableUpdate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, TABLES_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_table");
    await updateTable(context, input);
    revalidatePath(TABLES_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function closeTableAction(formData: FormData) {
  let redirectTo = TABLES_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableClose(formData);
    context = await getCapabilityContext({ cashier: true });
    redirectTo = readRedirectForContext(formData, TABLES_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "close_table");
    await closeTable(context, input);
    revalidateWexPayOperations();
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function markReceiptPrintedAction(formData: FormData) {
  let redirectTo = TABLES_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseTableReceiptPrinted(formData);
    context = await getCapabilityContext({ cashier: true });
    redirectTo = readRedirectForContext(formData, TABLES_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "mark_receipt_printed");
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
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseCategoryCreate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_category");
    await createCategory(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateCategoryAction(formData: FormData) {
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseCategoryUpdate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_category");
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
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProductCreate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_product");
    await createProduct(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateProductAction(formData: FormData) {
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProductUpdate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_product");
    await updateProduct(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function createModifierGroupAction(formData: FormData) {
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseModifierGroupCreate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_modifier_group");
    await createModifierGroup(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateModifierGroupAction(formData: FormData) {
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseModifierGroupUpdate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_modifier_group");
    await updateModifierGroup(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function createModifierOptionAction(formData: FormData) {
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseModifierOptionCreate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_modifier_option");
    await createModifierOption(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function updateModifierOptionAction(formData: FormData) {
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseModifierOptionUpdate(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_modifier_option");
    await updateModifierOption(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function setProductModifierGroupsAction(formData: FormData) {
  let redirectTo = MENU_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProductModifierLinks(formData);
    context = await getManageContext();
    redirectTo = readRedirectForContext(formData, MENU_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "set_product_modifier_groups");
    await setProductModifierGroups(context, input);
    revalidatePath(MENU_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

// --- Orders ----------------------------------------------------------------

export async function createOrderAction(formData: FormData) {
  let redirectTo = ORDERS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseOrderCreate(formData);
    context = await getCapabilityContext({ cashier: true });
    redirectTo = readRedirectForContext(formData, ORDERS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "create_order");
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
  let redirectTo = ORDERS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseOrderStatusUpdate(formData);
    context = await getCapabilityContext({ kitchen: true });
    redirectTo = readRedirectForContext(formData, ORDERS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_order_status");
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
  let redirectTo = PAYMENTS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parsePaymentCreate(formData);
    context = await getCapabilityContext({ cashier: true });
    redirectTo = readRedirectForContext(formData, PAYMENTS_PATH, context);
    // PayTR starts an external PSP session after DB reserve — not tx-rollbackable.
    if (context.actor.type === "admin_session" && input.provider === "paytr") {
      await auditAdminPreviewWriteDenied({
        organizationId: context.organizationId,
        actionKey: "create_payment",
        denialReason: "capability_mismatch",
      });
      throw new WexPayAccessError(
        "PayTR ödemesi harici sağlayıcı etkisi içerdiği için admin önizlemede desteklenmiyor.",
        "role",
      );
    }
    context = await bindAdminPreviewWriteIfNeeded(context, "create_payment");
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
  let redirectTo = PAYMENTS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const paymentId = formData.get("paymentId");
    if (typeof paymentId !== "string" || !paymentId.trim()) {
      throw new WexPayValidationError("Ödeme zorunludur.");
    }
    context = await getCapabilityContext({ cashier: true });
    redirectTo = readRedirectForContext(formData, PAYMENTS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "regenerate_paytr_checkout");
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
  let redirectTo = PAYMENTS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parsePaymentUpdate(formData);
    context = await getCapabilityContext({ cashier: true });
    redirectTo = readRedirectForContext(formData, PAYMENTS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "update_payment");
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
  let redirectTo = SETTINGS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProviderCredentialUpsert(formData);
    context = await getCapabilityContext({ settings: true });
    redirectTo = readRedirectForContext(formData, SETTINGS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "upsert_provider_credential");
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
  let redirectTo = SETTINGS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProviderCredentialDeactivate(formData);
    context = await getCapabilityContext({ settings: true });
    redirectTo = readRedirectForContext(formData, SETTINGS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "deactivate_provider_credential");
    await deactivateWexPayProviderCredential(credentialAuditContext(context), input);
    revalidatePath(SETTINGS_PATH);
  } catch (error) {
    throwIfRedirectError(error);
    redirectWithError(redirectTo, error, context);
  }
  redirect(redirectTo);
}

export async function testProviderCredentialAction(formData: FormData) {
  let redirectTo = SETTINGS_PATH;
  let context: WexPayMutationContext | undefined;
  try {
    const input = parseProviderCredentialTest(formData);
    context = await getCapabilityContext({ settings: true });
    redirectTo = readRedirectForContext(formData, SETTINGS_PATH, context);
    context = await bindAdminPreviewWriteIfNeeded(context, "test_provider_credential");
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
