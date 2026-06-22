# WexPay Payment Provider Adapters

Status: Phase 7.1 — manual active; PayTR operator UX + webhook route; public QR checkout kapali.

## Adapter registry

Implementation: `lib/wexpay-payment-provider.ts`, PayTR: `lib/wexpay-paytr-adapter.ts`

| Provider key | Status | Behaviour |
| --- | --- | --- |
| `manual` | Active | Operator-recorded payment; sanal POS baglantisi gerekmez |
| `paytr` | Active (operator) | Tenant credential + checkout token; Payment `PENDING`; webhook settles PAID/FAILED |
| `iyzico` | Stub | Credential boundary only; `Provider adapter not configured.` |
| `param` | Stub | Same as iyzico |

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

## PayTR sanal POS (Phase 7 foundation)

Implementation: `lib/wexpay-paytr-adapter.ts`, webhook: `app/api/wexpay/webhooks/paytr/route.ts`

**WexPay para tutmaz.** Firma kendi PayTR panelinden aldigi merchant bilgilerini organization sanal POS baglantisina girer. WexPay yalnizca odeme baslatma hazirligi, operasyonel `Payment` kaydi ve callback sonucu tutar.

### Credential alanlari (config JSON)

| UI / config key | PayTR alani | Zorunlu |
| --- | --- | --- |
| `merchantId` | `merchant_id` | Evet |
| `apiKey` veya `secretKey` | `merchant_key` | Evet |
| `merchantSalt` | `merchant_salt` | Evet |
| `mode` | `TEST` / `LIVE` (`test_mode`) | Evet |

Eksik alan varsa adapter `provider_not_configured` doner. Plaintext yalnizca server adapter icinde decrypt edilir.

### Odeme baslatma (`createPayment`, provider=`paytr`)

- Manual gibi aninda `PAID` **yapilmaz**; client status alani PayTR icin yok sayilir (service `PENDING` yazar).
- `providerRef` = PayTR `merchant_oid` (benzersiz, max 64).
- `Payment.status` = `PENDING` yalnizca checkout token/URL basariyla uretildiyse kayit olusturulur.
- Masa status `PAYMENT_PENDING` (`syncTableStatus`).
- Audit metadata: `provider`, `providerRef`, `requiresExternalCheckout`.

**API kapali veya token uretilemezse Payment olusturulmaz** (yari kayit yok):

- `WEXPAY_PAYTR_ENABLE_API` unset/false → adapter hata; UI: "PayTR sanal POS API henuz etkin degil."
- Credential eksik → `provider_not_configured`; UI: "Sanal POS baglantisi eksik."
- Token istegi basarisiz → hata; DB mutation yok.

`WEXPAY_PAYTR_ENABLE_API=true` oldugunda token istegi `https://www.paytr.com/odeme/api/get-token` adresine gider (resmi iFrame API Step 1).

### Operator panel UX (Phase 7.1)

- Masa detayi (`/apps/wexpay/tables`) ve odeme formu (`/apps/wexpay/payments`): tahsilat yontemi secimi — **Manuel tahsilat** / **PayTR sanal POS**.
- PayTR secildiginde aciklama: odeme PayTR uzerinden tamamlaninca webhook ile masa guncellenir.
- Basarili oturum sonrasi redirect query: `paytrCheckout` + `paymentId`; banner ile PayTR guvenli odeme linki acilir.
- Odeme listesinde provider etiketi, PayTR `PENDING` icin `merchant_oid` (`providerRef`) gosterilir.
- Masa detayinda acik PayTR `PENDING` uyarisi.
- Public QR checkout bu fazda acilmaz.

### Callback / webhook URL

PayTR panelinde bildirim URL:

```text
{NEXT_PUBLIC_APP_URL}/api/wexpay/webhooks/paytr
```

Redirect URL'ler (bilgi amacli):

- `merchant_ok_url` → `/apps/wexpay/payments?paytr=success`
- `merchant_fail_url` → `/apps/wexpay/payments?paytr=failed`

**Onemli:** Siparis onay/iptal yalnizca notification URL uzerinden yapilir; ok/fail redirect guvenilir degildir (PayTR dokumani).

### Webhook isleme ve idempotency

1. Raw body okunur; `rawBodyHash` ledger'a yazilir.
2. `receiveWexPayWebhookEvent` — `providerEventId = merchant_oid:status:total_amount`.
3. Duplicate event → Payment ikinci kez mutate edilmez; PayTR'ye `OK` donulur.
4. Signature: `base64(hmac_sha256(merchant_oid + merchant_salt + status + total_amount, merchant_key))` — hash eslesmezse `401`, ledger `FAILED`.
5. `total_amount` (kuruş) DB `Payment.amount` ile eslesmezse mutate edilmez; ledger `FAILED`, audit `wexpay.webhook.paytr.amount_mismatch`.
6. Signature sonrasi `markWexPayWebhookEventVerified`.
7. `Payment` `providerRef=merchant_oid` ile bulunur; tenant organization zinciri dogrulanir.
8. `success` → `Payment` `PAID`; `failed` → `FAILED`; `paidAt` + `syncTableStatus` + audit `wexpay.payment.provider_settled`.
9. Zaten terminal Payment → ignore + `OK`.

**PayTR token (`user_ip`):** Operator action request IP'si adapter'a aktarilir; gecersizse guvenli fallback kullanilir (127.0.0.1 kullanilmaz).

**Bekleyen PayTR UI:** `merchant_oid` gosterimi, checkout yenileme (`regeneratePaytrCheckoutAction`), operator basarisiz isaretleme (yalnizca `FAILED`).

Audit: `wexpay.webhook.paytr.processed`, `wexpay.payment.provider_settled`.

### Test / live notlari

- `mode=TEST` → PayTR `test_mode=1`.
- Operator PayTR baslatma icin `WEXPAY_PAYTR_ENABLE_API=true` zorunlu.
- Webhook settle: `success` → PAID + `paidAt`; `failed` → FAILED; duplicate webhook idempotent.
- Demo route'lara dokunulmaz.

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

1. [x] **PayTR foundation** — credential mapping, PENDING payment, webhook route, signature + idempotency.
2. [x] **PayTR operator UX** — masa/odeme formlari, checkout banner, providerRef gorunumu.
3. **Public QR checkout route** — separate from order creation.
4. **iyzico / Param adapters** — credential + webhook parity.

## Schema reference

Operational payment row (`Payment`):

- `provider` — normalized adapter key
- `providerRef` — PSP transaction / session id

Phase 6 additions:

- `WexPayProviderCredential` — encrypted tenant sanal POS API config
- `WexPayWebhookEvent` — inbound idempotent webhook ledger

Core `BillingPayment` remains separate and must not be reused for table/checkout flows.
