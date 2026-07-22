# Wexon Core Readiness Checklist

Bu dosya iki ayrimi net tutar:

- WexApp/WexPay MVP gelistirmesine baslamak icin kapatilmis Core maddeleri.
- Gercek production lansmanindan once tamamlanacak, ama WexApp MVP'yi bloke etmeyen maddeler.

## WexApp'e Gecis Icin Tamamlananlar

- Core access karari `lib/wexon-core-access.ts` icinde merkezilestirildi.
- Urun uygulamalari lisans, abonelik, payment veya entitlement kararini kendi basina vermeyecek sekilde yonlendirildi.
- `requireProductAccess` ve entitlement assertion akisi ortak karar katmani olarak hazir.
- WexPay dashboard, admin metrikleri ve app girisi Core access kararini tuketiyor.
- WexPay demo API'leri `requireWexPayDemoContext` ile sinirlandi.
- Demo branch secimi deterministik hale getirildi; global branch fallback kaldirildi.
- Demo audit action isimleri `wexpay.demo.*` namespace'ine tasindi.
- Ortak audit helper `lib/wexon-audit.ts` eklendi.
- Production WexPay API guard scaffold'i `lib/wexpay-api-guard.ts` icinde hazir.
- `/api/wexpay/tables` production referans endpoint'i Core guard kullaniyor.
- WexPay API key kontrolu hashlenmis key ve scope bazli calisiyor.
- `wexpay:write` olmadan manage/mutation yetkisi verilmiyor.
- API key raw value sadece olusturma aninda kisa sureli httpOnly flash cookie ile gosteriliyor.
- BillingPayment Core billing kaydi, WexPay Payment operasyonel odeme kaydi olarak ayrik tutuluyor.
- Billing/payment state nihai access karari olarak kullanilmiyor.
- Next.js 16 icin `proxy.ts` kullaniliyor.
- Google Fonts runtime fetch kaldirildi; font family `Urbanist`.
- Public, dashboard, admin ve WexPay yuzeyleri build icinde dogrulandi.

## WexApp/WexPay MVP Kurallari

- Seed edilen stok demo data gercek WexPay app'in kendisi degildir.
- Gercek WexPay app public sandbox `/demo/wexpay*` veya eski demo API'lerine bagli degildir.
- Gercek WexPay app `Organization.isDemo = false` olan musteri tenant'lari icin tasarlanir.
- Gercek WexPay app testi icin `npm.cmd run prisma:seed:real` ile `isDemo=false` tenant olusturulabilir (restoran, masa, QR menu + inactive license fixture dahil).
- Sabit demo restaurant/branch slug'lari gercek app icine tasinmaz.
- Her WexPay server action/API once Core karar katmanindan gecmeli.
- Session tabanli isteklerde organization/tenant session'dan cozulmeli.
- API key tabanli isteklerde organization `ApiKey.organizationId` uzerinden cozulmeli.
- Product uygulamasi dogrudan `License.status`, `Subscription.status` veya `BillingPayment.status` okuyarak access karari vermemeli.
- Her operasyonel mutation `organizationId` ve gerekiyorsa `branchId` filtresiyle tenant izolasyonu uygulamali.
- Branch, table, product, staff gibi limitli kaynaklarda mutation oncesi entitlement limiti enforce edilmeli.
- Kritik mutationlar ayni transaction icinde audit log yazmali.
- Admin override akislari audit log olmadan uygulanmamali.
- WexPay operasyonel odeme kayitlari Core invoice/payment kayitlariyla karistirilmamali.

## Production Lansmani Oncesi Kalanlar

Bu maddeler MVP gelistirmesini bloke etmez, fakat public production oncesi kapatilmalidir.

### Environment

#### Deploy oncesi zorunlu env listesi

Asagidaki degiskenler production deploy oncesi tanimli olmalidir. `.env` dosyalari repoya commit edilmez; degerler Vercel (veya kullanilan host) **Environment Variables** uzerinden verilir.

