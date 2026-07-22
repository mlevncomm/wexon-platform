# WexPay Canlıya Geçiş Runbook'u

Bu runbook, WexPay **Akıllı Aktivasyon** sürecinden kontrollü **Canlıya Geçiş** ve ilk altı müşterinin **Kurucu İşletmeler Programı** kapsamında açılması için operasyon kaynağıdır. Üretim veritabanında mutation E2E, seed veya deneme ödemesi çalıştırılmaz. Her değişiklik yetkili operatör tarafından, müşteri bazında ve denetlenebilir kayıtlarla yürütülür.

## 1. Ödeme modeli ve sorumluluk sınırları

### MANUAL ve PAYTR

- `MANUAL`, restoranın ödemeyi kasada veya kendi harici kanalıyla tahsil ettiği modeldir. WexPay ödeme talebini ve operasyon kaydını yönetir; tahsilatı otomatik doğrulamaz. Sağlayıcı kimlik bilgisi girilmez ve işletme bu sorumluluğu Akıllı Aktivasyon sırasında açıkça onaylar.
- `PAYTR`, misafirin QR akışından işletmenin PayTR hesabına yönlendirildiği çevrim içi tahsilat modelidir. WexPay ödeme kaydını açar, PayTR token'ı üretir ve imzalı callback sonucuyla kaydı uzlaştırır.
- PAYTR seçimi, MANUAL akışını geriye dönük olarak ödeme alınmış saymaz. Sağlayıcı değişikliğinden önce açık ve `PENDING` ödemeler ayrı ayrı uzlaştırılır.

### Tenant merchant modeli

Her organizasyon kendi PayTR merchant hesabını ve kendi `Merchant ID`, `Merchant Key`, `Merchant Salt` bilgilerini kullanır. Platform genelinde paylaşılan bir WexPay merchant hesabı, split payout veya müşteriler arası credential fallback yoktur.

Tenant credential'ları ortam değişkenlerine yazılmaz. `WexPayProviderCredential` kaydında organizasyona ve `TEST`/`LIVE` moduna bağlı olarak, `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` ile şifreli saklanır. Yönetim yüzeylerinde yalnız maskeli değer ve fingerprint gösterilir; açık secret log, ekran görüntüsü, ticket veya dokümana alınmaz.

### Core abonelik PayTR'si ile tenant WexPay PayTR'sini ayırın

İki ödeme hattı birbirinden bağımsızdır:

1. **Wexon Core abonelik ödemesi**, Wexon lisansının/faturasının tahsilatıdır. Platform merchant bilgileri ve Core bayraklarıyla çalışır; callback'i `/api/billing/paytr/callback` hattıdır.
2. **Tenant WexPay ödemesi**, restoran müşterisinin masa/QR hesabını işletmenin kendi merchant hesabına ödediği ürün içi tahsilattır. Tenant credential'ı ve `WEXPAY_PAYTR_ENABLE_API` ile çalışır; callback'i `/api/wexpay/webhooks/paytr` hattıdır.

Core aboneliğinin başarılı olması tenant PAYTR credential'ını doğrulamaz. Tenant ödemesinin başarılı olması da Core lisans faturasını ödemez. Operasyon ve mutabakat kayıtlarını bu iki hat arasında taşımayın.

## 2. PayTR callback ve credential modları

PayTR merchant panelindeki bildirim URL'si canonical HTTPS origin ile tam olarak şu uç noktayı göstermelidir:

```text
https://<canonical-app-origin>/api/wexpay/webhooks/paytr
```

Callback:

- `merchant_oid` ile tek ödeme adayını bulur;
- ödemenin organizasyonuna ait aktif `LIVE` veya `TEST` credential'ıyla imzayı doğrular;
- tutarı kuruş bazında karşılaştırır;
- duplicate callback'i idempotent işler;
- doğrulama başarısızsa ödemeyi başarılı saymaz.

`TEST` ve `LIVE` credential'ları ayrı kayıtlardır. Yeni bağlantı varsayılan olarak `TEST` seçilerek doğrulanır. `LIVE` moda yalnız merchant paneli, callback URL'si, yetkili işletme onayı ve test sonuçları doğrulandıktan sonra geçilir. TEST credential'ını LIVE işlemde, LIVE credential'ını kontrollü test yerine kullanmayın.

