# WexPay pilot go-live (isolated prova → 6 müşteri)

Bu runbook, production readiness planındaki **gün 13** paketine karşılık gelir.  
**Production DB’de mutation E2E çalıştırılmaz.**

## Önkoşullar (kod + ops)

| Kontrol | Beklenen |
|---------|----------|
| Guest modifier UI | Sepet `modifierOptionIds` gönderir; zorunlu grupta sheet |
| Kitchen/cashier poll | ≤10s `router.refresh` / ops snapshot |
| Core checkout CTA | Essential/Growth → `/checkout`; Scale/Suite meeting |
| PENDING reserve | PENDING remaining’i düşürür; close PENDING iken bloklu |
| Guest PayTR UX | Flag off iken “ödeme restoranda”; on iken redirect (iframe yok) |
| Modifier panel + bulk tables | `/apps/wexpay/menu`, `/apps/wexpay/tables` |
| Billing messaging | PAST_DUE / cancelAt / yenileme yaklaşıyor (recurring yok) |
| Vercel Core PayTR | `PAYTR_SUBSCRIPTION_ENABLE_API` + `PAYTR_IFRAME_ENABLE_API` + merchant + callback `https://www.wexon.dev/api/billing/paytr/callback` — **önce TEST_MODE** |
| `WEXPAY_PAYTR_ENABLE_API` | P0-5 yeşil olmadan **production’da false** |

## Isolated full-path prova (sırayla)

Isolated DB + staging (veya local) üzerinde:

1. Signup → org + OWNER
2. PayTR **test-mode** subscription charge **veya** admin manuel lisans
3. `/apps/wexpay` açılır
4. Restoran → şube → toplu masa → menü + modifier grubu + ürün linki
5. Public QR → zorunlu modifier ile sipariş
6. Mutfak tablet: sipariş ≤10s içinde görünür (reload’suz)
7. Misafir hesap → ödeme talebi; kasiyer manuel tahsilat
8. (Opsiyonel, flag on + TEST tenant PayTR) guest online checkout redirect + webhook → PAID
9. Dashboard billing: dönem/iptal mesajları doğru

Komut örnekleri (isolated env):

```bash
npm run test:unit
npm run test:unit:db
# Playwright — yalnızca isolated DATABASE_URL ile
npx playwright test e2e/wexpay-modifiers.spec.ts e2e/wexpay-guest-mutation.spec.ts e2e/public-checkout.spec.ts e2e/billing-paytr.spec.ts
```

## Staged open (6 müşteri)

1. Recurring **kapalı** kalsın.
2. QR online pay flag’i yalnızca prova 8 yeşilse aç; aksi halde vaat: **ödeme restoranda + kasiyer**.
3. 1–2 pilot org (manuel lisans veya test PayTR) → ops tablet smoke.
4. Sonra kademeli 6 müşteri; her org için: lisans → menü/masa → QR smoke → gün-sonu rapor.
5. Rate-limit / WAF notu: `docs/wexpay-deployment-readiness.md`.

## Rollback

- Core self-checkout: subscription/iframe flag’leri `false`
- QR online: `WEXPAY_PAYTR_ENABLE_API=false` (UI otomatik “ödeme restoranda”ya düşer)
- Lisans: admin status → CANCELLED / period end politikası