| Degisken | Zorunlu | Aciklama |
|----------|---------|----------|
| `DATABASE_URL` | Evet | Postgres runtime (Supabase **transaction pooler**, `?pgbouncer=true`, port 6543). `lib/prisma.ts` oncelikli kullanir. |
| `DIRECT_URL` | Evet | Postgres direct/session (migrate, seed, `production:preflight`; port 5432). Runtime fallback. |
| `ADMIN_EMAILS` | Evet | Virgulle ayrilmis admin e-posta allowlist. |
| `ADMIN_LOGIN_PASSWORD` | Evet | MVP admin girisi (gecici; bkz. Security). |
| `ADMIN_SESSION_SECRET` | Evet | Admin oturum cookie imza secret'i. |
| `CUSTOMER_SESSION_SECRET` | Evet | Musteri oturum cookie imza secret'i. |
| `API_KEY_HASH_SECRET` | Evet | API key hashleme icin HMAC secret/pepper. |
| `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` | Sanal POS baglantisi kullanilacaksa | Organization sanal POS API bilgilerinin sifrelenmesi (AES-256-GCM). Manuel tahsilat icin zorunlu degil. |
| `NEXT_PUBLIC_APP_URL` | Evet | Public canonical app URL (redirect/link uretimi). |
| `MAINTENANCE_MODE` | Evet | Canli hizmette `false`; yalnizca on basvuru moduna almak icin `true`. |
| `WEXPAY_PAYTR_ENABLE_API` | Evet | Ilk production acilisinda `false`; PayTR sadece Kurucu Isletmeler Programi dogrulamasindan sonra acilir. |

**Local / smoke (opsiyonel):** `.env.example` dosyasina bakin — `SMOKE_PORT`, `SMOKE_BASE_URL`, `SMOKE_CUSTOMER_PASSWORD`, `SMOKE_SKIP_WEB_SERVER`, `SMOKE_REUSE_SERVER`.

**Smoke oncesi seed:** `npm.cmd run prisma:seed` (demo) + `npm.cmd run prisma:seed:real` (real tenant + QR `WEXPAY-real-test-MASA-01`). Sonra `npm.cmd run test:smoke:build`.

**Production env script:** `npm.cmd run production:check` (zorunlu degiskenler; local icin `.env` + `.env.local` okur, host `process.env` oncelikli). Sanal POS **acilacaksa**: `npm.cmd run production:check:psp` (PayTR/PSP acilmayacaksa zorunlu degil).

**Local/staging preflight:** `.env.local` veya shell env gerekir. Production host uzerinde env Vercel dashboard / env provider'dan gelmelidir.

**Migration preflight (seed/smoke calistirmaz):** `npm.cmd run production:preflight` — env check + `db:check:payment-provider-ref` + `prisma:migrate:deploy`.

**Staging validation (migrate sonrasi):** `npm.cmd run staging:validate` — `prisma:seed:real` + `test:unit` + `test:smoke:build`. **DB erisimi olmadan full pass sayilmaz.**

**DB troubleshooting (`ENOTFOUND`, connection refused):**

- Supabase project aktif mi?
- `DIRECT_URL` ve `DATABASE_URL` dogru mu?
- Pooler (6543) vs direct (5432) host uyumu
- DNS / network / VPN

**Unit tests:** `npm.cmd run test:unit` (PayTR hash/amount + public checkout amount; webhook integration requires DB).

**Deploy oncesi kontrol:**

