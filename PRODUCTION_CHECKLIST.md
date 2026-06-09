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
- Gercek WexPay app testi icin `npm.cmd run prisma:seed:real` ile bos bir `isDemo=false` tenant olusturulabilir.
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

- `DATABASE_URL`
- `DIRECT_URL`
- `ADMIN_EMAILS`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `CUSTOMER_SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- Local development fallback password production'da devre disi olmali.

### Database

- `npx prisma migrate deploy`
- `npx prisma generate`
- Production products/plans seed dogrulamasi.
- WexPay plans ve entitlements dogrulamasi.
- Backup stratejisi.
- Connection pool ayarlari.
- Public API acilmadan once RLS/DB exposure stratejisi.

### Security

- HTTPS ve secure cookie zorunlulugu.
- Admin/customer login rate limiting.
- Brute-force protection.
- Password reset flow.
- Session hardening.
- Monitoring ve structured logging.
- Error reporting.

### Billing And Webhooks

- Invoice numbering policy.
- Tax calculation policy.
- Manuel/mock payment yerine provider adapter secimi.
- PayTR, iyzico veya Param entegrasyonu.
- Webhook signature verification.
- Raw body validation.
- Webhook idempotency ve duplicate event protection.
- `WebhookEvent` / `WebhookDelivery` migration'i, `docs/webhook-event-idempotency-design.md` onaylandiktan sonra eklenmeli.

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