Credential kaydının var olması gerçek bir ağ çağrısının veya başarılı tahsilatın kanıtı değildir. Config kontrolü yalnız biçim, tenant ilişkisi, aktif kayıt, mod, fingerprint ve şifre çözme hazırlığını kanıtlar.

## 3. `WEXPAY_PAYTR_ENABLE_API` güvenlik kapısı

`WEXPAY_PAYTR_ENABLE_API` yalnız tam olarak `true` olduğunda tenant PAYTR ödeme başlatımı açıktır.

Bayrak `false`, eksik veya farklı bir değerdeyken:

- yeni public PAYTR checkout başlatılmaz;
- PayTR token API'sine çağrı yapılmaz;
- istemci sahte bir “ödendi” sonucu göstermez; çevrim içi checkout kullanılamaz ve MANUAL/restoranda ödeme akışı korunur;
- mevcut lisans, menü, sipariş, garson çağrısı ve ödeme talebi akışları kendi yetkileri kapsamında çalışmaya devam eder;
- credential yapılandırması saklanıp doğrulanabilir, ancak bu çevrim içi tahsilatın açık olduğu anlamına gelmez.

Bayrağı kapatmak daha önce oluşturulmuş ödeme kayıtlarını silmez ve geri alma işlemi değildir. Daha önce PayTR'ye iletilmiş işlemlerin imzalı callback'leri güvenli biçimde karşılanmalı ve mutabakat kuyruğunda izlenmelidir. Bayrak ancak değişiklik kaydı, sorumlu kişi ve geri dönüş kararı belirlendikten sonra açılır.

## 4. Canlıya Geçiş önkoşul kontrol listesi

Her organizasyon için sırayla doğrulayın:

- [ ] Organizasyon aktif, demo değil; OWNER üyeliği ve yasal iletişim bilgileri doğru.
- [ ] WexPay ürünü aktif.
- [ ] Lisans `ACTIVE` veya geçerli `TRIAL`; başlangıç/bitiş tarihleri ve plan entitlement'ları doğru.
- [ ] `AppInstallation.status=ACTIVE` ve doğru lisansa bağlı.
- [ ] Aktivasyon ücreti durumu `PAID`, `WAIVED` veya yalnız eski kayıtlar için `WAIVED_LEGACY`.
- [ ] Akıllı Aktivasyon yolculuğu doğru organizasyon ve ürün için başlatılmış.
- [ ] İşletme profili, şube, masa/QR, personel, menü ve ödeme sağlayıcısı adımları tamamlanmış veya izin verilen adımlarda açık gerekçeyle atlanmış.
- [ ] En az bir aktif restoran, şube ve masa; aktif tenant QR zinciri ve lisanslı `feature_qr_payment` mevcut.
- [ ] MANUAL seçildiyse sorumluluk onayı kayıtlı ve provider credential alanları boş.
- [ ] PAYTR seçildiyse credential organizasyona ait, aktif, doğru modda ve config kontrolünün fingerprint'i güncel.
- [ ] `NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN` (yoksa `NEXT_PUBLIC_APP_URL`) canonical HTTPS origin'i gösteriyor.
- [ ] Doğrulama raporunda `FAIL` yok; tüm `WARNING` kayıtları sahibi ve kabul gerekçesiyle değerlendirildi.
- [ ] Rate limit/WAF ve dağıtık trafik sınırları `docs/wexpay-deployment-readiness.md` uyarılarına göre değerlendirildi.

### READY, ACTIVE değildir

`ActivationJourney.status=READY`, doğrulamanın tamamlandığını ve Canlıya Geçiş onayının verilebileceğini ifade eder. Public QR erişimini açmaz.

Public erişimin merkezi kapısı `ActivationJourney.status=ACTIVE` değeridir. Yetkili kullanıcı Canlıya Geçiş onayını verdiğinde doğrulama aynı transaction içinde yeniden çalışır. Yeni bir `FAIL` oluşursa yolculuk `BLOCKED` durumuna ve doğrulama adımına döner; `ACTIVE` yapılmaz. Yalnız başarılı son doğrulamadan sonra `ACTIVE` oluşur ve public QR akışı açılır.