- [ ] Tum zorunlu degiskenler **Production** environment'inda set edildi.
- [ ] `API_KEY_HASH_SECRET`: Zorunlu (local `.env.local` + Vercel Production). API key hashleme icin HMAC secret/pepper olarak kullanilir; kodda fallback yoktur, eksikse uygulama kontrollu hata verir. **Vercel Production environment'a eklenmeden deploy yapilmamali.**
- [ ] `WEXPAY_CREDENTIAL_ENCRYPTION_KEY`: PayTR / iyzico / Param sanal POS baglantisi veya inbound webhook acilacaksa zorunlu. En az **32 byte** guclu rastgele deger (or. `openssl rand -hex 32`). Manuel tahsilat (`provider=manual`) icin deploy bloklayici degildir.
- [ ] Smoke: `npm run build` sonrasi `npm run test:smoke` (Playwright) gecti.
- [ ] `npm run production:check` exit 0 (deploy oncesi env dogrulama).
- [ ] `npm run db:check:payment-provider-ref` exit 0 (duplicate providerRef yok).
- [ ] `npm run production:preflight` exit 0 (env + duplicate check + migrate deploy; seed/smoke icermez).
- [ ] `npm run prisma:generate` basarili (migrate deploy sonrasi).
- [ ] `npm run staging:validate` exit 0 (seed:real + unit + smoke:build; staging DB gerekir — DB yoksa skip, sahte pass yok).
- [ ] `npm run production:check:psp` exit 0 **yalnizca** PayTR/sanal POS acilacaksa.
- [ ] `CUSTOMER_DEV_LOGIN_PASSWORD` production'da **tanimli degil** veya bos (dev fallback kapali).
- [ ] `MAINTENANCE_MODE=false` (site ve paneller canli; on basvuru modu kapali).
- [ ] `WEXPAY_PAYTR_ENABLE_API=false` (ilk acilista manual tahsilat aktif; PayTR genel kullanima kapali).
- [ ] Secret degerler repoda, commit mesajlarinda veya loglarda gorunmuyor.
- [ ] **Supabase DB password** production oncesi rotate edildi; eski credential devre disi (Dashboard → Database → Reset password; sonra `DATABASE_URL` + `DIRECT_URL` guncelle).
- [ ] `admin.wexon.dev` Cloudflare Access arkasinda; sadece gercek admin e-postalari girebiliyor.
- [ ] Cloudflare WAF/rate limit aktif: `/login`, `/admin/*`, `/dashboard/login`, `/api/wexpay/public/*`, `/api/wexpay/webhooks/paytr`.
- [ ] `npm audit --omit=dev` calistirildi; kalan advisory'ler degerlendirildi ve kabul edilen riskler not edildi.
- [ ] `npm audit fix --force` kullanilmadi; Next/Prisma major downgrade onerileri manuel review olmadan uygulanmadi.
- [ ] Multi-instance production icin rate limit storage Redis/Upstash/edge WAF'a tasindi veya tek-instance siniri bilincli kabul edildi.
- [ ] Admin shared-password auth production genis kullanima acilmadan once per-admin credentials + MFA planlandi.

**Notlar:**

- `API_KEY_HASH_SECRET` icin guclu, rastgele bir deger kullanin (or. `openssl rand -hex 32`). `ADMIN_SESSION_SECRET` ile ayni deger olmamali.
- Mevcut API anahtarlari legacy plain SHA-256 hash ile calismaya devam eder; yeni olusturulan anahtarlar HMAC-SHA256 ile saklanir. Production oncesi anahtarlari rotate etmek onerilir.
- Local development fallback password production'da devre disi olmali.

**Iliskili maddeler (onceki liste):**

- `DATABASE_URL`
- `DIRECT_URL`
- `ADMIN_EMAILS`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `CUSTOMER_SESSION_SECRET`
- `API_KEY_HASH_SECRET`
- `MAINTENANCE_MODE`
- `WEXPAY_PAYTR_ENABLE_API`
- `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` (sanal POS baglantisi / inbound webhook acilacaksa)
- `NEXT_PUBLIC_APP_URL`

### Database

**Production oncesi DB password rotate (zorunlu guvenlik adimi):**

