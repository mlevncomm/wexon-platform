# WexPay Payment Provider Adapters

Status: Phase 6 foundation — manual provider active; PSP adapters remain stubs with tenant credential + webhook event storage.

## Urun modeli: WexPay para tutmaz

WexPay bir odeme kurulusu veya para saklama katmani degildir.

- **Restoran / firma** kendi banka veya sanal POS anlasmasini (PayTR, iyzico, Param vb.) dogrudan yapar.
- **WexPay** yalnizca sanal POS API baglantisi, operasyon kaydi (masa adisyonu, tahsilat durumu) ve webhook isleme altyapisini saglar.
- **Para akisi** musteriden firmaya / PSP'ye / bankaya gider; Wexon veya WexPay hesabinda birikmez.
- Teknik model adi `WexPayProviderCredential` kalir; urun dilinde buna **sanal POS baglantisi** denir.

Manuel operasyonel odeme (`provider=manual`) sanal POS baglantisi gerektirmez: operator tahsilati kaydeder, para fiziksel POS / kasa akisinda kalir.

## Payment vs BillingPayment

| Concern | WexPay `Payment` | Core `BillingPayment` |
| --- | --- | --- |
| Purpose | Restoran masa / QR operasyonel tahsilat kaydi | Wexon platform abonelik ve lisans faturalandirmasi |
| Para | Firmanin PSP / banka akisinda; WexPay tutmaz | Wexon SaaS abonelik odemesi (ayri urun hattı) |
| Tenant scope | Restaurant branch / table session | Organization subscription |
| Access decisions | Never used for Core license/entitlement | Source of truth for billing state |
| Provider field | `Payment.provider` / `Payment.providerRef` | Separate Core billing models |
| Credentials | `WexPayProviderCredential` (sanal POS API bilgileri) | Core billing provider fields on `Subscription` |

WexPay operational payments must not drive Core access, license, or subscription logic. **BillingPayment = Wexon aboneligi. Payment = restoran operasyon odemesi.**

## Adapter registry

Implementation: `lib/wexpay-payment-provider.ts`

| Provider key | Status | Behaviour |
| --- | --- | --- |
| `manual` | Active | Operator-recorded payment; sanal POS baglantisi gerekmez |
| `paytr` | Stub | Checks tenant credential boundary, then throws `Provider adapter not configured.` |
| `iyzico` | Stub | Same as PayTR |
| `param` | Stub | Same as PayTR |

### Common adapter interface

Each adapter implements:

- `createPaymentIntent` — reserve or confirm an operational payment intent
- `createCheckoutSession` — produce redirect / hosted checkout when required
- `verifyCallback` — validate PSP webhook or return payload
- `mapProviderStatus` — map provider-specific status strings to `PaymentStatus`

Response types (`WexPayPaymentIntentResult`, `WexPayProviderCallbackResult`) live in the adapter module.

## Manual provider (current production path)

- Default when `provider` is omitted or empty.
- Sanal POS baglantisi (`WexPayProviderCredential`) gerektirmez.
- Does not emit `externalCheckoutUrl`.
- `createPayment` in `lib/wexpay-service.ts` records the payment immediately with operator-selected `PaymentStatus` (typically `PAID`).
- `providerRef` remains `null`.

Operator UI and server actions continue to use manual flow unchanged.

## Sanal POS baglantisi storage (Phase 6)

Urun dili: **Sanal POS baglantisi**. Teknik model: `WexPayProviderCredential` (`prisma/schema.prisma`)

Firma kendi PayTR / iyzico / Param merchant bilgilerini girer; WexPay yalnizca sifreli saklar ve adapter/webhook katmaninda kullanir. Odeme tutari WexPay uzerinden gecmez.

| Field | Purpose |
| --- | --- |
| `organizationId` | Tenant isolation |
| `provider` | `paytr`, `iyzico`, `param` (not `manual`) |
| `mode` | `TEST` or `LIVE` |
| `configCiphertext` | AES-256-GCM encrypted JSON config |
| `keyFingerprint` | Non-secret SHA-256 prefix for rotation audits |
| `maskedKey` | Display-only masked secret suffix |
| `isActive` | Soft disable without deleting history |

Unique constraint: `(organizationId, provider, mode)`.

Helpers: `lib/wexpay-provider-credentials.ts`

