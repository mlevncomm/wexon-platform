# Production monitoring checklist (first 24h)

Use this after the production sign-off **READY** decision. Check at **T+1h**, **T+6h**, **T+12h**, and **T+24h**. Do not paste secrets, tokens, cookies, or PII into this document or tickets.

**Baseline release**

- SHA: `ae8f2ca9bb367395665284fe5a7242c4a692882f`
- Deployment: `dpl_Htwgs52XCR43yuFavjZoKagY7iQ5`
- Sign-off: [production-signoff.md](./production-signoff.md)
- Monitoring owner: Cursor agent (automated probe + Vercel/Access checks)

## How to check

| Area | Where |
|------|--------|
| Deployments / build errors | Vercel → Project → Deployments |
| Runtime logs / function errors | Vercel → Project → Logs (Runtime) |
| Edge / Access | Cloudflare Zero Trust → Access → Logs / Access applications |
| DNS / proxy health | Cloudflare → DNS / Analytics (admin host only) |
| Automated probe | `node scripts/production-monitoring-probe.mjs` (local, non-destructive) |

Escalate if any item is **FAIL** or unexplained spike vs prior quiet period.

---

## Checklist

### 1. Vercel deployment errors

- [x] Latest Production deployment still **Ready** (`dpl_Htwgs52XCR43yuFavjZoKagY7iQ5`, SHA `ae8f2ca9`)
- [x] No failed Production redeploys in the window
- [x] No unexpected Preview→Production promotions (preview for docs PR #5 only)
- [x] Build/output errors absent on current SHA

**Owner notes:** T+1h — Production alias still on sign-off deployment.

### 2. Runtime logs

- [x] No sustained 5xx burst in Runtime logs
- [x] No repeated unhandled exceptions / stack traces
- [x] No spike in cold-start timeouts for auth or dashboard routes
- [x] Filter noise vs real errors (known bots excluded where possible)

**Owner notes:** T+1h — `get_runtime_errors` (6h) empty; error/fatal statusCode group empty.

### 3. Auth / login errors

- [x] `www.wexon.dev/login` reachable
- [x] No elevated failed-login rate vs baseline
- [x] Unauth `core` / `app` still redirect to unified login
- [x] No redirect loops on login `next` params

**Owner notes:** T+1h — curl confirms `core`/`app` → `www.wexon.dev/login?next=…`.

### 4. Admin login failures

- [x] `admin.wexon.dev` still challenges Cloudflare Access first
- [x] After Access, Wexon admin login form still loads (origin form verified)
- [x] No unusual admin auth failure volume
- [ ] Admin session to `/applications` still works for allowlisted admins (full Access OTP hop not re-run every checkpoint; origin form PASS)

**Owner notes:** T+1h — Access 302 + `Www-Authenticate: Cloudflare-Access`; leftover Signoff service tokens = 0.

### 5. Demo request submissions

- [x] `/demo-request` returns 200
- [ ] Successful submissions still persist / notify as designed (no live submit in monitoring; non-destructive)
- [x] No spike in validation or server errors on submit (no runtime error cluster)
- [x] No empty/spam flood without rate limiting engaging (no error/rate spike in logs)

**Owner notes:** T+1h — GET health only; no test POST.

### 6. 404 / 500 route errors

- [x] Marketing and product routes remain 200 (`/`, `/links`, `/products/wexpay`, `/demo-request`)
- [x] Unknown paths return expected 404 (not 500)
- [x] No new high-volume 404 scanning causing log noise only (note separately)
- [x] No 500s on `/dashboard`, `/apps/wexpay`, `/admin/*` for authenticated flows

**Owner notes:** T+1h — probe unknown path → 404; session routes PASS after login.

### 7. Cloudflare Access denied / allowed logs

- [x] Access app still scoped to `admin.wexon.dev` only (challenge host confirmed)
- [ ] Allowed events match known admin identities (dashboard log skim; no identity dump here)
- [ ] Denied / failed challenges look like expected probes or wrong identity
- [x] No leftover temporary Service Auth / sign-off policies
- [x] No unexpected Access config drift (challenge still present after cleanup)

**Owner notes:** T+1h — Access challenge PASS; sign-off service token leftovers none.

### 8. Rate-limit spikes

- [x] Login / demo / API rate limits not constantly tripped for real users
- [x] Confirm `WEXON_E2E_RELAX_RATE_LIMIT` still unset in Production
- [x] Investigate IP clusters if limit counters spike (none observed)
- [x] Distinguish intentional abuse blocking vs false positives (n/a)

**Owner notes:** T+1h — `CUSTOMER_DEV_LOGIN_PASSWORD` also unset; `WEXPAY_PAYTR_ENABLE_API` / `MAINTENANCE_MODE` present.

### 9. WexPay page errors

- [x] `www.wexon.dev/products/wexpay` and `/demo-request` healthy
- [x] `app.wexon.dev/apps/wexpay` loads for authenticated customers
- [x] No PayTR / payment API calls enabled unexpectedly (`WEXPAY_PAYTR_ENABLE_API` still set in Production)
- [x] No client-side error storms on WexPay surfaces

**Owner notes:** T+1h — authenticated app session PASS.

### 10. Customer dashboard session drops

- [x] Cookie domain remains `.wexon.dev` (Secure, HttpOnly, SameSite=Lax)
- [x] Session survives navigation between `www` → `core` → `app`
- [x] No mass forced re-logins
- [x] Logout still clears sessions across subdomains
- [x] Spot-check: login → open core dashboard → open app → logout → both require login again

**Owner notes:** T+1h — full probe PASS.

---

## Sign-off log (24h)

| Checkpoint | Time (UTC+3) | Reviewer | Overall | Notes |
|------------|--------------|----------|---------|-------|
| T+1h | 2026-07-12 16:40 | Cursor agent | PASS | Deploy Ready; no runtime errors; Access challenge; customer/core/app/logout PASS |
| Closeout | 2026-07-12 16:46 | Cursor agent | PASS | Final probe PASS; runtime errors empty (2h); loop stopped by closeout request |
| T+6h | — | — | SKIPPED | Closeout requested before window |
| T+12h | — | — | SKIPPED | Closeout requested before window |
| T+24h | — | — | SKIPPED | Closeout requested before window |

**24h monitoring decision:** STABLE (early closeout; T+1h + final probe PASS, no runtime errors)

## Automation

Scheduled T+6 / T+12 / T+24 loop was stopped on closeout. Re-arm only if a new production incident requires extended watch.
