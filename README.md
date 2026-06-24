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
npm run prisma:migrate:dev
npm run prisma:seed
npm run prisma:seed:real
npm run test:smoke:build
```

### Staging deploy (merge sonrasi, DB-backed dogrulama)

**Migration oncesi (seed/smoke calistirmaz):**

```bash
npm run production:preflight
npm run prisma:generate
```

`production:preflight` = `production:check` + `db:check:payment-provider-ref` + `prisma:migrate:deploy`.

**Tam staging dogrulama (migrate sonrasi):**

```bash
npm run production:check
npm run db:check:payment-provider-ref
npm run prisma:migrate:deploy
npm run prisma:generate
npm run prisma:seed:real
npm run test:unit
npm run test:smoke:build
```

Kisa yol (migrate sonrasi seed + testler): `npm run staging:validate`

Sanal POS acilacaksa ayrica: `npm run production:check:psp` (PayTR/PSP acilmayacaksa zorunlu degil).

**Env kaynagi:**

- Local/staging preflight: `.env` + `.env.local` veya shell env gerekir. `production:check` bu dosyalari okur; host uzerindeki `process.env` her zaman onceliklidir.
- Production deploy: env degiskenleri Vercel (veya kullanilan host) dashboard / env provider uzerinden gelmelidir; secret degerler loglanmaz.

**DB troubleshooting (staging:validate / seed:real):**

Staging validation DB erisimi olmadan full pass sayilmaz. `ENOTFOUND` veya connection hatasi gorurseniz:

- Supabase project aktif ve paused degil mi?
- `DIRECT_URL` dogru mu? (migrate/seed icin direct connection)
- `DATABASE_URL` dogru mu? (runtime pooler)
- Pooler vs direct host uyumlu mu? (Session pooler port 6543, direct 5432)
- DNS / network / VPN erisimi var mi?

**Local development** (`migrate dev`):

```bash
npm run prisma:migrate:dev
```

`prisma:migrate` geriye uyumluluk icin `migrate dev` alias'idir. Staging/production icin `prisma:migrate:deploy` kullanin.

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

## Zorunlu production environment

Repoda yalnizca [`.env.example`](.env.example) (placeholder) bulunur; gercek degerler commit edilmez.

| Degisken | Rol |
|----------|-----|
| `DATABASE_URL` | App/runtime — Supabase **transaction pooler** (`?pgbouncer=true`, port 6543) |
| `DIRECT_URL` | `prisma migrate deploy`, seed, `production:preflight` — direct/session (port 5432) |
| `ADMIN_EMAILS` | Admin allowlist |
| `ADMIN_LOGIN_PASSWORD` | MVP admin girisi |
| `ADMIN_SESSION_SECRET` | min 32 karakter |
| `CUSTOMER_SESSION_SECRET` | min 32 karakter |
| `API_KEY_HASH_SECRET` | min 32 karakter |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL (PayTR webhook/redirect) |
| `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` | Sanal POS credential sifreleme (PSP acilacaksa zorunlu) |

**Opsiyonel / dev-only:** `CUSTOMER_DEV_LOGIN_PASSWORD` — yalnizca local dev; production'da tanimli olmamali.

**PSP (env'e credential yazilmaz):** `WEXPAY_PAYTR_ENABLE_API`, `WEXPAY_PROVIDER_MODE`. PayTR/iyzico/Param API bilgileri DB'de sifreli (`WexPayProviderCredential`).

Dogrulama: `npm run production:check` (local: `.env` + `.env.local`).

## Production oncesi Supabase database password rotate

Eger database password daha once paylasildiysa veya production oncesi guvenlik gerekiyorsa **kodla rotate yapilmaz**; Supabase Dashboard uzerinden yapilir:

1. Supabase Dashboard → Project Settings → Database → **Reset database password**
2. Yeni password ile `DATABASE_URL` (pooler) ve `DIRECT_URL` (direct) degerlerini Vercel Production + local staging env'de guncelle
3. Eski password'u repoya, commit mesajina veya loglara yazma
4. Rotate sonrasi: `npm run production:preflight` (baglanti + migrate deploy dogrulama)

## Vercel deploy runbook

Vercel build migration **calistirmaz**. `prisma migrate deploy` yalnizca deploy oncesi local/staging'de `npm run production:preflight` ile kosulur. `vercel.json` gerekmez; `package.json` build = `prisma generate && next build`. Node **>= 20**.

1. GitHub repo'yu Vercel'e bagla
2. Production environment'a zorunlu env var'lari gir (yukaridaki tablo; PSP acilacaksa `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` + `WEXPAY_PAYTR_ENABLE_API`)
3. Supabase DB password production oncesi rotate edildiginden emin ol
4. Local/staging (deploy oncesi):
   ```bash
   npm run production:check
   npm run production:preflight
   npm run test:smoke:build
   ```
5. Vercel deploy (build otomatik: `prisma generate && next build`)
6. Deploy URL ile `NEXT_PUBLIC_APP_URL` guncelle; PayTR bildirim URL'si bu base uzerinden calisir — gerekirse redeploy
7. Post-deploy: smoke + PayTR manual test (`PRODUCTION_CHECKLIST.md` → PayTR deploy notes)

PayTR webhook: `{NEXT_PUBLIC_APP_URL}/api/wexpay/webhooks/paytr`. Detay: `docs/wexpay-payment-provider-adapters.md`.
