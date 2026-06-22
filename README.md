# Wexon Platform

Wexon, cok urunlu bir SaaS ekosistemidir. Bu repo su an moduler tek Next.js uygulamasi olarak ilerler; Wexon Core, public website, customer portal, admin portal ve WexPay MVP ayni kod tabaninda tutulur.

## Mimari Prensip

Wexon Core merkezi karar kaynagidir.

Urun uygulamalari lisans, abonelik, odeme erisimi veya entitlement kararlarini kendi basina vermez. WexPay, WexHotel ve WexB2B sadece Core kararini tuketir.

Core'un cevapladigi ana soru:

> Bu organization, su anda bu urunu, ozelligi, kotayi veya ortami kullanabilir mi?

Bu karar `lib/wexon-core-access.ts` icinde merkezilesir. Urun uygulamalari dogrudan `License.status` veya `AppInstallation.status` okuyarak nihai erisim karari vermemelidir.

## Ana Parcalar

- Public Website: `/`, `/products/*`, `/book-demo`, `/contact`
- Wexon Core Customer Portal: `/dashboard/*`
- Wexon Admin Portal: `/admin/*`
- WexPay Product App: `/apps/wexpay/*`
- WexPay Demo APIs: `/api/wexpay/demo/*`
- WexHotel ve WexB2B: su an katalog/roadmap seviyesinde

## Core Domain

Prisma semasinda Core icin ana modeller:

- `Organization`
- `User`
- `Membership`
- `Product`
- `Plan`
- `Entitlement`
- `License`
- `Subscription`
- `Invoice`
- `BillingPayment`
- `AppInstallation`
- `AuditLog`
- `ApiKey`
- `WebhookEndpoint`

Billing/payment state tek basina erisim karari degildir. Odeme durumu erisimi etkileyebilir, fakat nihai erisim karari license, installation, entitlement ve Core policy sonucudur.

## Guncel Gelistirme Sirasi

1. Public Website
2. Wexon Core
3. Customer Portal ve Admin Portal
4. WexPay MVP
5. WexHotel MVP
6. WexB2B MVP

WexApp/WexPay urun gelistirmesine gecmeden once Core karar modeli, admin operasyonlari, customer portal ve audit akislari tamamlanmalidir.

## Komutlar

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
npm run test:unit
npm run production:check
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run prisma:seed:real
npm run test:smoke:build
```

Windows PowerShell script policy `npm` komutunu engellerse `npm.cmd` kullan:

```bash
npm.cmd run build
```

## Font

Wexon marka fontu Urbanist'tir. Google Fonts runtime fetch kullanilmaz; build dis servise bagli olmamalidir.

Lokal font dosyasini buraya koy:

```text
public/fonts/Urbanist-VariableFont_wght.woff2
```

veya:

```text
public/fonts/Urbanist-VariableFont_wght.ttf
```

CSS fallback kalir, fakat hedef font family her zaman `Urbanist`tir.

## Environment (WexPay provider credentials)

| Degisken | Local dev | Production (PSP acilacaksa) |
|----------|-----------|------------------------------|
| `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` | Manual operasyonel odeme icin **gerekmez** | PayTR / iyzico / Param credential kaydi ve inbound webhook isleme icin **zorunlu** |

- **Manual provider** (`provider=manual`): Operator panelinden kaydedilen operasyonel odemeler encryption key olmadan calisir.
- **Gercek PSP credential islemleri**: `upsertWexPayProviderCredential` ve stub adapter credential kontrolu icin en az **32 byte** guclu rastgele key gerekir (or. `openssl rand -hex 32`). Plaintext secret repoda veya loglarda tutulmaz.
- Opsiyonel: `WEXPAY_PROVIDER_MODE=TEST|LIVE` (varsayilan: non-production `TEST`, production `LIVE`).

Detay: `docs/wexpay-payment-provider-adapters.md`, `PRODUCTION_CHECKLIST.md`.
