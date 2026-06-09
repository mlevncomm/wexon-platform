# WexApp Handoff

WexApp/WexPay MVP gelistirmesi bu dosyadaki kurallara gore baslar.

## Demo Ve Gercek App Ayrimi

Su an seed edilen `mavi-bahce-demo` verisi demo/stok baslangic datasidir.

Gercek WexPay app demo degildir.

- Gercek app `/apps/wexpay/*` ve `/api/wexpay/*` uzerinden ilerler.
- Gercek app `/api/wexpay/demo/*` endpoint'lerini temel almaz.
- Demo endpoint'leri sadece public demo, test ve vitrin akislari icindir.
- Gercek app tenant'i session veya API key ile cozer.
- Gercek app verisi `Organization.isDemo = false` olan musteri organizasyonlarinda calismalidir.
- Demo restoran slug'lari veya sabit demo branch slug'lari gercek app icinde kullanilmaz.
- Gercek app testleri icin `npm.cmd run prisma:seed:real` komutu `isDemo=false` bos bir WexPay musteri tenant'i olusturur.

## Merkezi Kural

Wexon Core, access kararinin tek kaynagidir.

WexApp su sorulara kendi basina cevap vermez:

- Bu organization WexPay kullanabilir mi?
- Bu organization su feature'i kullanabilir mi?
- Bu organization su kotayi asti mi?
- Odeme veya subscription durumu yuzunden access kapanmali mi?

Bu kararlar `lib/wexon-core-access.ts` icinden alinmalidir.

## Kullanilacak Helper'lar

- Product/app girisi: `requireProductAccess`
- Access hesaplama: `evaluateProductAccess`
- Entitlement limit kontrolu: `assertEntitlementLimit`
- Production WexPay API context: `requireWexPayApiContext`
- Audit log: `writeAuditLog`

## WexPay API Kurallari

- Customer/session istekleri session organization ile calisir.
- API key istekleri hashlenmis key lookup ile calisir.
- API key raw value database'e yazilmaz.
- Mutation endpoint'leri `wexpay:write` scope ister.
- Read endpoint'leri `wexpay:read` veya daha dar read scope kullanabilir.
- Tenant filtresi olmayan query kabul edilmez.
- Branch bazli verilerde `organizationId` ve `branchId` birlikte uygulanir.

## WexPay Mutation Kurallari

Her create/update/delete akisi:

1. Core access karari alir.
2. Tenant/branch izolasyonunu uygular.
3. Entitlement limitini kontrol eder.
4. Domain kaydini transaction icinde yazar.
5. Audit log'u ayni transaction icinde yazar.

## Billing Ayrimi

- `BillingPayment`: Wexon Core billing/payment kaydi.
- `Payment`: WexPay operasyonel restoran/kafe odeme kaydi.

WexPay order/payment akisi Core billing state'i access karari gibi kullanmaz.

## Baslangic Sirasi

1. WexPay tenant-aware data model ve route map kontrolu.
2. `isDemo=false` real test tenant bootstrap.
3. Restaurant, branch, table, menu ve kategori mutationlari.
4. Server-side entitlement enforcement.
5. Restaurant admin paneli.
6. QR public ordering flow.
7. Order status and payment completion flow.
8. Smoke tests and build verification.

## Bloke Etmeyen Production Maddeleri

Asagidaki konular WexPay MVP yazimini bloke etmez, ama public production once tamamlanir:

- Provider payment adapter.
- Webhook event/delivery migration.
- Rate limiting.
- Password reset.
- Monitoring/error reporting.
- Backup and retention policies.
