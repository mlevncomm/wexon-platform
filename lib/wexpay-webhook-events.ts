import { createHash } from "crypto";
import { WexPayWebhookEventStatus, type Prisma, type WexPayWebhookEvent } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";

export type WexPayWebhookEventRecord = WexPayWebhookEvent;

export type ReceiveWexPayWebhookEventInput = {
  organizationId?: string | null;
  provider: string;
  providerEventId: string;
  eventType: string;
  rawBody: string;
  payload?: unknown;
};

export type ReceiveWexPayWebhookEventResult = {
  event: WexPayWebhookEventRecord;
  duplicate: boolean;
};

type WebhookAuditContext = {
  organizationId?: string | null;
  ipAddress?: string | null;
};

type WebhookDb = Pick<typeof prisma, "wexPayWebhookEvent">;

function isUniqueConflict(error: unknown): error is { code: "P2002" } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

export function hashWebhookRawBody(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export function hashWebhookPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

async function writeWebhookAudit(
  action: string,
  event: WexPayWebhookEventRecord,
  context: WebhookAuditContext,
  metadata?: Record<string, unknown>,
) {
  await writeAuditLog({
    action,
    organizationId: event.organizationId ?? context.organizationId ?? null,
    entityType: "WexPayWebhookEvent",
    entityId: event.id,
    ipAddress: context.ipAddress ?? null,
    source: "wexpay_webhook",
    metadata: {
      provider: event.provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      status: event.status,
      payloadHash: event.payloadHash,
      rawBodyHash: event.rawBodyHash,
      ...(metadata ?? {}),
    },
  });
}

export async function receiveWexPayWebhookEvent(
  input: ReceiveWexPayWebhookEventInput,
  context: WebhookAuditContext = {},
  client: WebhookDb = prisma,
): Promise<ReceiveWexPayWebhookEventResult> {
  const rawBodyHash = hashWebhookRawBody(input.rawBody);
  const payloadHash = input.payload === undefined ? rawBodyHash : hashWebhookPayload(input.payload);

  try {
    const event = await client.wexPayWebhookEvent.create({
      data: {
        organizationId: input.organizationId ?? null,
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        payloadHash,
        rawBodyHash,
        status: WexPayWebhookEventStatus.RECEIVED,
      },
    });

    await writeWebhookAudit("wexpay.webhook.received", event, context);
    return { event, duplicate: false };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    const existing = await client.wexPayWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: input.provider,
          providerEventId: input.providerEventId,
        },
      },
    });
    if (!existing) throw error;

    await writeWebhookAudit("wexpay.webhook.duplicate", existing, context, { duplicate: true });
    return { event: existing, duplicate: true };
  }
}

export async function markWexPayWebhookEventVerified(
  eventId: string,
  context: WebhookAuditContext = {},
  client: WebhookDb = prisma,
) {
  const event = await client.wexPayWebhookEvent.update({
    where: { id: eventId },
    data: { status: WexPayWebhookEventStatus.VERIFIED },
  });
  await writeWebhookAudit("wexpay.webhook.verified", event, context);
  return event;
}

export async function markWexPayWebhookEventProcessed(
  eventId: string,
  context: WebhookAuditContext = {},
  client: WebhookDb = prisma,
) {
  const event = await client.wexPayWebhookEvent.update({
    where: { id: eventId },
    data: {
      status: WexPayWebhookEventStatus.PROCESSED,
      processedAt: new Date(),
      errorMessage: null,
    },
  });
  await writeWebhookAudit("wexpay.webhook.processed", event, context);
  return event;
}

export async function markWexPayWebhookEventFailed(
  eventId: string,
  errorMessage: string,
  context: WebhookAuditContext = {},
  client: WebhookDb = prisma,
) {
  const event = await client.wexPayWebhookEvent.update({
    where: { id: eventId },
    data: {
      status: WexPayWebhookEventStatus.FAILED,
      processedAt: new Date(),
      errorMessage,
    },
  });
  await writeWebhookAudit("wexpay.webhook.failed", event, context, { errorMessage });
  return event;
}

export async function markWexPayWebhookEventIgnored(
  eventId: string,
  reason: string,
  context: WebhookAuditContext = {},
  client: WebhookDb = prisma,
) {
  const event = await client.wexPayWebhookEvent.update({
    where: { id: eventId },
    data: {
      status: WexPayWebhookEventStatus.IGNORED,
      processedAt: new Date(),
      errorMessage: reason,
    },
  });
  await writeWebhookAudit("wexpay.webhook.ignored", event, context, { reason });
  return event;
}

export async function attachOrganizationToWexPayWebhookEvent(
  eventId: string,
  organizationId: string,
  context: WebhookAuditContext = {},
  client: WebhookDb = prisma,
) {
  const event = await client.wexPayWebhookEvent.update({
    where: { id: eventId },
    data: { organizationId },
  });
  await writeWebhookAudit("wexpay.webhook.tenant_attached", event, { ...context, organizationId });
  return event;
}

export async function getWexPayWebhookEventByProviderRef(
  provider: string,
  providerEventId: string,
  client: WebhookDb = prisma,
) {
  return client.wexPayWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider,
        providerEventId,
      },
    },
  });
}

export async function listRecentWexPayWebhookEvents(
  organizationId: string,
  take = 10,
  client: WebhookDb = prisma,
) {
  return client.wexPayWebhookEvent.findMany({
    where: { organizationId },
    orderBy: { receivedAt: "desc" },
    take,
  });
}

export type WexPayWebhookProcessingTransaction = WebhookDb;

export async function runWexPayWebhookTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(work);
}
