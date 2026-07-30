# WexPay — Ödeme Talebi Yaşam Döngüsü ve Ödeme Yöntemi Mimarisi

Durum: **PLAN v2.1 — PR-A domain uygulandı** (staff/guest UX: PR-B / PR-C)
Kapsam: `app/wexpay/t/[qrCode]` (ve `/q/[token]`) genel misafir akışı, `app/api/wexpay/public/[qrCode]/*` route'ları, `lib/wexpay-service.ts`, `prisma/schema.prisma`, WexPay operatör uygulaması (`app/apps/wexpay/(panel)/*`).
İlgili dosyalar: `docs/wexpay-payment-provider-adapters.md` (PSP/PayTR tarafı — bu doküman onu değiştirmez, tamamlar).

---

## 0. Özet (TL;DR)

WexPay'in bu özellikteki gerçek değer önerisi **"garson çağırma" değil**. Müşteri zaten elini kaldırarak garson çağırabiliyor — buna rakip bir buton koymak zayıf kalır. Gerçek değer: **müşteri ödeme yöntemini ve masa/tutar bilgisini tek dokunuşla restorana iletir, personel ne soracağını bilmeden doğru donanımla (POS cihazı ya da sadece kasa defteri) masaya gelir.**

Bunun çalışması için dört şart var, hepsi bu planın zorunlu (faz 1) parçası:

1. **Kalıcı masa oturumu** — müşteri QR'ı bir kez okutup sipariş verdikten sonra tekrar QR okutmadan "Hesabım" ekranına dönebilmeli.
2. **Personelin talebi gerçekten kabul ettiği bir akış** — `ACKNOWLEDGED` durumu süslü bir alan değil, müşteriye doğru bilgi vermenin ön koşulu.
3. **Ödemenin gerçekten tamamlandığından emin olmadan talebi kapatmayan bir kural** — `Payment` oluşması yeterli değil, `PAID` + `remainingAmount = 0` şart.
4. **Müşterinin terminal durumu (ödendi/iptal) gerçekten görebileceği, tutarlı bir polling sözleşmesi** — v2'deki `activeAssistRequest` tasarımı bu konuda kendi kendini engelliyordu (bkz. §0.2, madde 1); bu v2.1'de düzeltildi.

### 0.1 Revizyon Notu (v1 → v2) — özet, detay için değişmedi

v1'deki backend temel kararları (yapılandırılmış yaşam döngüsü modeli, `provider`/`method` ayrımı, PayTR'ın opsiyonel kalması, "masa kartı" fikrinin kapsam dışı bırakılması) korundu; v2'de modal kaldırıldı, `ACKNOWLEDGED` faz 1'e alındı, operatör tarafı zorunlu hale geldi, otomatik `RESOLVED` kriteri `PAID + remainingAmount=0`'a düzeltildi, çift talep önleme eklendi, model alanları genişledi, müşteri copy'si sadeleşti.

### 0.2 Revizyon Notu (v2 → v2.1)

v2 mimari olarak doğruydu ama kodlamaya geçmeden önce 10 somut boşluk tespit edildi. Hepsi bu sürümde işlendi:

| # | v2'deki sorun | v2.1'deki çözüm |
|---|---|---|
| 1 | `activeAssistRequest`, yalnız `OPEN`/`ACKNOWLEDGED` döndürüyordu — talep `RESOLVED` olunca müşteri hiç göremeyebilirdi | İki ayrı, isim çakışmayan fonksiyon: `getActiveTableAssistRequest` (yalnız non-terminal, sayfa açılışında keşif için) + yeni **guest-safe `GET /assist-requests/[requestId]`** endpoint'i (tüm durumları, terminal dahil, `requestId` ile döner) — bkz. §5.4, §6.2 |
| 2 | `expiresAt` yalnız okuma anında kontrol ediliyordu; süresi geçmiş ama hâlâ `OPEN` görünen kayıt, unique index'i bloke edip yeni talebi engelleyebilirdi | Talep oluşturma transaction'ına **"süresi geçmişleri önce `CANCELLED` yap"** adımı eklendi — bkz. §5.1 |
| 3 | `localStorage` oturum flag'i süresiz kalıyordu | `expiresAt`/`tableSessionId` alanlı, 8-12 saatlik, bill boşalınca temizlenen bir kayda genişletildi — bkz. §2.1 |
| 4 | Personelin talebi bırakması (release) yoktu; üstlenilen talep sonsuza dek kilitli kalabilirdi | `releaseTableAssistRequest` eklendi + `ACKNOWLEDGED` iken `expiresAt` uzatılıyor — bkz. §5.2, §5.5 |
| 5 | Polling aralıkları belirsizdi (mevcut operasyon ekranı ~20 sn kullanıyor — bu ürünün değerini öldürür) | Personel kuyruğu 2-3 sn, müşteri durum kontrolü 4-6 sn, arka plan sekmede yavaşlatma, ses tekrarını önleyen `seenAssistRequestIds` — bkz. §7.2 |
| 6 | Aynı masada yöntem çakışması (biri nakit istedi, biri kart) tanımsızdı | `alreadyOpen` response'una mevcut talebin gerçek `paymentMethod`/`requestedAmount`'ı eklendi, UI net mesaj gösterir — bkz. §6.1 |
| 7 | Public endpoint kötüye kullanıma açıktı (fotoğraflanmış QR'dan uzaktan talep) | `payment-request` artık açık bakiye + aktif masa + yakın zamanlı sipariş kontrolü yapıyor — bkz. §8.1 |
| 8 | Aynı talep hem eski `BusinessNotification` listesinde hem yeni kuyrukta görünebilirdi | Genel bildirim listesi, kendi `TableAssistRequest`'i olan bildirimleri artık hiç göstermiyor (tek kaynak, kuyrukta) — bkz. §7.3 |
| 9 | Operatör API'sinde `inProgressAssistRequests` ve çakışma-cevabı (kim üstlendi) eksikti | Tip tanımı ve `acknowledgeTableAssistRequest` dönüş tipi genişletildi — bkz. §6.3, §5.2 |
| 10 | Route group (`(production)`) yanlışlıkla URL'ye dahilmiş gibi yazılmıştı | Her uçta "dosya yolu" / "HTTP path" ayrı ayrı yazıldı — bkz. §6.3 |

Ayrıca eklenenler: audit olay listesi (§9.3), rollout flag (§12), fiziksel ödeme/mali fiş ayrımı notu (§8.2).

---

## 1. Ürün Çerçevesi

### 1.1 Neden "garson çağır" yetersiz

Müşteri zaten elini kaldırarak garson çağırabiliyor — bu davranış hiçbir uygulama gerektirmiyor. QR üzerinden aynı şeyi ("garson çağır" butonu) sunmak müşteriye ekstra bir adım yükler (telefonu çıkar, QR'ı bul, butona bas) ve hiçbir gerçek kazanım sağlamaz. Bu yüzden mevcut "Garson Çağır" CTA'sı **korunur ama ikincil kalır** — asıl öne çıkarılan özellik değildir.

### 1.2 Gerçek değer önerisi

> Müşteri ödeme yöntemini seçer, restoran tam masa ve tutar bilgisiyle doğru ekipmanı (POS cihazı / kasa defteri) gönderir; talebin kabul edildiği ve ödemenin tamamlandığı canlı olarak görünür.

```text
Normal akış (QR'sız da aynı):
Müşteri el kaldırır → Garson gelir → "Hesabı alabilir miyiz?"
→ "Nakit mi kart mı?" → Garson geri gider → POS'u alır
→ Tekrar masaya gelir → Tutarı bulur/yazar → Ödeme alınır

WexPay akışı:
Müşteri daha önce QR'dan sipariş vermiştir → Hesabım ekranı zaten açık
→ "POS'u Masama Getir" tek dokunuş
→ Garson ekranında: Masa 7 · 860 TL · Kart-Fiziksel POS · 18 sn önce
→ Personel "Üstlen" der, doğrudan POS ile gelir
→ Ödeme alınır → Masa otomatik kapanır
```

Müşteri: QR'ı tekrar okutmaz, göz teması aramaz, ilk gelişi beklemez, yöntemi sözlü tekrar etmez, personelin POS almak için iki kez gidip gelmesini beklemez.

### 1.3 Ön koşul

Bu özelliğin "garson çağırma butonu"ndan güçlü olmasının tek şartı: **müşteri QR'ı yeniden okutmadan Hesabım ekranına dönebilsin.** Bu olmadan müşteri yine elini kaldırmayı tercih eder (bkz. §2). İkinci şart: personel talebi **saniyeler içinde** görsün (bkz. §7.2) — 20 saniyelik bir gecikme aynı sonucu doğurur.

---

## 2. Müşteri Deneyimi Tasarımı

### 2.1 Kalıcı masa oturumu — QR yeniden okutulmaz, oturum süresiz kalmaz

Bugün `QrCustomerApp.tsx` tek bir `view` state'i ile çalışıyor (`landing → menu → cart → success → status/bill`), her yeniden açılışta `landing` karşılıyor. Cart zaten `localStorage`'da `qrCode` anahtarıyla saklanıyor (`readCartFromStorage`/`writeCartToStorage`, `lib/qr-order/cart.ts`) — aynı deseni oturum durumuna da uyguluyoruz, ama v2'deki "sadece boolean" kaydı yeterli değildi (müşteri günler sonra aynı restorana gelse eski oturum varmış gibi görünebilirdi).

**`localStorage` kaydı — genişletilmiş şema:**

```ts
type TableSessionRecord = {
  hasOrdered: true;
  tableSessionId: string;   // her yeni "oturum" için yeni cuid — eski/yeni oturumu ayırt eder
  createdAt: string;        // ISO
  expiresAt: string;        // ISO — createdAt + 10 saat (8-12 saat aralığında, sabit config)
};
// key: `wexpay:table-session:{qrCode}`
```

**Kurallar:**

- İlk sipariş başarıyla gönderildiğinde yazılır: `expiresAt = now + 10h`.
- `QrCustomerApp` mount olduğunda: kayıt yoksa **veya** `expiresAt < now` **veya** bill endpoint'i `empty: true` dönüyorsa (masa hesabı tamamen kapanmış) → kayıt silinir, karşılama ekranı (`QrLanding`) gösterilir, yeni sipariş verilirse yeni `tableSessionId` ile yeni kayıt açılır.
- Kayıt geçerliyse → varsayılan görünüm doğrudan kalıcı sekme çubuğu (bkz. altta), karşılama ekranı atlanır.
- `tableSessionId`, backend'e gönderilmez — yalnızca client'ın "bu benim oturumum mu, yoksa aynı masada önceki müşteriden kalma mı" ayrımını yapması için var; gerçek yetki/güvenlik sınırı değil (yetki her istekte `resolvePublicTableByPublicKey` ile zaten tazeleniyor, bkz. §8).

**Alt sekme çubuğu (kalıcı, geçerli bir oturum kaydı olduğunda görünür):**

```text
[ Menü ]     [ Siparişlerim ]     [ Hesabım ]
```

"Hesabım" = bugünkü `QrBillScreen`, "Siparişlerim" = bugünkü `QrOrderStatusScreen`, "Menü" = bugünkü `QrMenuScreen`. Aralarında geçiş view state değişimi — sayfa yenileme veya QR okutma gerektirmez. QR yeniden okutmak yalnızca: kayıt süresi dolmuşsa, tarayıcı verisi temizlenmişse, farklı cihazdan devam ediliyorsa veya masa hesabı tamamen kapanmışsa gerekir.

### 2.2 Modal yok — tek dokunuşlu iki buton

Onay modalı yok. `QrBillScreen`'de (Hesabım sekmesi) doğrudan iki büyük, birbirinden görsel olarak ayrışan buton:

```text
[ 💳  POS'u Masama Getir ]
     Hesabınız ve masa numaranız personele iletilir.

[ 💵  Nakit Ödeyeceğim ]
     Personel hesabınızı almak için masanıza gelir.
```

Butona basınca **istek hemen sunucuya gitmez** — 4-5 saniyelik yerel bir bekleme penceresi açılır: `"Talebiniz hazırlanıyor · Geri al"`. Bu pencere boyunca hiçbir ağ isteği atılmaz (client-side `setTimeout`). "Geri al"a basılırsa zamanlayıcı iptal edilir. Süre dolunca gerçek `POST /payment-request` isteği atılır.

**Neden ayrı bir "cancel" API'si değil de client-side gecikme:** İstek gerçekten sunucuya gidip personel ekranında görünür, sonra hemen iptal edilirse personel tarafında gürültülü/güven kırıcı bir "geldi-gitti" bildirimi oluşur. Client-side gecikme bunu tamamen ortadan kaldırır.

### 2.3 Copy (müşteri tarafı vs. operatör tarafı)

| Buton | Alt açıklama |
|---|---|
| **POS'u Masama Getir** | Hesabınız ve masa numaranız personele iletilir. |
| **Nakit Ödeyeceğim** | Personel hesabınızı almak için masanıza gelir. |

Operatör panelinde ("Bekleyen Ödeme Talepleri" kuyruğu, audit log, admin ekranları) **"Ödeme talebi" terimi aynen kalır** — iç operasyon dili değişmiyor, sadece müşteri yüzeyi sadeleşiyor.

---

## 3. Durum Makinesi (tamamı faz 1 zorunlu)

| Durum | Müşteri ekranı | Kim/ne tetikler |
|---|---|---|
| `OPEN` | "Talebiniz restorana iletildi." | 4-5 sn'lik yerel gecikme sonunda `POST /payment-request` başarıyla döner |
| `ACKNOWLEDGED` | Kart için: "Talebiniz alındı. POS cihazı masanıza getiriliyor." · Nakit için: "Talebiniz alındı. Personel masanıza geliyor." | Personel operatör ekranında **"Üstlen"** butonuna basar |
| `RESOLVED` | "Ödeme tamamlandı. Teşekkür ederiz." | `Payment.status = PAID` **ve** o ödeme sonrası masanın `remainingAmount = 0` olması (bkz. §5.3) |
| `CANCELLED` | Nazik nudge: "Hâlâ bekliyor musunuz? Garson çağırabilirsiniz." | `expiresAt` geçtiğinde lazy-expire **veya** personel "bırak" der ve kimse yeniden üstlenmezse süre dolar (bkz. §4.2, §5.5) |

`ACKNOWLEDGED`'ın faz 1'de zorunlu olmasının nedeni: bu olmadan müşteriye "personel geliyor" gibi bir mesaj göstermek **yanlış güvence** verir. `OPEN` durumunda gösterilecek mesaj bu yüzden "iletildi" ile sınırlı, "geliyor" değil.

**Önemli netlik (v2'deki karışıklığı gidermek için):** Müşteri tarafında bu tablo iki farklı kanaldan besleniyor — sayfa ilk açıldığında/hydration'da `getActiveTableAssistRequest` (yalnız `OPEN`/`ACKNOWLEDGED`), talep gönderildikten sonraki canlı takipte ise `GET /assist-requests/[requestId]` (tüm durumlar, `RESOLVED`/`CANCELLED` dahil). Detay için §5.4 ve §6.2.

---

## 4. Veri Modeli

### 4.1 Enum'lar

```prisma
enum TableAssistKind { PAYMENT_REQUEST WAITER_CALL }
enum TableAssistStatus { OPEN ACKNOWLEDGED RESOLVED CANCELLED }
enum PaymentMethodPreference { CASH PHYSICAL_POS }
enum PaymentMethod { CASH PHYSICAL_POS INTEGRATED_TERMINAL ONLINE_PSP }
```

### 4.2 `TableAssistRequest` — model

```prisma
model TableAssistRequest {
  id                      String                    @id @default(cuid())
  organizationId          String
  branchId                String
  tableId                 String
  kind                    TableAssistKind
  paymentMethod           PaymentMethodPreference?
  mode                    String?                   // "full_bill" | "selected_items" | "split" | "other"
  reason                  String?
  note                    String?
  status                  TableAssistStatus         @default(OPEN)

  requestedAmount         Decimal?  @db.Decimal(10, 2)  // talep anındaki remainingAmount anlık görüntüsü
  businessNotificationId  String?                       // eski bildirim modeliyle gerçek FK bağı
  acknowledgedByUserId    String?                        // talebi üstlenen personel
  resolvedByUserId        String?                        // ödemeyi kapatan personel
  resolvedPaymentId       String?
  expiresAt               DateTime                       // açık son geçerlilik zamanı — bkz. aşağıdaki uzatma kuralı

  createdAt               DateTime  @default(now())
  acknowledgedAt          DateTime?
  resolvedAt              DateTime?
  cancelledAt             DateTime?
  releasedAt              DateTime?                       // YENİ — personel "bırak" dediğinde damgalanır (geçmiş amaçlı, status zaten OPEN'a döner)

  organization         Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  branch                Branch                @relation(fields: [branchId], references: [id], onDelete: Cascade)
  table                 RestaurantTable       @relation(fields: [tableId], references: [id])
  businessNotification  BusinessNotification? @relation(fields: [businessNotificationId], references: [id])
  acknowledgedBy        User?                 @relation("TableAssistAcknowledgedBy", fields: [acknowledgedByUserId], references: [id])
  resolvedBy             User?                 @relation("TableAssistResolvedBy", fields: [resolvedByUserId], references: [id])
  payment                Payment?              @relation(fields: [resolvedPaymentId], references: [id])

  // Aynı masada aynı anda birden fazla açık PAYMENT_REQUEST asla olamaz —
  // Postgres partial unique index (migration'da elle eklenir, Prisma @@unique
  // koşullu index'i doğrudan desteklemiyor):
  //   CREATE UNIQUE INDEX table_assist_request_open_payment_per_table
  //   ON "TableAssistRequest" ("tableId")
  //   WHERE "kind" = 'PAYMENT_REQUEST' AND "status" IN ('OPEN','ACKNOWLEDGED');

  @@index([tableId, status])
  @@index([branchId, status])
  @@index([organizationId, status])
}
```

**`expiresAt` kuralları:**

- Oluşturma anında: `createdAt + 10 dakika`.
- Personel "Üstlen" derse (`ACKNOWLEDGED`'a geçerken): `expiresAt = acknowledgedAt + 10 dakika` (uzatılır — talep 19. dakikada üstlenildiyse bir dakika sonra otomatik iptal olmasın).
- Personel "Bırak" derse (`ACKNOWLEDGED → OPEN`): `expiresAt = releasedAt + 10 dakika` (yeniden başlar, `acknowledgedByUserId`/`acknowledgedAt` `null`'lanır, `releasedAt` damgalanır).
- Okuma **ve** yazma (yeni talep oluşturma) anında kontrol edilir — bkz. §5.1 ve §5.4. Süresi geçmiş ama hâlâ `OPEN`/`ACKNOWLEDGED` görünen kayıtlar lazy olarak `CANCELLED`'a çevrilir (ayrı bir cron/worker gerekmez — mevcut kod tabanındaki `TableQrToken` "touch" deseniyle aynı felsefe).

### 4.3 `Payment` modeli (değişmedi)

```prisma
model Payment {
  ...
  method PaymentMethod?
  assistRequests TableAssistRequest[]
}
```

---

## 5. Servis Katmanı

### 5.1 Talep oluşturma — çift talep önleme + expiry-önce-kontrol sırası

**Kritik düzeltme:** v2'de expiry yalnız okuma anında kontrol ediliyordu; süresi geçmiş ama DB'de hâlâ `OPEN` görünen bir kayıt, unique index'i "hâlâ açık" sanıp yeni talebi bloke edebilirdi. Doğru sıra, aynı transaction içinde:

```ts
export async function createPublicTableAssistNotification(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  kind: "payment_request" | "waiter_call";
  reason?: string | null;
  note?: string | null;
  paymentMethod?: "CASH" | "PHYSICAL_POS" | null;
  ipAddress: string | null;
}): Promise<{
  id: string;
  title: string;
  requestId: string;
  alreadyOpen: boolean;
  existing?: { paymentMethod: "CASH" | "PHYSICAL_POS" | null; requestedAmount: number | null };
}>
```

Akış (tek transaction, masa id'sine göre advisory lock):

1. `SELECT pg_advisory_xact_lock(hashtext(tableId))` — aynı masaya eşzamanlı iki istek serileşir.
2. **Süresi geçmiş talepleri önce temizle**: `UPDATE TableAssistRequest SET status='CANCELLED', cancelledAt=now() WHERE tableId=? AND status IN ('OPEN','ACKNOWLEDGED') AND expiresAt < now()`.
3. `kind === "payment_request"` ise: adım 2'den **sonra** o masada `status IN (OPEN, ACKNOWLEDGED)` olan bir `TableAssistRequest(kind=PAYMENT_REQUEST)` var mı diye bakılır.
   - Varsa: **yeni kayıt açılmaz**, mevcut kaydın `id`'si, gerçek `paymentMethod`/`requestedAmount`'ıyla birlikte `alreadyOpen: true` olarak döndürülür (bkz. §6.1 — yöntem çakışması netliği).
   - Yoksa: `BusinessNotification` + `TableAssistRequest` (`requestedAmount` = o anki `remainingAmount`, `businessNotificationId` = oluşan bildirimin id'si, `expiresAt` = `now() + 10dk`) oluşturulur.
4. `waiter_call` için önceki davranış (cooldown'a güvenme) korunur — tekil-açık-talep invariantı yalnız ödeme taleplerinde iş kuralı gereği.

DB seviyesinde §4.2'deki kısmi unique index bu invariantı garanti eder; adım 2 (expiry temizliği) olmadan bu index'in kendisi yeni talebi hatalı biçimde bloke edebileceği için bu sıra zorunludur.

### 5.2 Personelin talebi üstlenmesi/bırakması

```ts
export async function acknowledgeTableAssistRequest(
  context: WexPayMutationContext,
  input: { requestId: string },
): Promise<
  | { acknowledged: true }
  | { acknowledged: false; conflict: { acknowledgedByDisplayName: string } }
>
```

- `assertCashierOperate(context, "acknowledge_assist_request")`.
- Atomik "ilk basan kazanır": `updateMany({ where: { id, status: "OPEN" }, data: { status: "ACKNOWLEDGED", acknowledgedByUserId, acknowledgedAt: now, expiresAt: now + 10dk } })`.
- `count === 0` dönerse (başka personel zaten üstlenmiş): mevcut kaydın `acknowledgedBy.displayName`'i güvenli şekilde okunup `{ acknowledged: false, conflict: { acknowledgedByDisplayName } }` döndürülür — UI bunu ya doğrudan gösterir ya da genel "Bu talep zaten [isim] tarafından üstlenildi." mesajına çevirir.

```ts
export async function releaseTableAssistRequest(
  context: WexPayMutationContext,
  input: { requestId: string },
): Promise<{ released: boolean }>
```

- Yalnızca kaydı **üstlenmiş olan personel** (`acknowledgedByUserId === context.actorUserId`) ya da yönetici yetkisi (`canManageWexPay`) bırakabilir.
- `updateMany({ where: { id, status: "ACKNOWLEDGED" }, data: { status: "OPEN", acknowledgedByUserId: null, acknowledgedAt: null, releasedAt: now, expiresAt: now + 10dk } })`.
- Bırakılan talep tekrar "yeni talep" kartında görünür (herhangi bir personel yeniden üstlenebilir).

### 5.3 Otomatik `RESOLVED` — kriter (değişmedi, v2'de düzeltilmişti)

```ts
// 1. Yalnızca gerçekten tahsil edilmiş ödemeler değerlendirilir.
if (payment.status !== "PAID") return; // PENDING/FAILED asla talebi kapatmaz

// 2. Bu ödeme sonrası masanın gerçek kalan tutarı hesaplanır (aynı tx içinde).
const remaining = await calculateTableRemainingInTx(tx, input.tableId);
if (remaining > 0) return; // parçalı ödeme — talep açık kalır

// 3. Yalnızca "full_bill" modundaki açık/üstlenilmiş talepler bu şekilde kapanır.
const openRequest = await tx.tableAssistRequest.findFirst({
  where: { tableId: input.tableId, kind: "PAYMENT_REQUEST", status: { in: ["OPEN", "ACKNOWLEDGED"] }, mode: "full_bill" },
});
if (!openRequest) return;

await tx.tableAssistRequest.update({
  where: { id: openRequest.id },
  data: { status: "RESOLVED", resolvedAt: new Date(), resolvedPaymentId: payment.id, resolvedByUserId: context.actorUserId ?? null },
});
```

**Merkezi yardımcı fonksiyon şart:** `maybeResolveTableAssistRequestOnPayment(tx, { tableId, payment, actorUserId })` — hem kasiyerin manuel `createPayment` çağrısında hem de PayTR webhook'unun `settlePaymentFromProviderWebhook` yolunda **aynı fonksiyon** çağrılır, iki yerde ayrı ayrı yazılmaz.

### 5.4 Okuma — iki ayrı, karışmayan fonksiyon

**(a) İlk açılış/hydration için — yalnız non-terminal:**

```ts
export async function getActiveTableAssistRequest(tableId: string): Promise<{
  id: string;
  kind: "PAYMENT_REQUEST" | "WAITER_CALL";
  status: "OPEN" | "ACKNOWLEDGED";   // yalnız bu iki değer — isim "active" ile tutarlı
  paymentMethod: "CASH" | "PHYSICAL_POS" | null;
  createdAt: string;
} | null>
```

`expiresAt < now()` ise okuma anında `CANCELLED`'a çevrilip `null` döndürülür. Bu fonksiyon **yalnızca** sayfa ilk yüklendiğinde ("bu masada zaten benim/başkasının açtığı bekleyen bir talep var mı") kullanılır — terminal durumları hiç döndürmez, dönmemesi de doğrudur çünkü amacı "şu an bekleyen bir şey var mı" sorusuna cevap vermek.

**(b) Canlı takip için — belirli bir `requestId`'nin tam yaşam döngüsü:**

```ts
export async function getAssistRequestById(requestId: string): Promise<{
  id: string;
  kind: "PAYMENT_REQUEST" | "WAITER_CALL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";  // terminal durumlar dahil
  paymentMethod: "CASH" | "PHYSICAL_POS" | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
} | null>
```

Bu fonksiyon terminal durumları da döndürür — müşterinin kendi oluşturduğu `requestId`'yi güvenle poll edebilmesinin temeli budur (bkz. §6.2). `getActiveTableAssistRequest` ile karıştırılmaması için isimler bilinçli olarak ayrıştırıldı (v2'deki `activeAssistRequest`'i `latestAssistRequest` yapmak yerine, iki farklı amaç için iki farklı fonksiyon/endpoint tercih edildi — daha az belirsiz).

---

## 6. API Sözleşmesi

### 6.1 `POST /api/wexpay/public/[qrCode]/payment-request`

**Request:** `paymentMethod` zorunlu (`"CASH" | "PHYSICAL_POS"`).

**Response:**

```jsonc
{
  "ok": true,
  "title": "string",
  "charged": false,
  "message": "Ödeme talebi işletmeye iletildi. Canlı tahsilat başlatılmadı.",
  "requestId": "string",
  "alreadyOpen": false,
  // alreadyOpen: true ise — yöntem çakışması netliği için mevcut talebin gerçek bilgisi:
  "existing": { "paymentMethod": "CASH", "requestedAmount": 860 }
}
```

Client, `alreadyOpen: true` + `existing.paymentMethod !== (kullanıcının bastığı buton)` durumunda net bir mesaj gösterir: *"Bu masa için zaten [nakit/kart] ödeme talebi bulunuyor."* Faz 1 kuralı: **ilk talep geçerlidir**, ikinci müşterinin seçimi sessizce yok sayılmaz, açıkça bildirilir.

### 6.2 Müşteri tarafı durum takibi — iki ayrı uç

**(a) `GET /api/wexpay/public/[qrCode]/bill`** — yalnız non-terminal keşif için:

```ts
export type QrBillSnapshot = {
  // ...mevcut alanlar...
  activeAssistRequest: {   // yalnız OPEN/ACKNOWLEDGED — RESOLVED/CANCELLED ASLA burada dönmez
    id: string;
    kind: "PAYMENT_REQUEST" | "WAITER_CALL";
    status: "OPEN" | "ACKNOWLEDGED";
    paymentMethod: "CASH" | "PHYSICAL_POS" | null;
    createdAt: string;
  } | null;
};
```

**(b) `GET /api/wexpay/public/[qrCode]/assist-requests/[requestId]`** — YENİ, terminal durumlar dahil canlı takip için:

```ts
// Response:
{
  id: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  paymentMethod: "CASH" | "PHYSICAL_POS" | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}
```

Bu uç, `requestId`'nin ilgili `qrCode`'un masasına ait olduğunu doğrular (`resolvePublicTableByPublicKey` + `tableId` eşleşmesi), aksi halde `404`. Guest-safe: yalnızca müşterinin zaten bildiği alanlar döner, hiçbir personel/iç veri sızmaz. **Client, `requestPayment()` başarılı döndükten sonra bu uçu poll eder — `bill` endpoint'inin `activeAssistRequest` alanını değil.** `bill` endpoint'i yalnızca sayfa ilk açıldığında "zaten bekleyen bir talep var mı" keşfi için kullanılır.

### 6.3 Operatör tarafı — uçlar (dosya yolu / HTTP path ayrımı netleştirildi)

| Amaç | Dosya yolu | HTTP path |
|---|---|---|
| Üstlen | `app/api/wexpay/(production)/assist-requests/[id]/acknowledge/route.ts` | `POST /api/wexpay/assist-requests/[id]/acknowledge` |
| Bırak | `app/api/wexpay/(production)/assist-requests/[id]/release/route.ts` | `POST /api/wexpay/assist-requests/[id]/release` |
| Operasyon özeti | `app/api/wexpay/operations/snapshot/route.ts` (mevcut) | `GET /api/wexpay/operations/snapshot` |

`(production)` bir Next.js **route group**'tur — dosya organizasyonu içindir, gerçek HTTP path'e hiçbir şekilde yansımaz. Bu iki sütun her zaman ayrı yazılmalı, tek bir "path" olarak karıştırılmamalı.

`operations/snapshot` genişlemesi — iki ayrı liste, tek liste değil:

```ts
type PendingAssistRequest = {
  id: string;
  tableLabel: string;
  kind: "PAYMENT_REQUEST" | "WAITER_CALL";
  paymentMethod: "CASH" | "PHYSICAL_POS" | null;
  requestedAmount: number | null;
  createdAt: string;
  ageSeconds: number;
};

type InProgressAssistRequest = {
  id: string;
  tableLabel: string;
  paymentMethod: "CASH" | "PHYSICAL_POS" | null;
  requestedAmount: number | null;
  acknowledgedBy: { id: string; displayName: string };
  acknowledgedAt: string;
};

// snapshot response'una eklenir:
{
  pendingAssistRequests: PendingAssistRequest[];   // status = OPEN
  inProgressAssistRequests: InProgressAssistRequest[]; // status = ACKNOWLEDGED
}
```

---

## 7. Operatör Tarafı (faz 1 zorunlu — opsiyonel değil)

### 7.1 Kart tasarımı ve davranış

```text
YENİ ÖDEME TALEBİ
Masa 7 · 860 TL · Kart — Fiziksel POS · 18 saniye önce
[ Üstlen ve POS'u götür ]
```

Üstlenilen talepler ayrı bir "İşlemde" listesine geçer, üstlenen personelin adı ve bir **"Bırak"** butonuyla görünür (§5.2). İki personel aynı anda "Üstlen" basarsa ikincisi `conflict.acknowledgedByDisplayName` bilgisiyle net bir mesaj görür.

### 7.2 Polling aralıkları (zorunlu, faz 1)

| Yüzey | Aralık | Not |
|---|---|---|
| Personel kuyruğu (`operations/snapshot`) | **2-3 sn** | Mevcut ~20 sn'lik genel operasyon polling'inden bağımsız, bu kuyruk için ayrı, daha sık bir interval |
| Müşteri durum takibi (`assist-requests/[id]`) | **4-6 sn** | `requestPayment()` başarılı olduktan sonra başlar, `RESOLVED`/`CANCELLED`'da durur |
| Sekme arka plandaysa (`document.hidden`) | Her ikisi de 15-20 sn'ye yavaşlatılır | Batarya/gereksiz istek tasarrufu, sekme öne gelince hemen bir kez tazelenir |

20 saniyelik gecikme bu özelliğin değerini doğrudan öldürür (müşteri 20 sn beklerse elini kaldırmayı tercih eder) — bu yüzden personel kuyrusu **ayrı ve daha sık** bir polling döngüsü olarak tasarlanmalı, mevcut genel operasyon polling'ine "eklenmemeli".

**Ses tekrarı önleme:** Client (operatör ekranı) `seenAssistRequestIds: Set<string>` tutar. Yeni bir `id` ilk görüldüğünde ses/güçlü görsel uyarı tetiklenir; aynı `id` sonraki polling turlarında tekrar görülse (durumu değişmemişse) ses tekrar çalmaz. Tarayıcı autoplay kısıtları nedeniyle ilk kullanıcı etkileşiminden sonra ses izni alınması gerekir — implementasyon detayı PR-B'de netleşir.

### 7.3 Genel bildirim listesiyle çakışma önleme

`BusinessNotification` genel gelen kutusu (mevcut operasyon ekranındaki eski liste), artık **kendi `TableAssistRequest`'i olan hiçbir bildirimi göstermez** — yani `payment_request`/`waiter_call` türündeki bildirimler tamamen yeni kuyruğa taşınır, genel listede hiç görünmez (sorgu: `WHERE NOT EXISTS (SELECT 1 FROM TableAssistRequest WHERE businessNotificationId = BusinessNotification.id)`). Bu, "isRead senkronizasyonu" gibi kısmi çözümler yerine tercih edildi — tek kaynak, her talep türü için tek görünüm; iki listenin birbirinden bağımsız ilerleyip senkronizasyondan çıkması riski tamamen ortadan kalkar.

Bu olmadan (yalnız müşteri tarafı geliştirilip personel tarafı eski bildirim listesinde kalırsa) sistem çalışır ama zayıf kalır — asıl "personel doğru donanımla, doğru bilgiyle, hızlıca geliyor" vaadi gerçekleşmez.

---

## 8. Güvenlik, Kötüye Kullanım Koruması ve Tenant İzolasyonu

### 8.1 Public endpoint sıkılaştırması

QR kodun fotoğrafını önceden çekmiş biri, masa fiziksel olarak boşken veya kapalıyken uzaktan sahte bir ödeme talebi gönderebilir. Rate limit/cooldown bunu azaltır ama tamamen çözmez. `payment-request` endpoint'i artık ek olarak şunları doğrular (mevcut `resolvePublicTableByPublicKey` sonrası, talep oluşturulmadan önce):

1. **Açık bakiye var mı**: `remainingAmount > 0` değilse `409` (`"Bu masa için ödenecek açık bir hesap bulunmuyor."`).
2. **Masa aktif mi**: `table.status` uygun değilse (kapalı/pasif) `409`.
3. **Yakın zamanlı gerçek sipariş var mı**: son N saat içinde (config edilebilir, öneri: 6 saat) o masaya ait en az bir `CustomerOrder` yoksa `409` — boş/hiç sipariş verilmemiş bir masadan ödeme talebi asla oluşturulamaz.

Daha güçlü, faz 2'ye bırakılabilecek seçenek: başarılı sipariş sonrasında masaya/misafir oturumuna bağlı imzalı bir cookie/token üretip ödeme talebinde bunu da doğrulamak (ekstra bir bypass katmanı). Faz 1 için yukarıdaki üç kontrol (açık bakiye + aktif masa + yakın sipariş) minimum ve zorunlu kabul edilir.

### 8.2 Fiziksel ödeme ile WexPay kaydı arasındaki ayrım

WexPay'de "Ödeme tamamlandı" (`RESOLVED`) denmesi, banka/POS/YN ÖKC işleminin cihazda gerçekten başarıyla tamamlanmasından **sonra** personelin bunu kaydetmesiyle gerçekleşir — WexPay kaydı hiçbir zaman mali fişin/POS slip'inin yerine geçmez. Restoran, mevcut fiziksel POS/YN ÖKC mali yükümlülüğünü aynen sürdürür; bu plan yalnızca operasyonel orkestrasyon katmanıdır, mali kayıt sistemini değiştirmez. Bu netlik operatör eğitim materyaline ve UI copy'sine de yansıtılmalı (PR-B/PR-C kapsamında).

### 8.3 Tenant izolasyonu (değişmedi)

`organizationId`/`branchId`/`tableId` scoped, guest'e iç veri sızmaz, `paymentMethod` guest input'u sıkı whitelist'e tabi. `acknowledgeTableAssistRequest`/`releaseTableAssistRequest` yalnızca ilgili yetkiye sahip ve doğru org'a ait aktörlerce çağrılabilir (`assertTableInOrg` deseniyle aynı). Kısmi unique index hem uygulama hem DB seviyesinde çift-talebi engeller.

---

## 9. Test Planı

### 9.1 Birim/DB testleri

- Çift talep önleme + **expiry-önce-kontrol sırası**: süresi geçmiş bir `OPEN` kayıt varken yeni talep isteği → eski kayıt önce `CANCELLED`'a döner, yeni kayıt başarıyla oluşur (v2'deki potansiyel kilitlenmenin regresyon testi).
- Otomatik `RESOLVED` kriteri: `PENDING` → açık kalır; `PAID` + parçalı → açık kalır; `PAID` + `remainingAmount=0` → `RESOLVED`; manuel yol ve webhook yolu aynı sonucu üretir.
- `acknowledgeTableAssistRequest`: eşzamanlı iki "Üstlen" → yalnız biri başarılı, diğeri `conflict.acknowledgedByDisplayName` ile anlamlı cevap alır.
- `releaseTableAssistRequest`: yalnızca üstlenen personel veya yönetici bırakabiliyor mu; bırakınca `expiresAt` yeniden 10 dk'ya uzatılıyor mu.
- `expiresAt` uzatma kuralı: `ACKNOWLEDGED`'a geçişte ve bırakmada `expiresAt`'in doğru hesaplandığı.
- §8.1'deki üç ön koşul (açık bakiye/aktif masa/yakın sipariş) — her biri için ayrı red senaryosu.

### 9.2 E2E (Playwright)

1. Misafir sipariş verir → sayfa yeniden açılır → karşılama ekranı değil, doğrudan sekmeli görünüm.
2. `localStorage` oturum kaydı süresi dolmuşsa (test'te zaman mock'lanır) → karşılama ekranına geri dönülüyor mu.
3. "POS'u Masama Getir" → 4-5 sn içinde "Geri al" → hiç ağ isteği atılmadığı doğrulanıyor.
4. Gerçek gönderim → operatör ekranında kart **2-3 sn içinde** görünüyor mu (polling gecikmesi testi) → "Üstlen" sonrası misafir ekranı `ACKNOWLEDGED`'a geçiyor mu.
5. Personel "Bırak" der → talep tekrar "yeni talep" kartında görünüyor mu, başka personel üstlenebiliyor mu.
6. Kasiyer tam tutarı `PAID` kaydeder → misafir ekranı **`assist-requests/[id]` uzun-polling'i üzerinden** `RESOLVED`'a geçiyor mu (bill endpoint'inin `activeAssistRequest`'i değil — bu regresyonun asıl testi).
7. Aynı masadan iki farklı yöntemle art arda talep → ikinci istek `alreadyOpen: true` + doğru `existing.paymentMethod` döner mi, UI net mesaj gösteriyor mu.
8. §8.1 kötüye kullanım kontrolleri: boş masadan/siparişsiz masadan talep → `409`.

### 9.3 Audit olayları

Aşağıdaki olayların **tamamı**, ilgili domain mutation ile **aynı transaction içinde** audit log'a yazılmalı:

```text
wexpay.assist.payment_request.created
wexpay.assist.payment_request.acknowledged
wexpay.assist.payment_request.released
wexpay.assist.payment_request.resolved
wexpay.assist.payment_request.cancelled
wexpay.assist.payment_request.expired
```

`waiter_call` için de aynı desende `wexpay.assist.waiter_call.*` olayları yazılır (created/cancelled/expired — üstlenme/çözümleme kavramı garson çağrısında yok).

---

## 10. Uygulama Sırası ve Ön Koşullar

**Repo durumu — bu belgeyi okuyan herkes kodlamaya başlamadan önce bizzat çalıştırmalı, belgeye güvenmemeli:**

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git fetch origin main --quiet && git rev-parse origin/main
git merge-base --is-ancestor HEAD origin/main && echo "HEAD origin/main ile senkron"
```

**Bu komutlarla en son doğrulanan durum** (aşağıdaki tarihte, bu doküman yazılırken): `HEAD` ve `origin/main` birebir aynı commit'te (`1eab341e...`), `git diff HEAD origin/main` boş, local ağaçta tek fark bu doküman dosyasının kendisi (untracked). Yani "main temiz" iddiası o an doğrulandı — **ama bu durum zamanla değişir**, bu yüzden yukarıdaki komutlar her PR-A'ya başlamadan hemen önce tekrar koşulmalı, bu paragrafa güvenilmemeli.

Ayrıca: açık PR'lar arasında **#59 (`fix/admin-followup-reconciliation`) hâlâ DRAFT** ve CI'da **"WexPay isolated E2E" kırmızı** (diğer kontroller yeşil). WexPay'in izole e2e test takımına dokunan bu yeni işe başlamadan önce PR #59'un durumu netleştirilmeli (düzeltilip merge edilsin ya da bu işten bağımsız olduğu teyit edilip ayrı tutulsun) — aksi halde yeni PR'ların CI sinyali mevcut kırmızıyla karışabilir.

### 10.1 PR sırası

**PR-A — Domain ve migration**
- `TableAssistRequest` (tüm alanlarıyla, §4.2), `Payment.method`, kısmi unique index
- Expiry-önce-kontrol sıralı çift-talep önleme (§5.1)
- `acknowledgeTableAssistRequest` + `releaseTableAssistRequest` (§5.2)
- Düzeltilmiş, paylaşılan otomatik-çözümleme fonksiyonu (§5.3)
- İki ayrı okuma fonksiyonu (§5.4)
- Audit olayları (§9.3)
- Birim + DB testleri (§9.1)

**PR-B — Personel deneyimi**
- Bekleyen + işlemde talep kuyrukları, önceliklendirme, sesli/görsel uyarı, ses tekrarı önleme (§7.1, §7.2)
- "Üstlen"/"Bırak" UI
- `operations/snapshot` genişlemesi (§6.3)
- Genel bildirim listesinden çakışan kayıtların filtrelenmesi (§7.3)

**PR-C — Müşteri deneyimi**
- Kalıcı masa oturumu (§2.1, süre-sınırlı) + alt sekme çubuğu
- Modalsız iki buton + geri-al penceresi (§2.2)
- Yeni copy (§2.3)
- İki ayrı poll akışı: `bill` (keşif) + `assist-requests/[id]` (canlı takip) (§6.2)
- Kötüye kullanım kontrolleri (§8.1) — bu PR'ın API tarafı PR-A'da da olabilir, ama UI entegrasyonu burada

PR-A → PR-B → PR-C sırasının nedeni değişmedi: PR-A olmadan üstündeki hiçbir şeyin dayanacağı bir durum modeli yok; PR-B, PR-C'den önce gelir çünkü personel tarafı olmadan müşteri tarafını canlıya almak yanlış güvence riski taşır.

---

## 11. Kapsam Dışı (Faz 2)

- **Hesabı böl UI'ı** ve `selected_items`/`split` modlarının otomatik-çözümlemeye entegrasyonu.
- **`INTEGRATED_TERMINAL` / YN ÖKC entegrasyonu** — enum'da yer ayrıldı, adapter/protokol tanımı yok.
- **"Masa kartı" / kendi bankacılık uygulamasından transfer** — sanal IBAN sağlayıcısı gerektirdiği için bilinçli olarak reddedildi/ertelendi.
- **Sesli uyarının tam implementasyonu** (autoplay kısıtları, ses dosyası, izin akışı) — PR-B'de netleşecek bir implementasyon detayı.
- **İmzalı misafir-oturum token'ı** (§8.1'deki "daha güçlü seçenek") — faz 1 için üç temel kontrol (açık bakiye/aktif masa/yakın sipariş) yeterli kabul edildi.

---

## 12. Rollout Flag

Bu bir ücretli/tier özelliği **değil** — `feature_*` entitlement sistemine (tier'a bağlı) hiçbir şekilde bağlanmaz. Sadece kontrollü yayınlama içindir, iki katmanlı:

1. **Global kill-switch** (env var, tüm tenant'lar için): `WEXPAY_PAYMENT_REQUEST_V2_ENABLED` (varsayılan `false`). `false` iken özellik hiçbir organizasyonda görünmez, bağımsız bir güvenlik ağı.
2. **Organizasyon bazlı allowlist** (yeni alan, `Organization` üzerinde): `paymentRequestV2Enabled Boolean @default(false)` — yalnız platform admin tarafından, ilgili organizasyon için tek tek açılır (plan/tier'dan bağımsız).

**Rollout akışı:**

```text
PR-A deploy   → global flag kapalı
PR-B deploy   → global flag kapalı
PR-C deploy   → global flag açık, ama hiçbir org allowlist'te değil (yine görünmez)
İç test org'u → org allowlist'e eklenir, uçtan uca doğrulanır
Pilot restoran → org allowlist'e eklenir
Sorunsuzsa    → tüm müşteriler için organizasyon bazlı kademeli açılış
```

Her iki koşul (`WEXPAY_PAYMENT_REQUEST_V2_ENABLED=true` **ve** `organization.paymentRequestV2Enabled=true`) sağlanmadıkça müşteri tarafı eski davranışta kalır (mevcut modal'lı/tek-adımlı `payment-request` akışı — bu plan devreye girene kadar geriye dönük olarak çalışmaya devam eder, herhangi bir müşteriye ani bir davranış değişikliği yaşatılmaz).