1. Supabase Dashboard → Project Settings → Database → Reset database password
2. `DATABASE_URL` (pooler) ve `DIRECT_URL` (direct) Vercel + staging env'de guncelle — secret commit etme
3. `npm run production:preflight` ile baglanti ve migration dogrula

**Supabase PostgREST / RLS (Prisma-only mimari):**

- RLS + `anon`/`authenticated` REVOKE production'da uygulanmistir (`20260718180000_supabase_rls_and_revoke_anon`).
- Uygulama `@supabase/supabase-js` kullanmaz; DB erisimi Next.js + Prisma (`postgres` / `postgres.[ref]`, `rolbypassrls`).
- `wexon_app` su anda **NOLOGIN ve inert** (LOGIN yok; Vercel `DATABASE_URL` hala `postgres`). `wexon_app_all` policy'leri tenant izolasyonu **saglamaz** — yalniz server-side runtime role icin permissive grant scaffold'idir.
- Vercel role switch (`DATABASE_URL` → `wexon_app`) **ayri, ileride** yapilacak bir gorevdir; migrate icin `DIRECT_URL` `postgres` kalsin.
- Tenant JWT policy (Supabase Auth `auth.uid()`) **ertelenmistir** — session auth uygulama katmaninda; DB tenant RLS P2.
- PostgREST risk mitigasyonu dogrulama: Security Advisor `rls_disabled_in_public` = 0; `has_table_privilege('anon', ...)` SELECT/INSERT = false.
- Not: Data API UI toggle / anon key rotate Dashboard karari (uygulama anon key kullanmiyor).

**Backup / PITR (musteri onboarding oncesi zorunlu):**

- Free plan: otomatik daily backup ve PITR **yok**. Pro+ daily backup ayri operasyon karari; PITR add-on ayri.
- Disaster-recovery backup **yalniz** su uc kosul tamamlaninca "tamamlandi" sayilir:
  1. PostgreSQL **17+** `pg_dump -Fc` custom archive (`npm run db:backup`)
  2. Izole/ephemeral PostgreSQL 17 restore testi PASS (`WEXON_ALLOW_LOCAL_DB_TESTS=1 npm run db:backup:test-restore -- <archive>`) → `RESTORE VERIFIED`
  3. Kullanici offsite kopya → aksi halde `PENDING USER COPY` (offsite olmadan "Backup tamamlandi" denmez)
- `npm run db:export:jsonl` = **NOT A DISASTER-RECOVERY BACKUP** (debug export).
- Eski Node/JSONL `.backups/*.jsonl.gz` ciktilari: **RECOVERY BACKUP OLARAK DOĞRULANMADI**.
- Dump/archive dosyasini git/Slack/chat'e koyma.

**Local development:** `npm run prisma:migrate:dev` (`prisma migrate dev`). `prisma:migrate` geriye uyumluluk alias'idir.

#### Vercel production deploy runbook

Migration Vercel build sirasinda **otomatik kosulmaz**. Deploy oncesi local/staging'de preflight zorunludur.

1. GitHub repo → Vercel project bagla
2. Production env var'lari gir (zorunlu liste: Environment bolumu)
3. DB password rotate tamam
4. Local/staging: `npm run production:check` → `npm run production:preflight` → `npm run test:smoke:build`
5. Vercel deploy (`build` = `prisma generate && next build`; Node >= 20)
6. Deploy URL → `NEXT_PUBLIC_APP_URL` guncelle (+ PayTR panel bildirim URL) → gerekirse redeploy
7. Post-deploy smoke + PayTR manual test (asagida)

`vercel.json` gerekmez.

#### Domain / subdomain mimarisi

Tek Vercel projesi asagidaki hostlari kabul eder; `proxy.ts` host'a gore ilgili panel route'una rewrite eder.

