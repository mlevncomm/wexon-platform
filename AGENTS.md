<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single Next.js 16 app (App Router, Turbopack) serving all surfaces (public site, `/dashboard`, `/admin`, `/apps/wexpay`) backed by one PostgreSQL DB via Prisma. Standard commands live in `README.md` and `package.json` scripts; only the non-obvious startup caveats are noted here.

- **PostgreSQL is required and must be started manually each session** (the update script only refreshes deps, never starts services). Local Postgres 16 is installed at cluster `16/main`. Start it with `sudo pg_ctlcluster 16 main start`. The `wexon` database and `postgres`/`postgres` login already exist on the snapshot; if a fresh cluster ever lacks them, recreate via `sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"` and `sudo -u postgres psql -c "CREATE DATABASE wexon;"`.
- **Env lives in `.env.local`** (gitignored) pointing `DATABASE_URL`/`DIRECT_URL` at `postgresql://postgres:postgres@127.0.0.1:5432/wexon`, plus admin/customer/API secrets. Recreate it if missing; `prisma.config.ts`, seeds, and `production:check` read `.env` then `.env.local` (host `process.env` wins).
- **After a fresh DB**, run `npm run prisma:generate`, `npm run prisma:migrate:deploy` (or `prisma:migrate:dev`), then `npm run prisma:seed` (products/plans). `npm run prisma:seed` does NOT create login users; the customer fixture (`real@wexon.dev`) comes from `npm run prisma:seed:real`.
- **Admin login** uses the `ADMIN_EMAILS` allowlist + `ADMIN_LOGIN_PASSWORD` (not a DB user). With the provided `.env.local`, log in at `/admin/login` with `admin@wexon.dev` / `Wexon-Admin-2026`.
- **Run dev with `npm run dev`** (http://localhost:3000). All subdomain surfaces are served on one origin locally; `proxy.ts` host-based routing only applies in production.
- **No Docker in this environment.** `npm run e2e:db:*` (isolated mutation E2E on port 5433) falls back to `embedded-postgres`; regular dev/lint/unit tests do not need it.
- `npm run lint` currently emits one pre-existing warning in `scripts/db-ping.mjs` (unused import) — not an error.
