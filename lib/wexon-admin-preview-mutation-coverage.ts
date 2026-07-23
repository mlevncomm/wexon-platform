/**
 * Admin preview mutation coverage registry (PR3 merge-blocker gate).
 *
 * Every WexPay UI mutation entrypoint must appear here. Static unit tests fail
 * CI if an action is missing or if pure-DB rows lack atomic audit requirements.
 *
 * | Domain | actionKey | capability | orgId | same-tx audit | notes |
 * | --- | --- | --- | --- | --- | --- |
 * | restaurants | create_restaurant / update_restaurant | yes | yes | yes | pure DB |
 * | branches | create_branch / update_branch | yes | yes | yes | pure DB |
 * | tables | create_table / create_tables_bulk / update_table / close_table / mark_receipt_printed | yes | yes | yes | pure DB |
 * | menu/modifier | create/update category/product/modifier_* / set_product_modifier_groups | yes | yes | yes | pure DB |
 * | orders/kitchen | create_order / update_order_status | yes | yes | yes | pure DB |
 * | payments | create_payment (manual) / update_payment | yes | yes | yes | pure DB |
 * | payments | create_payment (paytr) / regenerate_paytr_checkout | blocked | — | — | external PSP |
 * | settings | upsert/deactivate/test_provider_credential | blocked | — | — | external/secret side effects |
 */

export type AdminPreviewMutationKind = "pure_db" | "external_blocked";

export type AdminPreviewMutationCoverageRow = {
  actionKey: string;
  /** Exported server-action function name in lib/wexpay-actions.ts */
  actionExport: string;
  domain:
    | "restaurants"
    | "branches"
    | "tables"
    | "menu"
    | "orders"
    | "kitchen"
    | "payments"
    | "settings";
  kind: AdminPreviewMutationKind;
  requiresCapability: true;
  requiresOrganizationId: true;
  /** Domain mutation + admin.preview.write in one Prisma transaction */
  atomicAuditRequired: boolean;
};

export const ADMIN_PREVIEW_MUTATION_COVERAGE: readonly AdminPreviewMutationCoverageRow[] = [
  {
    actionKey: "create_restaurant",
    actionExport: "createRestaurantAction",
    domain: "restaurants",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_restaurant",
    actionExport: "updateRestaurantAction",
    domain: "restaurants",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_branch",
    actionExport: "createBranchAction",
    domain: "branches",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_branch",
    actionExport: "updateBranchAction",
    domain: "branches",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_table",
    actionExport: "createTableAction",
    domain: "tables",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_tables_bulk",
    actionExport: "createTablesBulkAction",
    domain: "tables",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_table",
    actionExport: "updateTableAction",
    domain: "tables",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "close_table",
    actionExport: "closeTableAction",
    domain: "tables",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "mark_receipt_printed",
    actionExport: "markReceiptPrintedAction",
    domain: "tables",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_category",
    actionExport: "createCategoryAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_category",
    actionExport: "updateCategoryAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_product",
    actionExport: "createProductAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_product",
    actionExport: "updateProductAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_modifier_group",
    actionExport: "createModifierGroupAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_modifier_group",
    actionExport: "updateModifierGroupAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_modifier_option",
    actionExport: "createModifierOptionAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_modifier_option",
    actionExport: "updateModifierOptionAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "set_product_modifier_groups",
    actionExport: "setProductModifierGroupsAction",
    domain: "menu",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_order",
    actionExport: "createOrderAction",
    domain: "orders",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_order_status",
    actionExport: "updateOrderStatusAction",
    domain: "kitchen",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "create_payment",
    actionExport: "createPaymentAction",
    domain: "payments",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "update_payment",
    actionExport: "updatePaymentAction",
    domain: "payments",
    kind: "pure_db",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: true,
  },
  {
    actionKey: "regenerate_paytr_checkout",
    actionExport: "regeneratePaytrCheckoutAction",
    domain: "payments",
    kind: "external_blocked",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: false,
  },
  {
    actionKey: "upsert_provider_credential",
    actionExport: "upsertProviderCredentialAction",
    domain: "settings",
    kind: "external_blocked",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: false,
  },
  {
    actionKey: "deactivate_provider_credential",
    actionExport: "deactivateProviderCredentialAction",
    domain: "settings",
    kind: "external_blocked",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: false,
  },
  {
    actionKey: "test_provider_credential",
    actionExport: "testProviderCredentialAction",
    domain: "settings",
    kind: "external_blocked",
    requiresCapability: true,
    requiresOrganizationId: true,
    atomicAuditRequired: false,
  },
] as const;

export const ADMIN_PREVIEW_EXTERNAL_BLOCKED_ACTION_KEYS = new Set(
  ADMIN_PREVIEW_MUTATION_COVERAGE.filter((row) => row.kind === "external_blocked").map(
    (row) => row.actionKey,
  ),
);

export function isAdminPreviewExternalBlockedAction(actionKey: string) {
  return ADMIN_PREVIEW_EXTERNAL_BLOCKED_ACTION_KEYS.has(actionKey);
}

export function listAdminPreviewPureDbActionKeys() {
  return ADMIN_PREVIEW_MUTATION_COVERAGE.filter((row) => row.kind === "pure_db").map(
    (row) => row.actionKey,
  );
}