## 5. Resend ve personel daveti sağlığı

Üretim Vercel ortamında e-posta taşıması fail-closed çalışır:

- `WEXON_EMAIL_PROVIDER=resend`
- geçerli `RESEND_API_KEY`
- doğrulanmış gönderen içeren `WEXON_EMAIL_FROM`
- gerekiyorsa `WEXON_EMAIL_REPLY_TO`

`fake` sağlayıcı üretimde yasaktır; eksik veya geçersiz Resend yapılandırması davet gönderimini başarılı göstermez. Açılıştan önce domain doğrulaması, gönderen adresi, Resend hata/teslim kayıtları ve uygulamadaki davet delivery durumu birlikte kontrol edilir. Secret'ları loglamayın.

`StaffInvite` oluşturma, gönderim, yeniden gönderim, token gizliliği ve kabul akışı izole ortamda **fake adapter** ile kapsanmıştır. Bu görevde production uygulamasından davet smoke'u yapılmadı ve gerçek davet gönderilmedi; production uygulama davet smoke'u hâlâ bekleyen manuel kontroldür. Daha önce yapılmış production Resend taşıma doğrulaması yalnız tarihsel kanıt olarak kaydedilebilir; güncel uygulama davet akışının geçtiği anlamına gelmez.

## 6. İlk altı müşteri: Kurucu İşletmeler Programı

Müşterileri aynı anda açmayın. Her satır bir önceki müşterinin en az bir operasyon günü ve mutabakatı tamamlandıktan sonra ilerletilir:

- [ ] **Müşteri 1:** MANUAL ile temel açılış; lisans/kurulum/yolculuk, QR sipariş, mutfak-kasa ve gün sonu kayıtları.
- [ ] **Müşteri 2:** Müşteri 1 bulguları kapalı; aynı kontroller bağımsız tenant verisiyle tekrarlandı.
- [ ] **Müşteri 3:** PAYTR kullanılacaksa önce TEST credential/callback kanıtı, sonra ayrı değişiklik onayıyla LIVE; aksi halde MANUAL.
- [ ] **Müşteri 4:** İlk üç müşteride tenant ayrımı, ödeme referansı tekilliği ve destek yanıt süresi doğrulandı.
- [ ] **Müşteri 5:** Resend production uygulama davet smoke'u yetkili alıcıyla tamamlandı veya personel adımı açık gerekçeyle atlandı.
- [ ] **Müşteri 6:** Önceki beş müşterinin açık yüksek öncelikli bulgusu yok; kapasite, WAF/rate limit ve mutabakat sahibi onayladı.

Her müşteri için ayrıca şu kanıtları kaydedin:

1. Organizasyon, plan, lisans dönemi, aktivasyon ücreti ve `AppInstallation` durumu.
2. Yolculuk adım özeti, doğrulama raporu, `READY` zamanı, Canlıya Geçiş onayı ve `ACTIVE` zamanı.
3. Sağlayıcı (`MANUAL`/`PAYTR`), mod (`TEST`/`LIVE`), credential fingerprint'i ve callback yapılandırma kontrolü.
4. Bir masa QR açılışı, sipariş, mutfak/kasa görünürlüğü, ödeme talebi ve gün sonu raporu.
5. PAYTR açıksa küçük tutarlı yetkili gerçek işlem, callback sonucu, Payment kaydı ve PayTR panel mutabakatı. TEST işlemini müşteri tahsilatı olarak raporlamayın.
6. Operasyon sahibi, destek kişisi, acil durdurma kararı verecek kişi ve müşteri iletişim kanalı.

Bir müşteride tenant karışması, imza/tutar uyuşmazlığı, açıklanamayan `PENDING`, yanlış public erişim veya yüksek öncelikli güvenlik bulgusu varsa sıradaki müşteriye geçmeyin.

## 7. Secret rotasyonu ve mutabakat

### PayTR secret rotasyonu

