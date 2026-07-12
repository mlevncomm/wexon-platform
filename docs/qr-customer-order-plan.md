# QR customer order experience

## Visual direction (premium redesign)

Primary: **Wexon Glass Light** — soft mint gradient canvas, restrained frosted cards, solid emerald CTAs.
Secondary warmth: Soft Restaurant App pastel mint/lime accents and welcoming landing tone.
No Yemeksepeti/Getir colors; no heavy blur; no admin-dashboard look.


Restoran müşterisi masadaki QR’ı okuttuğunda mobil-first bir ekranda önce **sipariş** veya **ödeme** niyetini seçer; sipariş akışı gerçek public order API’ye bağlanır; ödeme ekranı hesap görüntüleme + ödeme talebi / garson çağırma sunar (bu PR’da PayTR charge yok).

## 2. Benchmark özeti

Delivery app pattern’leri: sticky kategori chip’leri, popüler sıra, hızlı `+`, ürün sheet (adet/not/ekstra), sticky sepet bar, özet + gönderim, durum timeline.

Restoran içi farklar: adres/login yok; masa bağlamı her ekranda; masaya servis; ilk karar sipariş vs ödeme; garson çağır kritik.

Kopyalanmayanlar: Yemeksepeti/Getir renk/layout. Wexon dili: Urbanist, slate + emerald, büyük thumb-zone CTA.

## 3. Route kararı

**Korunan route:** `/wexpay/t/[qrCode]`

Masa QR kodları ve operatör deep-link’leri (`/wexpay/t/{qrCode}`) kırılmaz. Yeni `/qr/...` route açılmadı.

## 4. UX akışı

```
landing → menu → (product sheet) → cart → success
landing → bill → payment-request / waiter
* → waiter call sheet
```

View state: `landing | menu | cart | success | bill`

## 5. Data modeli

- Menü: `MenuCategory` + `MenuProduct` (`imageUrl`, `isPopular` public select’te)
- Sepet (client): `QrCartLine` + localStorage `wexon:qr-cart:<qrCode>`
- Sipariş: mevcut `CustomerOrder` / `OrderItem`
- Varyant/ekstra: **UI mock** → `buildOrderNote` ile sipariş notuna yazılır (Prisma schema değişmedi)
- Hesap: session-scoped `calculateTableAccount` + order items

## 6. API planı

| Method | Path | Durum |
|--------|------|--------|
| GET | `/api/wexpay/public/[qrCode]` | mevcut (+ imageUrl/isPopular) |
| POST | `/api/wexpay/public/[qrCode]/order` | mevcut — sipariş gönderimi |
| GET | `/api/wexpay/public/[qrCode]/bill` | **yeni** |
| POST | `/api/wexpay/public/[qrCode]/payment-request` | **yeni** — `TABLE_UPDATED` + `[ÖDEME TALEBİ]` |
| POST | `/api/wexpay/public/[qrCode]/call-waiter` | **yeni** — `TABLE_UPDATED` + `[GARSON ÇAĞRISI]` |
| POST | checkout / PayTR | bu PR’da **başlatılmıyor** |

Migration yok; özel notification enum’ları eklenmedi.

## 7. Admin / restaurant panel TODO

- Siparişler mevcut `ORDER_CREATED` notification ile ops’a düşmeye devam eder.
- Garson / ödeme talebi `TABLE_UPDATED` olarak yazılır; panelde **özel kart / filtre UI** henüz yok.
- TODO: ops bildirim listesinde `[GARSON ÇAĞRISI]` / `[ÖDEME TALEBİ]` vurgusu.
- TODO: canlı sipariş status timeline (müşteri tarafı şu an bilgilendirme mock).
- TODO: split payment backend.
- TODO: ürün varyant/ekstra schema + fiyatlandırma.

## 8. Edge case’ler

- Geçersiz QR / masa yok
- Access closed (restoran kapalı)
- Boş menü
- Boş kategori / stokta olmayan ürünler (public menu zaten filtreler)
- Boş sepet
- Zorunlu seçenek seçilmedi
- Sipariş / bağlantı hatası
- Double-submit guard (`submitLock` + pending)
- Online ödeme kapalı mesajı (bill ekranı)
- Masa hesabı boş

## 9. Test kapsamı

- Unit: `lib/qr-order/pricing.test.ts` (pricing, note, cart key isolation)
- E2E: `e2e/qr-customer-order.spec.ts` (mobile viewport)

## 10. Bilinçli kapsam dışı

- Yeni Prisma option modelleri
- PayTR charge / checkout başlatma
- Split payment
- Admin panel redesign
- `/demo/*` sandbox
- Destructive seed / production data değişiklikleri
