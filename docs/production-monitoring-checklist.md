# Production monitoring checklist (first 24h)

Use this after the production sign-off **READY** decision. Check at **T+1h**, **T+6h**, **T+12h**, and **T+24h**. Do not paste secrets, tokens, cookies, or PII into this document or tickets.

**Baseline release**

- SHA: `ae8f2ca9bb367395665284fe5a7242c4a692882f`
- Deployment: `dpl_Htwgs52XCR43yuFavjZoKagY7iQ5`
- Sign-off: [production-signoff.md](./production-signoff.md)

## How to check

| Area | Where |
|------|--------|
| Deployments / build errors | Vercel → Project → Deployments |
| Runtime logs / function errors | Vercel → Project → Logs (Runtime) |
| Edge / Access | Cloudflare Zero Trust → Access → Logs / Access applications |
| DNS / proxy health | Cloudflare → DNS / Analytics (admin host only) |

Escalate if any item is **FAIL** or unexplained spike vs prior quiet period.

---

## Checklist

### 1. Vercel deployment errors

- [ ] Latest Production deployment still **Ready**
- [ ] No failed Production redeploys in the window
- [ ] No unexpected Preview→Production promotions
- [ ] Build/output errors absent on current SHA

**Owner notes:** ________________________________

### 2. Runtime logs

- [ ] No sustained 5xx burst in Runtime logs
- [ ] No repeated unhandled exceptions / stack traces
- [ ] No spike in cold-start timeouts for auth or dashboard routes
- [ ] Filter noise vs real errors (known bots excluded where possible)

**Owner notes:** ________________________________

### 3. Auth / login errors

- [ ] `www.wexon.dev/login` reachable
- [ ] No elevated failed-login rate vs baseline
- [ ] Unauth `core` / `app` still redirect to unified login
- [ ] No redirect loops on login `next` params

**Owner notes:** ________________________________

### 4. Admin login failures

- [ ] `admin.wexon.dev` still challenges Cloudflare Access first
- [ ] After Access, Wexon admin login form still loads
- [ ] No unusual admin auth failure volume
- [ ] Admin session to `/applications` still works for allowlisted admins

**Owner notes:** ________________________________

### 5. Demo request submissions

- [ ] `/demo-request` returns 200
- [ ] Successful submissions still persist / notify as designed
- [ ] No spike in validation or server errors on submit
- [ ] No empty/spam flood without rate limiting engaging

**Owner notes:** ________________________________

### 6. 404 / 500 route errors

- [ ] Marketing and product routes remain 200 (`/`, `/links`, `/products/wexpay`, `/demo/wexpay`)
- [ ] Unknown paths return expected 404 (not 500)
- [ ] No new high-volume 404 scanning causing log noise only (note separately)
- [ ] No 500s on `/dashboard`, `/apps/wexpay`, `/admin/*` for authenticated flows

**Owner notes:** ________________________________

### 7. Cloudflare Access denied / allowed logs

- [ ] Access app still scoped to `admin.wexon.dev` only
- [ ] Allowed events match known admin identities
- [ ] Denied / failed challenges look like expected probes or wrong identity
- [ ] No leftover temporary Service Auth / sign-off policies
- [ ] No unexpected Access config drift

**Owner notes:** ________________________________

### 8. Rate-limit spikes

- [ ] Login / demo / API rate limits not constantly tripped for real users
- [ ] Confirm `WEXON_E2E_RELAX_RATE_LIMIT` still unset in Production
- [ ] Investigate IP clusters if limit counters spike
- [ ] Distinguish intentional abuse blocking vs false positives

**Owner notes:** ________________________________

### 9. WexPay page errors

- [ ] `www.wexon.dev/products/wexpay` and `/demo/wexpay` healthy
- [ ] `app.wexon.dev/apps/wexpay` loads for authenticated customers
- [ ] No PayTR / payment API calls enabled unexpectedly (`WEXPAY_PAYTR_ENABLE_API` stays off unless intentionally changed)
- [ ] No client-side error storms on WexPay surfaces

**Owner notes:** ________________________________

### 10. Customer dashboard session drops

- [ ] Cookie domain remains `.wexon.dev` (Secure, HttpOnly, SameSite=Lax)
- [ ] Session survives navigation between `www` → `core` → `app`
- [ ] No mass forced re-logins
- [ ] Logout still clears sessions across subdomains
- [ ] Spot-check: login → open core dashboard → open app → logout → both require login again

**Owner notes:** ________________________________

---

## Sign-off log (24h)

| Checkpoint | Time (UTC+3) | Reviewer | Overall | Notes |
|------------|--------------|----------|---------|-------|
| T+1h | | | PASS / WARN / FAIL | |
| T+6h | | | PASS / WARN / FAIL | |
| T+12h | | | PASS / WARN / FAIL | |
| T+24h | | | PASS / WARN / FAIL | |

**24h monitoring decision:** ________________ (STABLE / WATCH / ROLLBACK REVIEW)
