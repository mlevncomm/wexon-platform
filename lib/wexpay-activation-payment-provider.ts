import {
  ActivationStepKey,
  MembershipRole,
  WexPayProviderCredentialMode,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import {
  assertWizardStepMutableInTx,
  completeActivationStepInTx,
} from "@/lib/wexpay-activation-journey";
import {
  assertActorManageMembershipInTx,
  assertWexPayAccessInTx,
} from "@/lib/wexpay-activation-tx-access";
import { assertPaytrCredentialReady } from "@/lib/wexpay-paytr-adapter";
import {
  prepareProviderCredentialUpsert,
  upsertWexPayProviderCredentialInTx,
  type WexPayProviderCredentialSummary,
} from "@/lib/wexpay-provider-credentials";

export const ACTIVATION_PAYMENT_PROVIDERS = ["MANUAL", "PAYTR"] as const;
export type ActivationPaymentProvider = (typeof ACTIVATION_PAYMENT_PROVIDERS)[number];

type RawPaymentProviderInput = FormData | Record<string, unknown>;

export type ManualActivationPaymentProviderInput = {
  provider: "MANUAL";
  manualAcknowledged: true;
};

export type PaytrActivationPaymentProviderInput = {
  provider: "PAYTR";
  mode: WexPayProviderCredentialMode;
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
};

export type ActivationPaymentProviderInput =
  | ManualActivationPaymentProviderInput
  | PaytrActivationPaymentProviderInput;

export type ActivationPaymentProviderSafeMetadata =
  | {
      provider: "MANUAL";
      acknowledged: true;
      onlinePaymentReady: false;
    }
  | {
      provider: "PAYTR";
      credentialId: string;
      mode: "TEST" | "LIVE";
      keyFingerprint: string;
      configCheckedAt: string;
      onlinePaymentApiEnabled: boolean;
    };

export class ActivationPaymentProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ActivationPaymentProviderError";
    this.code = code;
  }
}

function readRawValue(input: RawPaymentProviderInput, key: string): unknown {
  if ("get" in input && typeof input.get === "function") return input.get(key);
  return (input as Record<string, unknown>)[key];
}

