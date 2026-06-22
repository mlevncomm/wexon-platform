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
- Gercek WexPay app `/api/wexpay/demo/*` endpoint'lerini kullanmaz.
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
| `DATABASE_URL` | Evet | Postgres baglanti URL'i (runtime). |
| `DIRECT_URL` | Evet | Postgres direct URL (migrate/seed; Prisma adapter). |
| `ADMIN_EMAILS` | Evet | Virgulle ayrilmis admin e-posta allowlist. |
| `ADMIN_LOGIN_PASSWORD` | Evet | MVP admin girisi (gecici; bkz. Security). |
| `ADMIN_SESSION_SECRET` | Evet | Admin oturum cookie imza secret'i. |
| `CUSTOMER_SESSION_SECRET` | Evet | Musteri oturum cookie imza secret'i. |
| `API_KEY_HASH_SECRET` | Evet | API key hashleme icin HMAC secret/pepper. |
| `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` | Sanal POS baglantisi kullanilacaksa | Organization sanal POS API bilgilerinin sifrelenmesi (AES-256-GCM). Manuel tahsilat icin zorunlu degil. |
| `NEXT_PUBLIC_APP_URL` | Evet | Public canonical app URL (redirect/link uretimi). |

**Local / smoke (opsiyonel):** `.env.example` dosyasina bakin — `SMOKE_PORT`, `SMOKE_BASE_URL`, `SMOKE_CUSTOMER_PASSWORD`, `SMOKE_SKIP_WEB_SERVER`, `SMOKE_REUSE_SERVER`.

**Smoke oncesi seed:** `npm.cmd run prisma:seed` (demo) + `npm.cmd run prisma:seed:real` (real tenant + QR `WEXPAY-real-test-MASA-01`). Sonra `npm.cmd run test:smoke:build`.

**Production env script:** `npm.cmd run production:check` (zorunlu degiskenler). Sanal POS icin: `npm.cmd run production:check:psp`.

**Migration preflight (seed/smoke calistirmaz):** `npm.cmd run production:preflight` — env check + `db:check:payment-provider-ref` + `prisma:migrate:deploy`.

**Staging validation (migrate sonrasi):** `npm.cmd run staging:validate` — `prisma:seed:real` + `test:unit` + `test:smoke:build`.

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
- [ ] `npm run staging:validate` exit 0 (seed:real + unit + smoke:build; staging DB gerekir).
- [ ] `CUSTOMER_DEV_LOGIN_PASSWORD` production'da **tanimli degil** veya bos (dev fallback kapali).
- [ ] Secret degerler repoda, commit mesajlarinda veya loglarda gorunmuyor.

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
- `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` (sanal POS baglantisi / inbound webhook acilacaksa)
- `NEXT_PUBLIC_APP_URL`

### Database

**Local development:** `npm run prisma:migrate:dev` (`prisma migrate dev`). `prisma:migrate` geriye uyumluluk alias'idir.

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
- [ ] Sanal POS baglantisi rotation policy: yeni API bilgisi ile upsert, eski baglanti `isActive=false`, audit (`wexpay.provider_credential.deactivated`) ve fingerprint takibi.
- [ ] **Phase 7 on kosullari (gercek PSP acilmadan once):**
  - [ ] Inbound webhook route'lari (or. `/api/wexpay/webhooks/paytr`) — demo route'lara dokunulmadan.
  - [ ] Raw body okuma (JSON parse oncesi byte dizisi).
  - [ ] Provider signature verification (`verifyCallback` + tenant credential).
  - [ ] Duplicate event protection (`provider` + `providerEventId` unique; `receiveWexPayWebhookEvent` duplicate donusu).
  - [ ] Transaction icinde `Payment` guncelleme + `syncTableStatus` + audit.
- [ ] PayTR / iyzico / Param adapter implementasyonu (stub yerine gercek API; Phase 7).

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
