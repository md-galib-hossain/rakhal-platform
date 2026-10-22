# 04 - CI, deploy and cutover

## Today

- **Frontend repo:** GitHub Actions CI (lint, typecheck, test, build, Lighthouse). Deploys by hand per the
  runbook (`git pull --ff-only`, `pnpm build`, `pm2 reload rakhal-web`).
- **Backend repo:** no CI workflow. Deploys by hand (`migrate deploy`, `pnpm build`, `pm2 reload rakhal-api`).
- **Monorepo:** `.github/workflows/ci.yml` runs `turbo run lint typecheck test` then `build`.
- Production is a single VPS behind nginx; PM2 runs `rakhal-web` and `rakhal-api`. The admin app is **not yet
  deployed anywhere** (`apps/admin`, port 3010, intended host `admin.rakhal.com`).

## CI in the monorepo

Goals: a PR only pays for what it can break, and a shared-package change tests every consumer.

1. `turbo run <task> --filter=...[origin/main]` so affected apps and their dependents run.
2. A change under `packages/ui/**` therefore triggers `@rakhal/web` **and** `@rakhal/admin`.
3. Cache: turbo remote cache stays off (no external service); GitHub Actions cache keys the pnpm store and
   `.turbo`.
4. Lighthouse stays a web-only job. Playwright visual regression (M2) is a separate, path-filtered job.
5. Required status checks on `main` mirror infra doc 14, Phase 3: CI green plus one review, no direct pushes.
6. `.npmrc` in the workspace root must not pin a machine path. (The consumer's committed `store-dir` is dropped
   at import; its CI already works around it.)

## Deploy: one repo, three units

The deployable units do not change. What changes is *where the build comes from*.

| Unit | Process | Port | Built from | Notes |
|---|---|---|---|---|
| web | `rakhal-web` | as today | `apps/web` | `pnpm --filter @rakhal/web build` |
| api | `rakhal-api` | as today | old repo until M6 | unchanged until the optional backend move |
| admin | `rakhal-admin` (new) | 3010 | `apps/admin` | host `admin.rakhal.com`, nginx IP allowlist, `ADMIN_API_BASE_URL` server-side only |

Use the **release-folder pattern** from infra doc 14, Phase 2: build into
`/srv/rakhal/<unit>/releases/<sha>/`, flip the `current` symlink, `pm2 reload`. This makes rollback a symlink
flip instead of a rebuild, and works identically for a monorepo build.

Build on the VM is acceptable at first (as today). The preferred end state is CI building once and uploading an
artifact, so staging and production run byte-identical output.

### Admin deployment checklist (can happen before any consumer migration)

1. DNS + TLS for `admin.rakhal.com` (infra doc 11).
2. nginx: IP allowlist for the whole host; the backend's `ADMIN_IP_ALLOWLIST` is a second layer and matches the
   admin *server's* address, not the human's (see README, "Admin sign-in").
3. Secrets: `JWT_ADMIN_SECRET`, `ADMIN_API_BASE_URL`; set `TRUST_PROXY_HOPS` correctly on the API.
4. A seeded `SUPER_ADMIN` created by a documented one-off script, with 2FA enrolled on first sign-in and the
   temporary password changed. Remove demo admin credentials from any non-dev environment.
5. PM2 entry `rakhal-admin`, health check on `/login`, monitoring per infra doc 15.

## M5 - Cutover runbook (web)

**Pre-conditions (all must hold):** M1-M2 green for at least two weeks; dedupe waves done or explicitly
paused; staging has run `apps/web` for one full release; rollback rehearsed on staging; owner sign-off recorded.

1. Announce and apply the freeze on `rakhal-consumer-frontend` (clear its `IN_FLIGHT.md`).
2. Final re-import of the original's tip into `apps/web`; verify route manifest and test counts equal the
   original's at that SHA.
3. Staging: deploy from the monorepo commit; run the post-deploy verification list (runbook section C) and the
   Lighthouse + axe baselines.
4. Production: run the release-folder deploy for `rakhal-web` from the monorepo commit. Verify `pm2 status`
   (no restart creep), login, a farm-scoped page, a form submit, and Sentry for ten minutes.
5. Mark the original repo read-only in its README (banner) but **do not archive yet**.

**Rollback (tested before step 4, takes minutes):**

1. Flip `/srv/rakhal/web/current` back to the previous release (built from the original repo).
2. `pm2 reload rakhal-web`; run the verification list.
3. Re-open the original repo for changes; record the reason; fix forward in the monorepo.

No database or API change is part of M5, so nothing needs undoing there.

## M7 - Retire the old repositories

After one full release cycle with no rollback: archive (GitHub "Archive repository"; **never delete**) the
original frontend repo, keep the `pre-monorepo-import` tags, and leave a pointer in each README. The backend
repo is archived only if M6 happened and its own cycle passed.
