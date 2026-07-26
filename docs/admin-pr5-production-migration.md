# PR5 production migration sequence

Admin mutation / finance hardening (`AdminMutationRateLimit`, `AdminMutationIdempotency`) is **additive**. Do **not** run this sequence until an explicit production approval is recorded. Remote / production migration is **not** part of PR merge automation for Draft PR #53.

## Preconditions

- Reviewed PR5 revision SHA is known and CI-green.
- Production DB backup completed and verified restorable.
- Production connectivity / preflight checks pass.
- Explicit written approval to migrate production.

## Ordered steps

1. Production DB backup
2. Production DB connectivity/preflight
3. Explicit approval
4. Run `prisma migrate deploy` from the reviewed PR5 revision
5. Verify `_prisma_migrations` entry for the PR5 migration(s)
6. Verify `AdminMutationRateLimit` table/indexes
7. Verify `AdminMutationIdempotency` table/indexes/enum
8. Only then mark PR ready and merge
9. Verify Vercel deployment SHA matches the merged revision
10. Authenticated read-only smoke
11. Controlled admin mutation smoke only with separate explicit approval

## Deploy ordering note

If merging to `main` triggers an automatic Vercel production deploy, apply the production migration **before** merge, or temporarily hold the deployment until migration verification (steps 5–7) completes. Never let a new app revision that requires the tables reach production traffic before the migration is confirmed.

## Rollback policy

- Migration is additive: on application rollback, **do not drop** the new tables.
- Older app revisions can run without writing to the new tables.
- Do **not** execute data-loss rollback SQL.
- Prefer forward-fix if a defect is found after migrate.

## Current status (PR #53)

Production / remote Supabase migration has **not** been applied. It remains blocked pending separate explicit approval.