- **Encryption key:** `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` (32-byte hex or base64). Missing key → credentials cannot be stored and PSP adapters remain not configured.
- **Mode default:** `WEXPAY_PROVIDER_MODE=TEST|LIVE`, else non-production defaults to `TEST`.
- **Never exposed:** `configCiphertext`, decrypted config, or raw secrets in API/UI/audit metadata.
- **Audit actions:** `wexpay.provider_credential.upserted`, `wexpay.provider_credential.deactivated`

Settings panel (`/apps/wexpay/settings`) shows masked sanal POS baglanti ozetleri only; plaintext API secret gosterilmez.

## Inbound webhook events (Phase 6)

Model: `WexPayWebhookEvent` — inbound PSP callbacks for operational WexPay payments.

**Not** Core outbound `WebhookEndpoint` / future `WebhookDelivery` (see `docs/webhook-event-idempotency-design.md`).

| Field | Purpose |
| --- | --- |
| `provider` + `providerEventId` | Unique idempotency key per PSP event |
| `payloadHash` / `rawBodyHash` | Integrity checks without storing raw body |
| `status` | `RECEIVED` → `VERIFIED` → `PROCESSED` / `FAILED` / `IGNORED` |
| `organizationId` | Set when tenant is resolved from callback metadata |

Helpers: `lib/wexpay-webhook-events.ts`

- `receiveWexPayWebhookEvent` — idempotent create; duplicates return existing row
- `markWexPayWebhookEventVerified` / `Processed` / `Failed` / `Ignored`
- `attachOrganizationToWexPayWebhookEvent` — bind tenant after signature verification

Audit actions:

- `wexpay.webhook.received`
- `wexpay.webhook.duplicate`
- `wexpay.webhook.verified`
- `wexpay.webhook.processed`
- `wexpay.webhook.failed`
- `wexpay.webhook.ignored`
- `wexpay.webhook.tenant_attached`

## Public QR boundary (not enabled)

Public diners use:

- `POST /api/wexpay/public/[qrCode]/order` — order creation only (no PSP redirect)

Future checkout (not wired):

1. Diner completes order (or selects pay-at-table).
2. A dedicated checkout route resolves the branch/tenant provider adapter.
3. `createPublicQrCheckoutSessionBoundary` calls `createCheckoutSession`.
4. Client redirects to `externalCheckoutUrl` when `requiresExternalCheckout` is true.
5. Inbound webhook route receives PSP callback → `receiveWexPayWebhookEvent` → verify signature → update `Payment`.

Do not add PSP calls to the order route.

## Raw body / signature verification checklist

Before processing any inbound PSP webhook in production:

1. Read **raw body** bytes before JSON parsing.
2. Compute and store `rawBodyHash`; compare on replay/debug.
3. Verify provider signature using tenant credential from `loadActiveProviderCredentialConfig`.
4. Resolve `organizationId` and attach to `WexPayWebhookEvent`.
5. Call `markWexPayWebhookEventVerified` only after signature passes.
6. Process payment mutation in a transaction; then `markWexPayWebhookEventProcessed`.
7. On verification failure → `markWexPayWebhookEventFailed` (do not mutate `Payment`).
8. On benign duplicate/unsupported event → `markWexPayWebhookEventIgnored`.
9. Never log raw body, secrets, or decrypted config.

## PayTR / iyzico / Param — integration order

1. **Credential UI/API** — secure upsert flow for operators (foundation helpers exist).
2. **Adapter implementation** — replace stub methods with real API clients per provider.
3. **Inbound webhook routes** — e.g. `/api/wexpay/webhooks/paytr` (production only; demo routes untouched).
4. **Outbound idempotency** — use `providerEventId` unique constraint; skip duplicate processing.
5. **Payment mutation** — update operational `Payment` + `syncTableStatus` inside transaction with audit.
6. **Public QR checkout route** — separate from order creation; uses `createCheckoutSession`.

Stub adapters intentionally throw `Provider adapter not configured.` even when credentials exist, until step 2 is complete.

## Schema reference

Operational payment row (`Payment`):

- `provider` — normalized adapter key
- `providerRef` — PSP transaction / session id

Phase 6 additions:

- `WexPayProviderCredential` — encrypted tenant sanal POS API config
- `WexPayWebhookEvent` — inbound idempotent webhook ledger

Core `BillingPayment` remains separate and must not be reused for table/checkout flows.
