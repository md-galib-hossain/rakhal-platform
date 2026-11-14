# 07 - Deploy the API from the monorepo (`apps/api`)

Status: **runbook written 2026-11-14, NOT executed.** Nothing on the VPS has been changed. The running `rakhal-api`
still comes from the old checkout `/srv/rakhal/api` (repo `rakhal-backend`). Every command below is run by a
human as the `deploy` user, or by an agent only after the owner authorizes that specific run in chat (production
or staging deploy, restart, and migration steps are approval-gated).

Context: the code moved into `apps/api` on 2026-11-14 (M6). There are no paying users yet and only staging exists,
so this cutover happens on the one environment, with a rollback that needs no database change.

## What changes and what does not

| Thing | Before | After |
|---|---|---|
| Source checkout on the VPS | `/srv/rakhal/api` (repo `rakhal-backend`) | `/srv/rakhal/platform` (repo `rakhal-platform`), API in `apps/api` |
| PM2 process | `rakhal-api`, `cwd: /srv/rakhal/api`, `script: dist/main.js` | **same name and script**, `cwd: /srv/rakhal/platform/apps/api` |
| Port, nginx, TLS, domain | unchanged | unchanged |
| Database | one Postgres | **unchanged**; same schema, same migrations folder (now `apps/api/prisma/migrations`) |
| `.env` | `/srv/rakhal/api/.env` | `/srv/rakhal/platform/apps/api/.env` (copied, never committed) |
| Who runs `prisma migrate deploy` | the old checkout | **only the monorepo checkout, from cutover on** (see rule 1) |
| pnpm | whatever the VM has | the repo's `packageManager`, **pnpm 11.9.0** (`pnpm -v` inside the repo must print it) |
| Node | whatever the VM has | 22 or newer (CI uses 22; the monorepo requires at least 20.9) |

## Rules (do not break these)

1. **One migration runner.** After the cutover, `prisma migrate deploy` runs only from `/srv/rakhal/platform/apps/api`.
   Never run it from the old checkout again. Before the cutover, `migrate status` from the new checkout must say
   "Database schema is up to date" (both trees carry the same 188 migrations).
2. **The old checkout stays untouched** until the retire step (M7): do not delete or `git pull` it. It is the rollback.
3. **The API process keeps its name** (`rakhal-api`) so nginx, monitoring and runbooks keep working.
4. Secrets are copied by hand: `.env` and, if the app uses it, `secrets/firebase_credentials.json`. Neither is in git.
   Never print `.env` values into a shared terminal or log.

## One-time cutover (run on staging, which today is the only environment)

Pre-check, on your machine: `main` is green in CI (`api.yml`), and `apps/api` on `main` equals what you intend to ship.

```bash
# 1. Checkout
cd /srv/rakhal
git clone <rakhal-platform remote> platform      # same auth method the old repos use (deploy key / token)
cd platform && git checkout main

# 2. Toolchain
node -v                                          # >= 22
pnpm -v                                          # must print 11.9.0 inside this directory (pnpm reads packageManager)

# 3. Install only what the API needs
pnpm install --frozen-lockfile --filter @rakhal/api...

# 4. Secrets (copy, do not cat)
cp /srv/rakhal/api/.env apps/api/.env
[ -d /srv/rakhal/api/secrets ] && cp -r /srv/rakhal/api/secrets apps/api/secrets
grep -cE '^[A-Z_]+=' apps/api/.env               # count only

# 5. Build and prove the schema matches, WITHOUT applying anything
cd apps/api
pnpm prisma:generate
pnpm exec prisma migrate status --config prisma.config.ts     # STOP if it reports pending or failed migrations
pnpm build                                       # STOP if this fails; the old process keeps serving
```

Switch PM2 (this is the only step that changes what is serving; it is the approval-gated one):

```bash
# 6. Edit the ecosystem file (doc 09): for the rakhal-api entry only
#      cwd: '/srv/rakhal/platform/apps/api',
#      script: 'dist/main.js',        // unchanged
pm2 startOrReload ecosystem.config.js --only rakhal-api --update-env
pm2 save
pm2 status                                       # no restart-count creep
pm2 logs rakhal-api --lines 100 --nostream
```

Verify (runbook 13, section C): `curl -s localhost:5000/api/v1/health`, `/api/v1/ready`, login, one authenticated read,
one authenticated write that appears in the activity log, a queue action drains, no new errors for ten minutes.

## Normal deploy after the cutover

Replaces runbook 13, section B "Backend":

```bash
cd /srv/rakhal/platform
git fetch --all && git checkout main && git pull --ff-only
pnpm install --frozen-lockfile --filter @rakhal/api...
cd apps/api
pnpm prisma:generate
pnpm exec prisma migrate deploy --config prisma.config.ts
pnpm build                                       # STOP here if this fails; old process keeps serving
pm2 reload rakhal-api
pm2 status && pm2 logs rakhal-api --lines 100 --nostream
```

`git pull` in the monorepo also brings web and admin changes; that is fine, they only build when you build them.

## Rollback

**Cutover rolled back (within minutes, no database change needed):**

1. In the ecosystem file set `cwd` back to `/srv/rakhal/api`.
2. `pm2 startOrReload ecosystem.config.js --only rakhal-api --update-env && pm2 save`.
3. Verify (section C). The old checkout was never modified, so it runs exactly as before.
4. Only caveat: if the monorepo deploy already ran `migrate deploy` with a **new** migration, the old code must tolerate
   the new columns. Migrations are additive-only, which guarantees that. If a migration was destructive, use the
   runbook's "release that included a migration" path (roll forward, or restore the pre-migration dump).

**Code-only rollback after cutover:** runbook 13 section E, with the directory changed to `/srv/rakhal/platform/apps/api`
(`git checkout <good-sha>` at the repo root, install, `prisma:generate`, `build`, `pm2 reload rakhal-api`).

## Docs that need the same change (when the cutover is actually done)

The workspace infra docs under `D:\Projects\Rakhal\docs\infrastructure\` still describe `/srv/rakhal/api`:
`03` (clone and layout), `05` (backend deployment), `09` (PM2 `cwd`), `12` (env var source path), `13` (this runbook,
section B and E), `14` (release folders), `24` (agent commands). Update them in one pass after step 6 succeeds, so the
docs never describe a server that does not exist yet. A banner pointing here has been added to `13` and `05`.

## Later (optional, not part of this cutover)

- The release-folder pattern (`/srv/rakhal/<unit>/releases/<sha>/` + `current` symlink, infra doc 14) for instant rollback.
  It works the same for `apps/api` and is the better end state; do it as its own change.
- Build once in CI, ship the artifact, so staging and production run identical output.
