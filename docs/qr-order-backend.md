# QR order backend

Public diner surface: `/wexpay/t/[qrCode]`  
APIs under `/api/wexpay/public/[qrCode]/*`

## Resolve + menu

`GET /api/wexpay/public/[qrCode]`

1. Resolve `qrCode` → table → branch → restaurant → organization  
2. Gate via Core WexPay product access  
3. Reject demo/inactive tenants (`403 access_closed`)  
4. Return active menu categories/products (price, image, popular)

Page SSR uses the same resolve helpers (`lib/wexpay-read.ts`).

## Order submit

`POST /api/wexpay/public/[qrCode]/order`

Body:

```json
{ "items": [{ "productId": "...", "quantity": 1 }], "note": "optional", "receiptRequested": false }
```

Rules:

- Rate limited (`publicQrOrder`)  
- Items re-loaded from DB; **client prices ignored / rejected**  
- Subtotal computed server-side  
- Unavailable / wrong-branch products rejected  
- Note max 500 chars; max 50 line items  
- Optional `Idempotency-Key` header (process-local replay)  
- Creates `CustomerOrder` + `ORDER_CREATED` business notification  
- Audited as `wexpay.order.created` / `source: public_qr`

Response `201`:

```json
{
  "orderId": "...",
  "id": "...",
  "orderNo": "...",
  "tableName": "Masa 1",
  "total": 120.5,
  "subtotal": 120.5,
  "status": "NEW"
}
```

## Bill

`GET /api/wexpay/public/[qrCode]/bill`

Returns session-scoped account (orders after `lastClosedAt`):

- lines, totals, paid, remaining, status, empty flag  
- `paymentAvailability.staffPaymentRequest`  
- `paymentAvailability.onlineCheckout` (flag only)  
- `paymentAvailability.liveChargeFromThisEndpoint: false`

## Payment request

`POST /api/wexpay/public/[qrCode]/payment-request`

- **Does not** start PayTR / live charge  
- Creates `[ÖDEME TALEBİ]` notification for ops  
- Response includes `charged: false`

Live online checkout (separate):

- `POST /api/wexpay/public/[qrCode]/checkout`  
- Requires `WEXPAY_PAYTR_ENABLE_API=true` + encrypted merchant credentials  
- Diner bill UI still shows online pay as “yakında” by product choice

## Waiter call

`POST /api/wexpay/public/[qrCode]/call-waiter`

- Reasons: `order_help` | `payment_help` | `table_clean` | `other`  
- Creates `[GARSON ÇAĞRISI]` notification  
- Rate limited (`publicQrAssist`)

## Admin / ops integration

No Core `/admin` QR redesign in this pass.

WexPay ops panel (`app/apps/wexpay`):

- Orders / kitchen boards show QR orders  
- Live events highlight:
  - QR sipariş  
  - Ödeme talebi  
  - Garson  

TODO (P3): dedicated assist cards / ack workflow (would benefit from typed notification enum + migration).

## Security notes

- QR token secrecy is the diner auth model  
- Server-side money authority  
- Invalid QR → safe 404  
- Closed tenant → 403  
- Rate limits on order / bill / assist / checkout