function readFirstString(input: RawPaymentProviderInput, keys: readonly string[]): string {
  for (const key of keys) {
    const value = readRawValue(input, key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readBoolean(input: RawPaymentProviderInput, keys: readonly string[]): boolean {
  for (const key of keys) {
    const raw = readRawValue(input, key);
    if (raw === true || raw === 1) return true;
  }
  const value = readFirstString(input, keys).toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

const MERCHANT_ID_KEYS = [
  "merchantId",
  "merchant_id",
  "paytrMerchantId",
  "PAYTR_MERCHANT_ID",
] as const;
const MERCHANT_KEY_KEYS = [
  "merchantKey",
  "merchant_key",
  "apiKey",
  "secretKey",
  "paytrMerchantKey",
  "PAYTR_MERCHANT_KEY",
] as const;
const MERCHANT_SALT_KEYS = [
  "merchantSalt",
  "merchant_salt",
  "secret",
  "paytrMerchantSalt",
  "PAYTR_MERCHANT_SALT",
] as const;

/**
 * Strict server-side parser. Only MANUAL and PAYTR are accepted, even if a
 * caller submits a hidden/hand-crafted provider value.
 */
export function parseActivationPaymentProviderInput(
  input: RawPaymentProviderInput,
): ActivationPaymentProviderInput {
  const provider = readFirstString(input, ["provider", "paymentProvider"]).toUpperCase();
  if (provider !== "MANUAL" && provider !== "PAYTR") {
    throw new ActivationPaymentProviderError(
      "UNSUPPORTED_PROVIDER",
      "Yalnızca manuel ödeme veya PayTR seçilebilir.",
    );
  }

  const merchantId = readFirstString(input, MERCHANT_ID_KEYS);
  const merchantKey = readFirstString(input, MERCHANT_KEY_KEYS);
  const merchantSalt = readFirstString(input, MERCHANT_SALT_KEYS);

  if (provider === "MANUAL") {
    if (!readBoolean(input, ["manualAcknowledged", "manual_acknowledged", "acknowledged"])) {
      throw new ActivationPaymentProviderError(
        "MANUAL_ACK_REQUIRED",
        "Manuel ödeme sorumluluğunu açıkça onaylayın.",
      );
    }
    if (merchantId || merchantKey || merchantSalt) {
      throw new ActivationPaymentProviderError(
        "MANUAL_CREDENTIAL_FORBIDDEN",
        "Manuel ödeme seçiminde sağlayıcı kimlik bilgisi gönderilemez.",
      );
    }
    return { provider: "MANUAL", manualAcknowledged: true };
  }

  const modeRaw = readFirstString(input, ["mode", "providerMode"]).toUpperCase() || "TEST";
  if (modeRaw !== "TEST" && modeRaw !== "LIVE") {
    throw new ActivationPaymentProviderError("INVALID_MODE", "PayTR modu TEST veya LIVE olmalıdır.");
  }
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new ActivationPaymentProviderError(
      "PAYTR_CREDENTIALS_REQUIRED",
      "PayTR Merchant ID, Merchant Key ve Merchant Salt zorunludur.",
    );
  }

  return {
    provider: "PAYTR",
    mode:
      modeRaw === "LIVE"
        ? WexPayProviderCredentialMode.LIVE
        : WexPayProviderCredentialMode.TEST,
    merchantId,
    merchantKey,
    merchantSalt,
  };
}

export function buildActivationPaymentProviderSafeMetadata(
  input: ActivationPaymentProviderInput,
  paytrCheck?: {
    credential: Pick<
      WexPayProviderCredentialSummary,
      "id" | "mode" | "keyFingerprint"
    >;
    configCheckedAt: Date;
  },
): ActivationPaymentProviderSafeMetadata {
  if (input.provider === "MANUAL") {
    return {
      provider: "MANUAL",
      acknowledged: true,
      onlinePaymentReady: false,
    };
  }
  if (!paytrCheck) {
    throw new ActivationPaymentProviderError(
      "PAYTR_CONFIG_CHECK_REQUIRED",
      "PayTR yapılandırma kontrolü tamamlanmadı.",
    );
  }
  return {
    provider: "PAYTR",
    credentialId: paytrCheck.credential.id,
    mode: paytrCheck.credential.mode,
    keyFingerprint: paytrCheck.credential.keyFingerprint,
    configCheckedAt: paytrCheck.configCheckedAt.toISOString(),
    onlinePaymentApiEnabled: process.env.WEXPAY_PAYTR_ENABLE_API === "true",
  };
}

export async function saveActivationPaymentProviderStep(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  providerInput: ActivationPaymentProviderInput;
}) {
  const providerInput = parseActivationPaymentProviderInput(
    input.providerInput as unknown as Record<string, unknown>,
  );
  return prisma.$transaction(
    async (tx) => {
      await assertActorManageMembershipInTx(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        roles: [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER],
      });
      const access = await assertWexPayAccessInTx(tx, {
        organizationId: input.organizationId,
        productKey: "wexpay",
      });
      const journey = await tx.activationJourney.findUnique({
        where: {
          organizationId_productId: {
            organizationId: input.organizationId,
            productId: access.productId,
          },
        },
        select: { id: true },
      });
      if (!journey) {
        throw new ActivationPaymentProviderError(
          "NOT_STARTED",
          "Akıllı Aktivasyon henüz başlamadı.",
        );
      }

      await assertWizardStepMutableInTx(tx, {
        journeyId: journey.id,
        expectedVersion: input.expectedVersion,
        stepKey: ActivationStepKey.PAYMENT_PROVIDER,
      });

      let paytrCheck:
        | {
            credential: WexPayProviderCredentialSummary;
            configCheckedAt: Date;
          }
        | undefined;
      if (providerInput.provider === "PAYTR") {
        const config = {
          merchantId: providerInput.merchantId,
          merchantKey: providerInput.merchantKey,
          merchantSalt: providerInput.merchantSalt,
        };
        const prepared = await prepareProviderCredentialUpsert(
          input.organizationId,
          {
            provider: "paytr",
            mode: providerInput.mode,
            displayName: "PayTR",
            config,
            primarySecret: providerInput.merchantKey,
          },
          tx,
        );
        const readiness = assertPaytrCredentialReady(prepared.config, providerInput.mode);
        if (!readiness.ready) {
          throw new ActivationPaymentProviderError(
            "PAYTR_CONFIG_INVALID",
            "PayTR yapılandırması eksik veya geçersiz.",
          );
        }
        const configCheckedAt = new Date();
        const credential = await upsertWexPayProviderCredentialInTx(
          tx,
          {
            organizationId: input.organizationId,
            userId: input.actorUserId,
          },
          {
            provider: "paytr",
            displayName: "PayTR",
            mode: providerInput.mode,
            config: prepared.config,
            primarySecret: prepared.primarySecret,
            isActive: true,
          },
        );
        paytrCheck = { credential, configCheckedAt };
      }

      const safeMetadata = buildActivationPaymentProviderSafeMetadata(
        providerInput,
        paytrCheck,
      );
      const completed = await completeActivationStepInTx(tx, {
        journeyId: journey.id,
        expectedVersion: input.expectedVersion,
        stepKey: ActivationStepKey.PAYMENT_PROVIDER,
        advanceTo: ActivationStepKey.VALIDATION,
        safeMetadata,
      });

      await writeAuditLog(
        {
          action: "activation.payment_provider.completed",
          organizationId: input.organizationId,
          userId: input.actorUserId,
          entityType: "ActivationJourney",
          entityId: journey.id,
          source: "activation_wizard",
          metadata: safeMetadata,
        },
        tx,
      );

      return completed;
    },
    { timeout: 15_000 },
  );
}
