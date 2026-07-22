import {
  ActivationJourneyStatus,
  ActivationJourneyStepStatus,
  ActivationStepKey,
  MembershipRole,
  type Prisma,
  type PrismaClient,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateSubscriptionLifecycle } from "@/lib/wexon-core-access";
import { writeAuditLog } from "@/lib/wexon-audit";
import {
  ACTIVATION_STEP_ORDER,
  ActivationJourneyError,
  SETTLED_ACTIVATION_FEE_STATUSES,
  assertWizardStepMutableInTx,
} from "@/lib/wexpay-activation-journey";
import { assertActorManageMembershipInTx } from "@/lib/wexpay-activation-tx-access";
import {
  decryptProviderConfig,
  isProviderCredentialEncryptionAvailable,
} from "@/lib/wexpay-provider-credentials";
import { assertPaytrCredentialReady } from "@/lib/wexpay-paytr-adapter";
import { resolveWexPayPublicOrigin } from "@/lib/wexpay-public-table-url";

type ValidationDbClient = PrismaClient | Prisma.TransactionClient;

export type ActivationValidationStatus = "PASS" | "WARNING" | "FAIL";

export type ActivationValidationCheck = {
  key: string;
  status: ActivationValidationStatus;
  title: string;
  description: string;
  remediationHref?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ActivationValidationReport = {
  overall: ActivationValidationStatus;
  checks: ActivationValidationCheck[];
  passCount: number;
  warningCount: number;
  failCount: number;
};

export type ActivationValidationSafeMetadata = {
  result: ActivationValidationStatus;
  passCount: number;
  warningCount: number;
  failCount: number;
  checks: Array<{ key: string; status: ActivationValidationStatus }>;
};

export type ValidationEnvironment = NodeJS.ProcessEnv;

const VALIDATION_TITLES: Record<string, string> = {
  TENANT_JOURNEY: "Aktivasyon yolculuğu",
  ORGANIZATION_ACTIVE: "Organizasyon durumu",
  WEXPAY_PRODUCT_ACTIVE: "WexPay ürün durumu",
  LICENSE_ACTIVE: "Lisans durumu",
  SUBSCRIPTION_LIFECYCLE: "Abonelik yaşam döngüsü",
  INSTALLATION_ACTIVE: "WexPay kurulumu",
  ACTIVATION_FEE_SETTLED: "Aktivasyon ücreti",
  PRIOR_STEPS_COMPLETE: "Önceki adımlar",
  NO_DUPLICATE_REFERENCES: "Kurulum referansları",
  ACTIVE_RESTAURANT: "Aktif restoran",
  ACTIVE_BRANCH: "Aktif şube",
  ACTIVE_TABLES: "Aktif masalar",
  OPAQUE_QR_TOKENS: "Kurulum QR tokenları",
  ACTIVE_TENANT_TOKEN_CHAIN: "Aktif tenant QR zinciri",
  TOKEN_RELATIONSHIP_INTEGRITY: "QR token ilişki bütünlüğü",
  PAYMENT_PROVIDER_SELECTED: "Ödeme sağlayıcısı",
  SELECTED_CREDENTIAL_TENANT: "Sağlayıcı kimlik bilgisi sahipliği",
  PROVIDER_CREDENTIAL_READY: "Sağlayıcı kimlik bilgisi kontrolü",
  FEATURE_QR_PAYMENT: "QR ödeme yetkisi",
  MENU_READY: "Menü hazırlığı",
  STAFF_READY: "Personel hazırlığı",
  PUBLIC_ORIGIN: "Genel erişim adresi",
  LEGAL_NAME: "Yasal unvan",
  TAX_NUMBER: "Vergi numarası",
  MANUAL_PROVIDER_WARNING: "Manuel ödeme uyarısı",
  PAYTR_API_DISABLED: "PayTR API durumu",
  PAYTR_TEST_MODE_PRODUCTION: "PayTR canlı mod gereksinimi",
  NON_PRODUCTION_FAKE_EMAIL: "E-posta sağlayıcısı",
};

function addCheck(
  checks: ActivationValidationCheck[],
  key: string,
  status: ActivationValidationStatus,
  description: string,
  options?: Pick<ActivationValidationCheck, "remediationHref" | "metadata">,
) {
  checks.push({
    key,
    status,
    title: VALIDATION_TITLES[key] ?? key,
    description,
    ...(options?.remediationHref
      ? { remediationHref: options.remediationHref }
      : {}),
    ...(options?.metadata ? { metadata: options.metadata } : {}),
  });
}

export function summarizeActivationValidation(
  checks: ActivationValidationCheck[],
): ActivationValidationReport {
  const passCount = checks.filter((check) => check.status === "PASS").length;
  const warningCount = checks.filter((check) => check.status === "WARNING").length;
  const failCount = checks.filter((check) => check.status === "FAIL").length;
  return {
    overall: failCount > 0 ? "FAIL" : warningCount > 0 ? "WARNING" : "PASS",
    checks,
    passCount,
    warningCount,
    failCount,
  };
}

export function buildActivationValidationSafeMetadata(
  report: ActivationValidationReport,
): ActivationValidationSafeMetadata {
  return {
    result: report.overall,
    passCount: report.passCount,
    warningCount: report.warningCount,
    failCount: report.failCount,
    checks: report.checks.map(({ key, status }) => ({ key, status })),
  };
}

export function canRetryActivationValidation(blockedReasonCode: string | null | undefined) {
  return blockedReasonCode !== "ADMIN_BLOCKED";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function choosePrimaryLicense<
  T extends { status: string; startsAt: Date; endsAt: Date | null; createdAt: Date },
>(licenses: T[], now: Date): T | null {
  const rank = (status: string) => {
    if (status === "ACTIVE") return 0;
    if (status === "TRIAL") return 1;
    return 9;
  };
  return (
    [...licenses].sort((a, b) => {
      const aCurrent = a.startsAt <= now && (!a.endsAt || a.endsAt >= now);
      const bCurrent = b.startsAt <= now && (!b.endsAt || b.endsAt >= now);
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0] ?? null
  );
}

function validatePublicOrigin(env: ValidationEnvironment): boolean {
  try {
    resolveWexPayPublicOrigin(env);
    return true;
  } catch {
    return false;
  }
}

/**
 * Complete server-authoritative readiness checklist. Every database lookup is
 * scoped through organizationId and the journey's WexPay product inside the
 * caller's transaction.
 */
export async function validateWexPayActivationInTx(
  tx: ValidationDbClient,
  input: {
    organizationId: string;
    journeyId: string;
    at?: Date;
    env?: ValidationEnvironment;
  },
): Promise<ActivationValidationReport> {
  const now = input.at ?? new Date();
  const env = input.env ?? process.env;
  const checks: ActivationValidationCheck[] = [];

  const journey = await tx.activationJourney.findFirst({
    where: { id: input.journeyId, organizationId: input.organizationId },
    include: { steps: true },
  });
  if (!journey) {
    return summarizeActivationValidation([
      {
        key: "TENANT_JOURNEY",
        status: "FAIL",
        title: VALIDATION_TITLES.TENANT_JOURNEY,
        description: "Aktivasyon yolculuğu organizasyonla eşleşmiyor.",
      },
    ]);
  }

  const organization = await tx.organization.findUnique({
    where: { id: input.organizationId },
    select: {
      id: true,
      isActive: true,
      isDemo: true,
      legalName: true,
      taxNo: true,
    },
  });
  addCheck(
    checks,
    "ORGANIZATION_ACTIVE",
    organization?.isActive && !organization.isDemo ? "PASS" : "FAIL",
    organization?.isActive && !organization.isDemo
      ? "Organizasyon aktif."
      : "Aktif, gerçek bir organizasyon gerekli.",
  );

  const product = await tx.product.findFirst({
    where: { id: journey.productId, key: "wexpay" },
    select: { id: true, isActive: true, status: true },
  });
  const productReady = Boolean(product?.isActive && product.status === "ACTIVE");
  addCheck(
    checks,
    "WEXPAY_PRODUCT_ACTIVE",
    productReady ? "PASS" : "FAIL",
    productReady ? "WexPay ürünü aktif." : "WexPay ürünü aktif değil.",
  );

  const licenses = product
    ? await tx.license.findMany({
        where: { organizationId: input.organizationId, productId: product.id },
        include: {
          subscription: true,
          plan: {
            include: {
              entitlements: {
                where: { isActive: true },
                select: {
                  key: true,
                  valueBool: true,
                  valueInt: true,
                  valueString: true,
                },
              },
            },
          },
        },
      })
    : [];
  const license = choosePrimaryLicense(licenses, now);
  const licenseReady = Boolean(
    license &&
      (license.status === "ACTIVE" || license.status === "TRIAL") &&
      license.startsAt <= now &&
      (!license.endsAt || license.endsAt >= now),
  );
  addCheck(
    checks,
    "LICENSE_ACTIVE",
    licenseReady ? "PASS" : "FAIL",
    licenseReady ? "Lisans aktif." : "Geçerli WexPay lisansı bulunamadı.",
  );

  const lifecycle = evaluateSubscriptionLifecycle(license?.subscription ?? null, now);
  addCheck(
    checks,
    "SUBSCRIPTION_LIFECYCLE",
    lifecycle.ok ? "PASS" : "FAIL",
    lifecycle.ok ? "Abonelik yaşam döngüsü uygun." : "Abonelik yaşam döngüsü erişimi kapatıyor.",
  );

  const installation = product
    ? await tx.appInstallation.findUnique({
        where: {
          organizationId_productId: {
            organizationId: input.organizationId,
            productId: product.id,
          },
        },
        select: { status: true, licenseId: true },
      })
    : null;
  const installationReady = Boolean(
    installation?.status === "ACTIVE" &&
      (!installation.licenseId || installation.licenseId === license?.id),
  );
  addCheck(
    checks,
    "INSTALLATION_ACTIVE",
    installationReady ? "PASS" : "FAIL",
    installationReady ? "WexPay kurulumu aktif." : "Aktif ve lisansla eşleşen kurulum gerekli.",
  );

  const fee = product
    ? await tx.activationFeeLedger.findUnique({
        where: {
          organizationId_productId: {
            organizationId: input.organizationId,
            productId: product.id,
          },
        },
        select: { status: true },
      })
    : null;
  const feeReady = Boolean(
    fee && (SETTLED_ACTIVATION_FEE_STATUSES as readonly string[]).includes(fee.status),
  );
  addCheck(
    checks,
    "ACTIVATION_FEE_SETTLED",
    feeReady ? "PASS" : "FAIL",
    feeReady ? "Aktivasyon ücreti kapalı." : "Aktivasyon ücreti tamamlanmamış.",
  );

  const stepByKey = new Map(journey.steps.map((step) => [step.stepKey, step]));
  const requiredPriorSteps = ACTIVATION_STEP_ORDER.slice(
    0,
    ACTIVATION_STEP_ORDER.indexOf(ActivationStepKey.VALIDATION),
  );
  const priorsReady = requiredPriorSteps.every((key) => {
    const status = stepByKey.get(key)?.status;
    return (
      status === ActivationJourneyStepStatus.COMPLETED ||
      status === ActivationJourneyStepStatus.SKIPPED
    );
  });
  addCheck(
    checks,
    "PRIOR_STEPS_COMPLETE",
    priorsReady ? "PASS" : "FAIL",
    priorsReady ? "Önceki aktivasyon adımları tamamlandı." : "Önceki adımlar eksik.",
  );

  const branchMeta = asObject(
    stepByKey.get(ActivationStepKey.BRANCH_SETUP)?.safeMetadataJson,
  );
  const tableMeta = asObject(
    stepByKey.get(ActivationStepKey.TABLE_SETUP)?.safeMetadataJson,
  );
  const menuMeta = asObject(stepByKey.get(ActivationStepKey.MENU_IMPORT)?.safeMetadataJson);
  const restaurantId = readString(branchMeta.restaurantId);
  const branchId = readString(branchMeta.branchId);
  const tableBranchId = readString(tableMeta.branchId);
  const menuBranchId = readString(menuMeta.branchId);
  const tableIds = readStringArray(tableMeta.tableIds);
  const uniqueTableIds = [...new Set(tableIds)];

  const duplicateFree =
    tableIds.length === uniqueTableIds.length &&
    Boolean(restaurantId && branchId) &&
    (!tableBranchId || tableBranchId === branchId) &&
    (!menuBranchId || menuBranchId === branchId);
  addCheck(
    checks,
    "NO_DUPLICATE_REFERENCES",
    duplicateFree ? "PASS" : "FAIL",
    duplicateFree
      ? "Aktivasyon referanslarında tekrar yok."
      : "Tekrarlı veya çelişkili aktivasyon referansı var.",
  );

  const restaurant = restaurantId
    ? await tx.restaurant.findFirst({
        where: { id: restaurantId, organizationId: input.organizationId },
        select: { id: true, isActive: true },
      })
    : null;
  addCheck(
    checks,
    "ACTIVE_RESTAURANT",
    restaurant?.isActive ? "PASS" : "FAIL",
    restaurant?.isActive ? "Restoran aktif ve organizasyona ait." : "Restoran sahipliği geçersiz.",
  );

  const branch = branchId
    ? await tx.branch.findFirst({
        where: {
          id: branchId,
          restaurantId,
          restaurant: { organizationId: input.organizationId },
        },
        select: { id: true, isActive: true },
      })
    : null;
  addCheck(
    checks,
    "ACTIVE_BRANCH",
    branch?.isActive ? "PASS" : "FAIL",
    branch?.isActive ? "Şube aktif ve restorana ait." : "Şube sahipliği geçersiz.",
  );

  const tables =
    uniqueTableIds.length > 0
      ? await tx.restaurantTable.findMany({
          where: {
            id: { in: uniqueTableIds },
            branchId,
            branch: { restaurant: { organizationId: input.organizationId } },
            isActive: true,
          },
          select: { id: true },
        })
      : [];
  const tablesReady =
    uniqueTableIds.length > 0 &&
    tables.length === uniqueTableIds.length &&
    tableMeta.qrAck === true &&
    tableMeta.awaitingQrAck !== true;
  addCheck(
    checks,
    "ACTIVE_TABLES",
    tablesReady ? "PASS" : "FAIL",
    tablesReady ? "Aktif masa paketi doğrulandı." : "Aktif masa veya QR paket onayı eksik.",
  );

  const tokens =
    tables.length > 0
      ? await tx.tableQrToken.findMany({
          where: { tableId: { in: tables.map((table) => table.id) }, status: "ACTIVE" },
          select: { id: true, tableId: true },
        })
      : [];
  const tokensPerTable = new Map<string, number>();
  for (const token of tokens) {
    tokensPerTable.set(token.tableId, (tokensPerTable.get(token.tableId) ?? 0) + 1);
  }
  const tokensReady =
    tablesReady &&
    tables.every((table) => tokensPerTable.get(table.id) === 1) &&
    tokens.length === tables.length;
  addCheck(
    checks,
    "OPAQUE_QR_TOKENS",
    tokensReady ? "PASS" : "FAIL",
    tokensReady ? "Her masada tek aktif opaque QR var." : "Opaque QR tenant zinciri eksik.",
  );

  // Independent of wizard metadata: prove at least one live tenant chain and
  // explicitly reject duplicate active-token relationships on any live table.
  const activeTenantTables = await tx.restaurantTable.findMany({
    where: {
      isActive: true,
      branch: {
        isActive: true,
        restaurant: {
          isActive: true,
          organizationId: input.organizationId,
        },
      },
    },
    select: {
      id: true,
      branch: {
        select: {
          restaurant: {
            select: { organizationId: true },
          },
        },
      },
      qrTokens: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
  });
  const activeChainCount = activeTenantTables.filter(
    (table) => table.qrTokens.length === 1,
  ).length;
  addCheck(
    checks,
    "ACTIVE_TENANT_TOKEN_CHAIN",
    activeChainCount > 0 ? "PASS" : "FAIL",
    activeChainCount > 0
      ? "Aktif restoran, şube, masa ve opaque token zinciri doğrulandı."
      : "En az bir aktif restoran/şube/masa/token zinciri gerekli.",
    { metadata: { activeChainCount } },
  );
  const duplicateActiveTokenTableCount = activeTenantTables.filter(
    (table) => table.qrTokens.length > 1,
  ).length;
  const crossTenantActiveTokenCount = activeTenantTables
    .filter(
      (table) =>
        table.qrTokens.length > 0 &&
        table.branch.restaurant.organizationId !== input.organizationId,
    )
    .reduce((count, table) => count + table.qrTokens.length, 0);
  addCheck(
    checks,
    "TOKEN_RELATIONSHIP_INTEGRITY",
    duplicateActiveTokenTableCount === 0 && crossTenantActiveTokenCount === 0
      ? "PASS"
      : "FAIL",
    duplicateActiveTokenTableCount === 0 && crossTenantActiveTokenCount === 0
      ? "Aktif token ilişkilerinde tenant dışı veya tekrarlı kayıt yok."
      : "Tenant dışı veya tekrarlı aktif token ilişkisi bulundu.",
    {
      metadata: {
        duplicateActiveTokenTableCount,
        crossTenantActiveTokenCount,
      },
    },
  );

  const providerMeta = asObject(
    stepByKey.get(ActivationStepKey.PAYMENT_PROVIDER)?.safeMetadataJson,
  );
  const provider = readString(providerMeta.provider).toUpperCase();
  const providerMode = readString(providerMeta.mode).toUpperCase();
  const credentialId = readString(providerMeta.credentialId);
  const keyFingerprint = readString(providerMeta.keyFingerprint);
  const configCheckedAt = readString(providerMeta.configCheckedAt);
  const configCheckedAtMs = Date.parse(configCheckedAt);
  const configCheckedAtValid =
    Boolean(configCheckedAt) &&
    Number.isFinite(configCheckedAtMs) &&
    new Date(configCheckedAtMs).toISOString() === configCheckedAt;
  const providerReady =
    (provider === "MANUAL" &&
      providerMeta.acknowledged === true &&
      providerMeta.onlinePaymentReady === false) ||
    (provider === "PAYTR" &&
      Boolean(credentialId && keyFingerprint) &&
      configCheckedAtValid &&
      typeof providerMeta.onlinePaymentApiEnabled === "boolean" &&
      (providerMode === "TEST" || providerMode === "LIVE"));
  addCheck(
    checks,
    "PAYMENT_PROVIDER_SELECTED",
    providerReady ? "PASS" : "FAIL",
    providerReady ? "Ödeme sağlayıcısı doğrulandı." : "Ödeme sağlayıcısı seçimi geçersiz.",
  );

  const selectedCredential = credentialId
    ? await tx.wexPayProviderCredential.findUnique({
        where: { id: credentialId },
        select: {
          id: true,
          organizationId: true,
          provider: true,
          mode: true,
          isActive: true,
          keyFingerprint: true,
          configCiphertext: true,
        },
      })
    : null;
  const selectedCredentialTenantReady =
    provider === "MANUAL" ||
    Boolean(
      selectedCredential &&
        selectedCredential.organizationId === input.organizationId,
    );
  addCheck(
    checks,
    "SELECTED_CREDENTIAL_TENANT",
    selectedCredentialTenantReady ? "PASS" : "FAIL",
    selectedCredentialTenantReady
      ? provider === "MANUAL"
        ? "Manuel sağlayıcı için tenant credential ilişkisi gerekmiyor."
        : "Seçili credential organizasyona ait."
      : "Seçili credential organizasyonla eşleşmiyor.",
  );

  let credentialReady =
    provider === "MANUAL" &&
    providerMeta.acknowledged === true &&
    providerMeta.onlinePaymentReady === false;
  if (
    provider === "PAYTR" &&
    (providerMode === "TEST" || providerMode === "LIVE") &&
    selectedCredentialTenantReady &&
    selectedCredential
  ) {
    const identityMatches =
      selectedCredential.isActive &&
      selectedCredential.provider === "paytr" &&
      selectedCredential.mode === providerMode &&
      selectedCredential.keyFingerprint === keyFingerprint;
    if (identityMatches && isProviderCredentialEncryptionAvailable()) {
      try {
        const config = decryptProviderConfig(selectedCredential.configCiphertext);
        credentialReady = assertPaytrCredentialReady(config, providerMode).ready;
      } catch {
        credentialReady = false;
      }
    }
  }
  addCheck(
    checks,
    "PROVIDER_CREDENTIAL_READY",
    credentialReady ? "PASS" : "FAIL",
    credentialReady
      ? provider === "MANUAL"
        ? "Manuel sağlayıcı için credential gerekmiyor."
        : "PayTR credential yapılandırması geçerli."
      : "Sağlayıcı credential yapılandırması eksik veya geçersiz.",
  );

  const qrEntitlement = license?.plan.entitlements.find(
    (entitlement) => entitlement.key === "feature_qr_payment",
  );
  const qrPaymentEnabled = qrEntitlement?.valueBool === true;
  addCheck(
    checks,
    "FEATURE_QR_PAYMENT",
    qrPaymentEnabled ? "PASS" : "FAIL",
    qrPaymentEnabled ? "QR ödeme özelliği lisanslı." : "feature_qr_payment kapalı.",
  );

  const menuStep = stepByKey.get(ActivationStepKey.MENU_IMPORT);
  const menuSkipped = menuStep?.status === ActivationJourneyStepStatus.SKIPPED;
  const activeMenuCount =
    branchId && !menuSkipped
      ? await tx.menuProduct.count({
          where: {
            branchId,
            isActive: true,
            branch: { restaurant: { organizationId: input.organizationId } },
          },
        })
      : 0;
  addCheck(
    checks,
    "MENU_READY",
    menuSkipped ? "WARNING" : activeMenuCount > 0 ? "PASS" : "FAIL",
    menuSkipped
      ? "Menü adımı açık onayla atlandı."
      : activeMenuCount > 0
        ? "Aktif menü ürünü var."
        : "Aktif menü ürünü bulunamadı.",
  );

  const staffStep = stepByKey.get(ActivationStepKey.STAFF_INVITE);
  const staffSkipped = staffStep?.status === ActivationJourneyStepStatus.SKIPPED;
  const [activeStaffCount, qualifyingInviteCount] = staffSkipped
    ? [0, 0]
    : await Promise.all([
        tx.membership.count({
          where: {
            organizationId: input.organizationId,
            status: "ACTIVE",
            role: { not: MembershipRole.OWNER },
          },
        }),
        tx.staffInvite.count({
          where: {
            organizationId: input.organizationId,
            OR: [
              { acceptedAt: { not: null } },
              {
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: now },
                deliveryStatus: "SENT",
              },
            ],
          },
        }),
      ]);
  addCheck(
    checks,
    "STAFF_READY",
    staffSkipped
      ? "WARNING"
      : activeStaffCount > 0 || qualifyingInviteCount > 0
        ? "PASS"
        : "FAIL",
    staffSkipped
      ? "Personel adımı açık onayla atlandı."
      : activeStaffCount > 0 || qualifyingInviteCount > 0
        ? "Personel kurulumu hazır."
        : "Aktif personel veya geçerli davet bulunamadı.",
  );

  addCheck(
    checks,
    "PUBLIC_ORIGIN",
    validatePublicOrigin(env) ? "PASS" : "FAIL",
    validatePublicOrigin(env)
      ? "Genel erişim origin yapılandırması geçerli."
      : "Genel erişim origin yapılandırması eksik veya geçersiz.",
  );

  addCheck(
    checks,
    "LEGAL_NAME",
    organization?.legalName?.trim() ? "PASS" : "WARNING",
    organization?.legalName?.trim() ? "Yasal unvan kayıtlı." : "Yasal unvan eksik.",
  );
  addCheck(
    checks,
    "TAX_NUMBER",
    organization?.taxNo?.trim() ? "PASS" : "WARNING",
    organization?.taxNo?.trim() ? "Vergi numarası kayıtlı." : "Vergi numarası eksik.",
  );

  if (provider === "MANUAL") {
    addCheck(
      checks,
      "MANUAL_PROVIDER_WARNING",
      "WARNING",
      "Manuel sağlayıcı seçildi; tahsilat otomatik doğrulanmaz.",
    );
  }
  if (provider === "PAYTR" && env.WEXPAY_PAYTR_ENABLE_API !== "true") {
    addCheck(
      checks,
      "PAYTR_API_DISABLED",
      "WARNING",
      "PayTR API bayrağı kapalı; yalnızca yapılandırma kontrol edildi.",
    );
  }
  if (
    provider === "PAYTR" &&
    providerMode === "TEST" &&
    env.VERCEL_ENV === "production"
  ) {
    addCheck(
      checks,
      "PAYTR_TEST_MODE_PRODUCTION",
      "WARNING",
      "TEST credential doğrulandı; üretimde online kart ödemesi LIVE credential seçilene kadar kapalı kalır.",
    );
  }
  const emailProvider = env.WEXON_EMAIL_PROVIDER?.trim().toLowerCase() || "fake";
  if (env.VERCEL_ENV !== "production" && emailProvider === "fake") {
    addCheck(
      checks,
      "NON_PRODUCTION_FAKE_EMAIL",
      "WARNING",
      "Üretim dışı ortamda fake e-posta sağlayıcısı kullanılıyor.",
    );
  }

  return summarizeActivationValidation(checks);
}

export async function runWexPayActivationValidation(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  env?: ValidationEnvironment;
}) {
  return prisma.$transaction(
    async (tx) => {
      await assertActorManageMembershipInTx(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        roles: [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER],
      });
      const journey = await tx.activationJourney.findFirst({
        where: {
          organizationId: input.organizationId,
          product: { key: "wexpay" },
        },
        include: { steps: true },
      });
      if (!journey) {
        throw new ActivationJourneyError("NOT_STARTED", "Akıllı Aktivasyon henüz başlamadı.");
      }
      if (!canRetryActivationValidation(journey.blockedReasonCode)) {
        throw new ActivationJourneyError(
          "ADMIN_BLOCKED",
          "Aktivasyon yönetici tarafından durduruldu.",
        );
      }
      await assertWizardStepMutableInTx(tx, {
        journeyId: journey.id,
        expectedVersion: input.expectedVersion,
        stepKey: ActivationStepKey.VALIDATION,
      });

      const report = await validateWexPayActivationInTx(tx, {
        organizationId: input.organizationId,
        journeyId: journey.id,
        env: input.env,
      });
      const safeMetadata = buildActivationValidationSafeMetadata(report);
      const now = new Date();
      const passed = report.failCount === 0;

      const bumped = await tx.activationJourney.updateMany({
        where: {
          id: journey.id,
          version: input.expectedVersion,
          currentStep: ActivationStepKey.VALIDATION,
          OR: [
            { blockedReasonCode: null },
            { blockedReasonCode: { not: "ADMIN_BLOCKED" } },
          ],
        },
        data: {
          version: { increment: 1 },
          status: passed
            ? ActivationJourneyStatus.READY
            : ActivationJourneyStatus.BLOCKED,
          currentStep: passed ? ActivationStepKey.GO_LIVE : ActivationStepKey.VALIDATION,
          blockedReasonCode: passed ? null : "VALIDATION_FAILED",
        },
      });
      if (bumped.count !== 1) {
        throw new ActivationJourneyError(
          "VERSION_CONFLICT",
          "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
        );
      }

      await tx.activationJourneyStep.update({
        where: {
          journeyId_stepKey: {
            journeyId: journey.id,
            stepKey: ActivationStepKey.VALIDATION,
          },
        },
        data: {
          status: passed
            ? ActivationJourneyStepStatus.COMPLETED
            : ActivationJourneyStepStatus.ERROR,
          completedAt: passed ? now : null,
          attemptCount: { increment: 1 },
          lastErrorCode: passed ? null : "VALIDATION_FAILED",
          safeMetadataJson: safeMetadata as Prisma.InputJsonValue,
        },
      });

      await writeAuditLog(
        {
          action: passed
            ? "activation.validation.passed"
            : "activation.validation.failed",
          organizationId: input.organizationId,
          userId: input.actorUserId,
          entityType: "ActivationJourney",
          entityId: journey.id,
          source: "activation_wizard",
          level: passed ? "INFO" : "WARN",
          status: passed ? "SUCCESS" : "FAILURE",
          metadata: safeMetadata,
        },
        tx,
      );

      return {
        report,
        journey: await tx.activationJourney.findUniqueOrThrow({
          where: { id: journey.id },
          include: { steps: { orderBy: { stepKey: "asc" } } },
        }),
      };
    },
    { timeout: 20_000 },
  );
}
