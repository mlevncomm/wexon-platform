import {
  ActivationJourneySource,
  ActivationJourneyStepStatus,
  ActivationStepKey,
  WexPayProviderCredentialMode,
  type Prisma,
  type PrismaClient,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { assertWexPayPublicLiveReady } from "@/lib/wexpay-activation-journey";
import { mapPaytrCredentialConfig, type PaytrCredentialBundle } from "@/lib/wexpay-paytr-adapter";
import {
  decryptProviderConfig,
  isProviderCredentialEncryptionAvailable,
} from "@/lib/wexpay-provider-credentials";

type AvailabilityDbClient = PrismaClient | Prisma.TransactionClient;

export type WexPayPublicPaymentUnavailableReason =
  | "JOURNEY_NOT_ACTIVE"
  | "PAYMENT_STEP_INCOMPLETE"
  | "MANUAL_SELECTED"
  | "SELECTION_INVALID"
  | "CREDENTIAL_INVALID"
  | "PAYTR_TEST_MODE_PRODUCTION"
  | "PAYTR_API_DISABLED";

export type WexPayPublicPaymentAvailability =
  | {
      onlineCheckoutEnabled: false;
      provider: "MANUAL" | "PAYTR" | null;
      reason: WexPayPublicPaymentUnavailableReason;
    }
  | {
      onlineCheckoutEnabled: true;
      provider: "PAYTR";
      credentialId: string;
      keyFingerprint: string;
      mode: WexPayProviderCredentialMode;
      selectionSource: "PR4" | "LEGACY_BACKFILL";
      /** Internal-only decrypted bundle. Never serialize or audit. */
      credentials: PaytrCredentialBundle;
    };

export type WexPayPublicPaymentAvailabilitySummary =
  | Exclude<WexPayPublicPaymentAvailability, { onlineCheckoutEnabled: true }>
  | Omit<
      Extract<WexPayPublicPaymentAvailability, { onlineCheckoutEnabled: true }>,
      "credentials"
    >;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isCanonicalIso(value: string) {
  const milliseconds = Date.parse(value);
  return (
    Boolean(value) &&
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

export function isPaytrModeAllowedForPublicCheckout(
  mode: WexPayProviderCredentialMode,
  env: NodeJS.ProcessEnv,
) {
  return (
    env.VERCEL_ENV !== "production" ||
    mode === WexPayProviderCredentialMode.LIVE
  );
}

function decryptPaytrCredential(record: {
  id: string;
  mode: WexPayProviderCredentialMode;
  keyFingerprint: string;
  configCiphertext: string;
}) {
  try {
    const config = decryptProviderConfig(record.configCiphertext);
    const mapped = mapPaytrCredentialConfig(config);
    if (!mapped) return null;
    return {
      credentialId: record.id,
      keyFingerprint: record.keyFingerprint,
      mode: record.mode,
      credentials: { ...mapped, mode: record.mode },
    };
  } catch {
    return null;
  }
}

async function resolveLegacyBackfillCredential(
  client: AvailabilityDbClient,
  organizationId: string,
) {
  if (!isProviderCredentialEncryptionAvailable()) return null;
  const credentials = await client.wexPayProviderCredential.findMany({
    where: {
      organizationId,
      provider: "paytr",
      isActive: true,
      mode: {
        in: [
          WexPayProviderCredentialMode.LIVE,
          WexPayProviderCredentialMode.TEST,
        ],
      },
    },
    select: {
      id: true,
      mode: true,
      keyFingerprint: true,
      configCiphertext: true,
    },
  });
  const modeRank = (mode: WexPayProviderCredentialMode) =>
    mode === WexPayProviderCredentialMode.LIVE ? 0 : 1;
  for (const credential of credentials.sort(
    (left, right) => modeRank(left.mode) - modeRank(right.mode),
  )) {
    const decrypted = decryptPaytrCredential(credential);
    if (decrypted) return decrypted;
  }
  return null;
}

async function resolveLegacyBackfillAvailability(
  client: AvailabilityDbClient,
  organizationId: string,
  env: NodeJS.ProcessEnv,
): Promise<WexPayPublicPaymentAvailability> {
  const legacyCredential = await resolveLegacyBackfillCredential(
    client,
    organizationId,
  );
  if (!legacyCredential) {
    return {
      onlineCheckoutEnabled: false,
      provider: "PAYTR",
      reason: "CREDENTIAL_INVALID",
    };
  }
  if (!isPaytrModeAllowedForPublicCheckout(legacyCredential.mode, env)) {
    return {
      onlineCheckoutEnabled: false,
      provider: "PAYTR",
      reason: "PAYTR_TEST_MODE_PRODUCTION",
    };
  }
  if (env.WEXPAY_PAYTR_ENABLE_API !== "true") {
    return {
      onlineCheckoutEnabled: false,
      provider: "PAYTR",
      reason: "PAYTR_API_DISABLED",
    };
  }
  return {
    onlineCheckoutEnabled: true,
    provider: "PAYTR",
    selectionSource: "LEGACY_BACKFILL",
    ...legacyCredential,
  };
}

/**
 * Sole public online-payment resolver. Journey status is checked only through
 * assertWexPayPublicLiveReady; callers must not duplicate journey status logic.
 */
export async function resolveWexPayPublicPaymentAvailability(
  organizationId: string,
  options: {
    client?: AvailabilityDbClient;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<WexPayPublicPaymentAvailability> {
  const client = options.client ?? prisma;
  const env = options.env ?? process.env;

  if (!(await assertWexPayPublicLiveReady(organizationId, client))) {
    return {
      onlineCheckoutEnabled: false,
      provider: null,
      reason: "JOURNEY_NOT_ACTIVE",
    };
  }

  const paymentStep = await client.activationJourneyStep.findFirst({
    where: {
      stepKey: ActivationStepKey.PAYMENT_PROVIDER,
      status: {
        in: [
          ActivationJourneyStepStatus.COMPLETED,
          ActivationJourneyStepStatus.SKIPPED,
        ],
      },
      journey: {
        organizationId,
        product: { key: "wexpay" },
      },
    },
    select: {
      status: true,
      safeMetadataJson: true,
      journey: { select: { source: true } },
    },
  });
  if (!paymentStep) {
    return {
      onlineCheckoutEnabled: false,
      provider: null,
      reason: "PAYMENT_STEP_INCOMPLETE",
    };
  }

  const metadata = asObject(paymentStep.safeMetadataJson);
  const provider = readString(metadata.provider).toUpperCase();
  if (provider === "MANUAL") {
    return {
      onlineCheckoutEnabled: false,
      provider: "MANUAL",
      reason: "MANUAL_SELECTED",
    };
  }
  if (!provider) {
    if (paymentStep.journey.source !== ActivationJourneySource.LEGACY_BACKFILL) {
      return {
        onlineCheckoutEnabled: false,
        provider: null,
        reason: "SELECTION_INVALID",
      };
    }
    return resolveLegacyBackfillAvailability(
      client,
      organizationId,
      env,
    );
  }
  if (provider !== "PAYTR") {
    return {
      onlineCheckoutEnabled: false,
      provider: null,
      reason: "SELECTION_INVALID",
    };
  }

  const credentialId = readString(metadata.credentialId);
  const keyFingerprint = readString(metadata.keyFingerprint);
  const modeRaw = readString(metadata.mode).toUpperCase();
  const configCheckedAt = readString(metadata.configCheckedAt);
  if (
    !credentialId ||
    !keyFingerprint ||
    !isCanonicalIso(configCheckedAt) ||
    typeof metadata.onlinePaymentApiEnabled !== "boolean" ||
    (modeRaw !== "TEST" && modeRaw !== "LIVE")
  ) {
    if (paymentStep.journey.source === ActivationJourneySource.LEGACY_BACKFILL) {
      return resolveLegacyBackfillAvailability(
        client,
        organizationId,
        env,
      );
    }
    return {
      onlineCheckoutEnabled: false,
      provider: "PAYTR",
      reason: "SELECTION_INVALID",
    };
  }
  const mode =
    modeRaw === "LIVE"
      ? WexPayProviderCredentialMode.LIVE
      : WexPayProviderCredentialMode.TEST;

  const credential = await client.wexPayProviderCredential.findFirst({
    where: {
      id: credentialId,
      organizationId,
      provider: "paytr",
      mode,
      keyFingerprint,
      isActive: true,
    },
    select: { configCiphertext: true },
  });
  if (!credential || !isProviderCredentialEncryptionAvailable()) {
    return {
      onlineCheckoutEnabled: false,
      provider: "PAYTR",
      reason: "CREDENTIAL_INVALID",
    };
  }

  try {
    const decrypted = decryptPaytrCredential({
      id: credentialId,
      mode,
      keyFingerprint,
      configCiphertext: credential.configCiphertext,
    });
    if (!decrypted) {
      return {
        onlineCheckoutEnabled: false,
        provider: "PAYTR",
        reason: "CREDENTIAL_INVALID",
      };
    }
    if (!isPaytrModeAllowedForPublicCheckout(decrypted.mode, env)) {
      return {
        onlineCheckoutEnabled: false,
        provider: "PAYTR",
        reason: "PAYTR_TEST_MODE_PRODUCTION",
      };
    }
    if (env.WEXPAY_PAYTR_ENABLE_API !== "true") {
      return {
        onlineCheckoutEnabled: false,
        provider: "PAYTR",
        reason: "PAYTR_API_DISABLED",
      };
    }
    return {
      onlineCheckoutEnabled: true,
      provider: "PAYTR",
      selectionSource: "PR4",
      ...decrypted,
    };
  } catch {
    return {
      onlineCheckoutEnabled: false,
      provider: "PAYTR",
      reason: "CREDENTIAL_INVALID",
    };
  }
}

export async function getWexPayPublicPaymentAvailabilitySummary(
  organizationId: string,
  options: {
    client?: AvailabilityDbClient;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<WexPayPublicPaymentAvailabilitySummary> {
  const availability = await resolveWexPayPublicPaymentAvailability(
    organizationId,
    options,
  );
  if (!availability.onlineCheckoutEnabled) return availability;
  const { credentials: _credentials, ...safe } = availability;
  void _credentials;
  return safe;
}