| Host | Rol | Route |
|------|-----|-------|
| `wexon.dev` | Public website | `/` |
| `www.wexon.dev` | Public website alias | `/` |
| `core.wexon.dev` | Wexon Core / musteri portali | `/dashboard` |
| `app.wexon.dev` | WexPay restoran app'i | `/apps/wexpay` |
| `admin.wexon.dev` | Wexon Admin Portal | `/admin` |

Cloudflare DNS baslangic kayitlari:

```text
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com
CNAME  core   cname.vercel-dns.com
CNAME  app    cname.vercel-dns.com
CNAME  admin  cname.vercel-dns.com
```

Ilk dogrulamada proxy status **DNS only** olsun. Vercel domain validation ve SSL tamamlandiktan sonra Cloudflare WAF/proxy ayarlari acilabilir.

`NEXT_PUBLIC_APP_URL=https://app.wexon.dev` onerilir; PayTR webhook URL:

```text
https://app.wexon.dev/api/wexpay/webhooks/paytr
```

#### Staging deploy runbook (onerilen sira)

**1. Migration oncesi** (seed/smoke calistirmaz):

```bash
npm run production:preflight
npm run prisma:generate
```

`production:preflight` = `production:check` + `db:check:payment-provider-ref` + `prisma:migrate:deploy`.

**2. Tam staging dogrulama** (migrate sonrasi):

```bash
npm run production:check
npm run db:check:payment-provider-ref
npm run prisma:migrate:deploy
npm run prisma:generate
npm run prisma:seed:real
npm run test:unit
npm run test:smoke:build
```

Kisa yol (adim 2 icin migrate sonrasi): `npm run staging:validate`

**Alias notlari:**

- `npm run db:check:payment-provider-ref` — `prisma:preflight:provider-ref` ile ayni script.
- `npm run prisma:migrate:deploy` — staging/production icin; asla `migrate dev` kullanmayin.
- Migration `20260609120000_payment_provider_ref_unique` oncesi duplicate check zorunlu.

**DB troubleshooting (staging validation):**

- `staging:validate` DB erisimi olmadan full pass sayilmaz.
- `ENOTFOUND` / connection refused: Supabase project aktif mi, `DIRECT_URL`/`DATABASE_URL` dogru mu, pooler vs direct host, DNS/network kontrol edin.

- Production products/plans seed dogrulamasi.
- WexPay plans ve entitlements dogrulamasi.
- WexPay provider credential + inbound webhook foundation migration'i (`WexPayProviderCredential`, `WexPayWebhookEvent`) deploy edildi. Bkz. `prisma/migrations/20260608160000_add_wexpay_provider_webhook_foundation`.
- Backup stratejisi.
- Connection pool ayarlari.
- Public API acilmadan once RLS/DB exposure stratejisi.

### Security