1. Yeni secret'ı güvenli kanaldan alın; hiçbir zaman ticket, chat, commit veya loga yazmayın.
2. **Credential kaydını overwrite/rotate etmeden önce tüm `PENDING` ödemeleri ve beklenen callback'leri uzlaştırın.** Mevcut şema organizasyon+sağlayıcı+mod başına tek kayıt tutar; immutable credential sürümü bu fazda yoktur.
3. İlgili organizasyon ve doğru `TEST`/`LIVE` modu için credential'ı güncelleyin.
4. Maskeli değer ve fingerprint'in değiştiğini doğrulayın. Seçili PAYTR credential'ıysa tamamlanmış ödeme adımının yalnız güvenli fingerprint/config kontrol metadatası aynı transaction içinde yenilenir; adım yeniden açılmaz.
5. Genel doğrulama ve public ödeme kullanılabilirliğinin güncel credential'ı kabul ettiğini doğrulayın.
6. Eski secret'ın PayTR tarafında geçerliliğini, açık işlemler ve callback süresi hesaba katılarak sonlandırın.
7. Rotasyon öncesi/sonrası `PENDING`, `PAID`, `FAILED` ödemeleri; webhook event durumları, tutarlar ve PayTR paneliyle uzlaştırın.

`WEXPAY_CREDENTIAL_ENCRYPTION_KEY` rotasyonu tenant merchant secret rotasyonundan farklıdır. Şifreleme anahtarı değişikliği mevcut ciphertext'lerin kontrollü yeniden şifrelenmesini gerektirir; yalnız env değerini değiştirmek credential'ları okunamaz hale getirir. Ayrı bakım planı, yedek ve geri dönüş doğrulaması olmadan yapmayın.

### Günlük mutabakat

- PayTR panel toplamı ile WexPay `Payment` toplamını organizasyon, gün, para birimi ve durum bazında karşılaştırın.
- Duplicate callback'leri tek tahsilat olarak sayın.
- `payment_not_found`, `ambiguous_payment_ref`, `invalid_signature`, `amount_mismatch` ve uzun süreli `PENDING` kayıtlarını tek tek inceleyin.
- MANUAL tahsilatları PayTR toplamına katmayın; işletme kasa kanıtıyla ayrı uzlaştırın.
- Core `BillingPayment` kayıtlarını tenant WexPay `Payment` mutabakatına karıştırmayın.

## 8. Acil durdurma ve geri dönüş

Müşteri bazında acil durdurma için yönetim yüzeyinden:

1. Öncelikli ve geri alınabilir ürün kapısı olarak ilgili `AppInstallation` kaydını `DISABLED` yapın; veya
2. Sözleşme/finansal erişim de duracaksa ilgili lisansı `SUSPENDED` yapın.

Global çevrim içi PAYTR başlatımını durdurmak için `WEXPAY_PAYTR_ENABLE_API=false` uygulayın. Bu işlem diğer sağlayıcı ve public erişim kararlarının yerine geçmez. `ACTIVE` yolculuk yönetici blokajına alınmaz; müşteri bazında acil durdurma yalnız yukarıdaki `AppInstallation=DISABLED` veya `License=SUSPENDED` kapılarıyla yapılır ve müşteri iletişimi başlatılır.

Otomatik rollback yoktur. Bayrak, deployment, credential, lisans, kurulum, yolculuk ve ödeme durumları kendiliğinden önceki haline dönmez. Her geri dönüş yetkili kişi tarafından kapsamı belirlenerek uygulanır; açık ödemeler ve callback'ler uzlaştırılır, audit kaydı ve olay zaman çizelgesi tutulur. Şema geri dönüşü ayrıca planlanır; üretimde `prisma migrate reset`, otomatik seed veya doğrudan veri düzeltme çalıştırılmaz.

## 9. İzole doğrulama komutları

Yalnız izole/local veritabanı ve üretim dışı ortamda:

```bash
npm run test:unit
npm run test:unit:db
npm run test:e2e:wexpay-isolated
```

İzole güvenlik koşulları ve fake-adapter sınırları için `docs/wexpay-isolated-e2e.md` belgesini izleyin. Bu komutları production veritabanına karşı çalıştırmayın.
