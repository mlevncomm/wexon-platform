# Wexon Domain Routing

Production host map and expected behavior for the WexPay Pilot Launch.

## Host → Surface

| Host | Surface | Internal prefix | Notes |
|------|---------|-----------------|-------|
| `www.wexon.dev` | Public marketing | `/` | Canonical public origin (SEO, sitemap) |
| `wexon.dev` | Public marketing | `/` | 302 → `www.wexon.dev` (same path/query) |
| `core.wexon.dev` | Customer portal (Wexon Core) | `/dashboard` | Also `portal.wexon.dev`, `customer.wexon.dev` |
| `app.wexon.dev` | WexPay operator app | `/apps/wexpay` | QR callbacks use `NEXT_PUBLIC_APP_URL` |
| `admin.wexon.dev` | Internal admin | `/admin` | **Cloudflare Access required** in production |

Implementation: `proxy.ts`, `lib/wexon-canonical-host.ts`, `lib/wexon/urls.ts`.

## Cross-host rules

- Panel paths on the public host (`/admin`, `/dashboard`, `/apps/wexpay`) redirect to the matching subdomain.
- Marketing paths on panel hosts redirect to `www.wexon.dev`.
- Unified login lives at `www.wexon.dev/login` with a `next` query for post-login routing.
- Public marketing pages must not link directly to `/admin` (use `/login?next=…` or demo/apply CTAs).

## Maintenance mode (`MAINTENANCE_MODE=true`)

- **GET** requests on the public surface redirect to `/on-basvuru` (pre-application only).
- Exempt: admin surface, `/admin/*`, `/login`, `/api/*`, `/on-basvuru`.
- When `MAINTENANCE_MODE=false`, the full public site, legal pages, and demo flows are available.

## WexPay public QR

- Checkout resolves per-tenant via `/wexpay/t/[qrCode]` and `/api/wexpay/public/[qrCode]/*`.
- No global fallback tenant; demo slugs are not used on public QR routes.
- First production payment path: **manual** (`provider=manual`). PayTR requires `WEXPAY_PAYTR_ENABLE_API=true` plus verified tenant credentials.

## Payment vs BillingPayment

| Concept | Layer | Purpose |
|---------|-------|---------|
| **WexPay Payment** | Product (`Payment` table) | Restaurant operational checkout (manual, PayTR, …) |
| **BillingPayment** | Wexon Core | SaaS subscription / invoice payment for Wexon licenses |

Product apps must not use BillingPayment status as product access; Core `requireProductAccess` is the decision source.

## Recommended production env

```env
NEXT_PUBLIC_APP_URL=https://app.wexon.dev
NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN=https://www.wexon.dev
MAINTENANCE_MODE=false
WEXPAY_PAYTR_ENABLE_API=false
```

## Admin security (production)

1. `admin.wexon.dev` behind **Cloudflare Access** (allowlist real admin emails).
2. App-level `ADMIN_LOGIN_PASSWORD` + `ADMIN_EMAILS` remains MVP; rotate to per-admin credentials + MFA before broad use.
3. In-memory rate limiting is not sufficient for multi-instance production — use Cloudflare WAF/Access.

## Legal pages

Canonical + Turkish aliases:

- `/legal/privacy` ↔ `/gizlilik-politikasi`
- `/legal/terms` ↔ `/kullanim-sartlari`
- `/legal/cookies` ↔ `/cerez-politikasi`
- `/kvkk`

Current legal copy is **draft**; replace with counsel-approved text before relying on it in production.