- HTTPS ve secure cookie zorunlulugu.
- Admin/customer login rate limiting (`lib/wexon-rate-limit.ts` — IP + e-posta bucket'lari).
- PayTR inbound webhook rate limiting (`paytrWebhook` bucket, IP bazli; cok instance icin Redis notu).
- Public QR order/checkout rate limiting (`publicQrOrder`, `publicQrCheckout`).
- WexPay API rate limiting (`wexpayApi` bucket).
- Security headers (`next.config.ts`): CSP, HSTS, frame denial, nosniff, referrer policy, permissions policy, cross-origin policies.
- Brute-force protection.
- Password reset flow.
- Session hardening (`secure` production cookie, `sameSite`, TTL dokumantasyonu).
- Webhook amount validation (PayTR `total_amount` vs `Payment.amount`).
- Error message sanitization (public/API/webhook route'lari; secret/plaintext log yok).
- Monitoring ve structured logging.
- Error reporting.
- **Cok instance deploy:** In-memory rate limit store process-bazlidir; production'da Redis/Upstash ile degistirin.

### Billing And Webhooks

**Odeme mimarisi (WexPay):**

- Wexon / WexPay odeme kurulusu veya para saklama katmani degildir; musteri odemesi firma–PSP–banka akisinda ilerler.
- Restoran operasyon tahsilati (`Payment`) ile Wexon SaaS aboneligi (`BillingPayment`) ayri urun hatlaridir.
- Sanal POS entegrasyonu organization bazli `WexPayProviderCredential` (urun dili: sanal POS baglantisi) ile yapilir; firma kendi PayTR / iyzico / Param anlasmasini baglar.
- Manuel tahsilat (`provider=manual`) sanal POS baglantisi gerektirmez.

**Core billing (platform abonelik / fatura):**

- Invoice numbering policy.
- Tax calculation policy.
- Manuel/mock payment yerine Core billing provider adapter secimi.
- PayTR, iyzico veya Param entegrasyonu (Core `BillingPayment` icin).
- Core outbound `WebhookEvent` / `WebhookDelivery` migration'i, `docs/webhook-event-idempotency-design.md` onaylandiktan sonra eklenmeli.

**WexPay operasyonel odeme (masa / QR checkout — Core BillingPayment'dan ayri):**

- [x] Sanal POS baglantisi storage foundation (`WexPayProviderCredential`, sifreli API bilgileri). Bkz. `lib/wexpay-provider-credentials.ts`, `docs/wexpay-payment-provider-adapters.md`.
- [x] Inbound webhook event / idempotency ledger foundation (`WexPayWebhookEvent`). Bkz. `lib/wexpay-webhook-events.ts`.
- [x] Sanal POS baglantisi rotation policy: once `PENDING` odeme/callback uzlastirma, sonra tek kayda atomik upsert + secili aktivasyon metadata refresh + fingerprint/audit takibi. Immutable credential surumu bu semada yoktur; rotasyon oncesi uzlastirma zorunludur.
- [x] **Phase 7 on kosullari (PayTR foundation — operator + public QR):**
  - [x] Inbound webhook route `/api/wexpay/webhooks/paytr` (demo route'lara dokunulmadi).
  - [x] Raw body okuma (JSON parse oncesi byte dizisi).
  - [x] Provider signature verification (`verifyCallback` + tenant credential).
  - [x] Duplicate event protection (`provider` + `providerEventId` unique; `receiveWexPayWebhookEvent` duplicate donusu).
  - [x] Transaction icinde `Payment` guncelleme + `syncTableStatus` + audit.
- [x] PayTR adapter foundation (`lib/wexpay-paytr-adapter.ts`); canli API `WEXPAY_PAYTR_ENABLE_API=true` + DB credential ile.
- [ ] iyzico / Param: stub only — production-live degil.

**Stale pending reconciliation (operasyonel Payment, BillingPayment degil):**

- Public checkout stale `PENDING` kayitlari `FAILED` + audit `wexpay.public.checkout.stale_pending_failed` ile kapatilir.
- `PaymentStatus` enum'unda `EXPIRED` yok; masa bakiyesi ve ciro raporlari (`PAID`/`PARTIAL`) etkilenmez.
- Risk: Eski PayTR checkout URL'si ile gec tahsilat + webhook `FAILED` terminal kaydina duserse reconciliation gerekir.
- Playbook: Audit'te `stale_pending_failed` ara → PayTR panelinde `providerRef` (merchant_oid) kontrol et → gerekirse manuel `PAID` duzeltmesi veya iade; secret/log'a dokunma.

### Data Governance

- Demo/test customer temizligi.
- AuditLog retention policy.
- Invoice/payment retention policy.
- Support ticket roadmap netlestirme.

## Final Smoke Test

- Admin login.
- Customer login.
- First password change.
- Organization creation.
- User/membership creation.
- WexPay access activation.
- License assignment.
- Dashboard tenant guard.
- API key creation and one-time display.
- WexPay allowed/denied states.
- `/api/wexpay/tables` unauthorized, forbidden and allowed states.
- Random 404 route.

## WexPay MVP Release Readiness

WexPay MVP kod tarafi tamam; asagidaki maddeler production lansman oncesi dogrulanir.

### Core / access

- [ ] `Product` kaydinda WexPay urunu mevcut (seed veya admin).
- [ ] Gercek musteri organization `isDemo=false`.
- [ ] Aktif license, app installation, subscription ve Core access (`requireProductAccess`) izin veriyor.
- [ ] Demo tenant (`isDemo=true`) gercek `/apps/wexpay/*` app'ine giremiyor.
- [ ] Entitlement limitleri (branch, table, staff, vb.) server-side enforce ediliyor.

### Restaurant app

- [ ] Restaurant / branch / table / menu CRUD
- [ ] Orders (mutfak akisi dahil)
- [ ] Payments (manuel + PayTR foundation)
- [ ] Receipts
- [ ] Kitchen ekrani
- [ ] Reports
- [ ] Public QR siparis ve odeme

### Payments

- [ ] Manuel tahsilat production-ready (`provider=manual`)
- [ ] PayTR foundation ready (operator panel + public QR checkout)
- [ ] PayTR canli/test icin: `WEXPAY_PAYTR_ENABLE_API=true`, sifreli provider credential (WexPay Settings), PayTR panelinde webhook URL
- [ ] iyzico / Param: stub only — production-live degil

### Security

- [ ] Tenant isolation (organizationId / branchId filtreleri)
- [ ] Audit logs (kritik mutation + access denial)
- [ ] API key hashing (`API_KEY_HASH_SECRET`)
- [ ] Credential encryption (`WEXPAY_CREDENTIAL_ENCRYPTION_KEY` + `WexPayProviderCredential`)
- [ ] Webhook: raw body, signature, idempotency (`WexPayWebhookEvent`)
- [ ] Rate limits (login, public QR, PayTR webhook, WexPay API)
- [ ] Supabase DB password production oncesi rotate edildi

### PayTR deploy notes

**Webhook URL (PayTR panel — Bildirim URL):**

```text
{NEXT_PUBLIC_APP_URL}/api/wexpay/webhooks/paytr
```

**Return / redirect:** `NEXT_PUBLIC_APP_URL` tabanli. Operator: `/apps/wexpay/payments?paytr=success|failed`. Public QR: PayTR donusunde polling banner; basari yalnizca `Payment.status=PAID` iken.

**Credential:** PayTR merchant bilgileri env'e yazilmaz; WexPay Settings → Sanal POS baglantisi (DB encrypted).

**Canli odeme manual test (staging/production):**

1. WexPay Settings → Sanal POS baglantisi ekle
2. TEST mode credential gir (PayTR test merchant)
3. Vercel/host'ta `WEXPAY_PAYTR_ENABLE_API=true`
4. Public QR musteri ekranindan PayTR ile odeme baslat
5. PayTR donusunde "odeme isleniyor" mesaji gorunur (PAID olana kadar)
6. Webhook sonrasi `Payment` `PAID` veya `FAILED` olur
7. Masa hesabi ve raporlar guncellenir

Detay: `docs/wexpay-payment-provider-adapters.md`.

### Son kalite kapilari (release oncesi)

```bash
npm run production:check
npm run production:preflight
npm run test:unit
npm run test:smoke:build
npm run lint
npx tsc --noEmit
npm run build
```

`production:preflight` staging/production DB credential gerektirir.

**Son dogrulama (2026-06-08, local + Supabase):**

| Komut | Sonuc |
|-------|--------|
| `npm run production:check` | pass (8/8 required) |
| `npm run production:preflight` | pass (migrate deploy, no pending) |
| `npm run test:unit` | 34/34 pass |
| `npm run test:smoke:build` | 16/16 pass |
| `npm run lint` | pass |
| `npx tsc --noEmit` | pass |
| `npm run build` | pass (`prisma generate && next build`) |
