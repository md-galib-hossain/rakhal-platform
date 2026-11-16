# ADR-008: Production runs as a Docker Compose stack on one VPS, Postgres in a container

Status: **accepted** (owner direction 2026-11-16). Supersedes the old backend-repo PM2/nginx deploy runbook.
Operational steps live in [`docs/operations/deployment.md`](../operations/deployment.md).

## Context

- The old backend, admin and web repos are being removed; `apps/api`, `apps/web`, `apps/admin` in this monorepo
  are the only deployables. `apps/mobile` ships through EAS, not a server.
- Expected load for the first six months: about **50 requests per second** peak. Cost discipline is a project
  rule (CLAUDE.md): lean stack, no Kafka, nothing that adds spend before scale needs it.
- Hosting is a **Hostinger KVM 2** (about 2 vCPU / 8 GB RAM / NVMe), region Singapore or India (pick by
  measured latency from Dhaka).
- Neon was considered for Postgres. The owner chose to run Postgres in a container for now, accepting the
  backup and upgrade work that comes with it.

## Decisions

1. **One VPS runs everything under Docker Compose**: `caddy`, `web`, `admin`, `api`, `postgres`, `redis`, a
   one-shot `migrate`, and a `backup` service. Files: `docker-compose.yml` (base, also used locally and in CI)
   plus `docker-compose.prod.yml` (prod override).
2. **Caddy is the reverse proxy.** Automatic TLS, one block per domain, `/metrics` answered 404 publicly.
   Cloudflare proxies the three hostnames (SSL mode Full strict). Nothing else is published to the host.
3. **Images are built in CI, never on the server.** `.github/workflows/images.yml` builds `api`,
   `api-migrator`, `web`, `admin`, `backup` and pushes `sha-<commit>` + `latest` to GHCR on merge to `main`.
   A compose smoke test boots the whole stack on every relevant PR. Rollback means redeploying an older tag.
4. **Deploys go through `scripts/deploy.sh <tag>`**: validate, pull, pre-deploy backup, migrate, swap, health
   gate, automatic rollback of the app images on failure. `scripts/rollback.sh` redeploys the previous tag.
   The script refuses `latest`, flags, missing env keys and concurrent runs, and never removes volumes.
5. **Postgres 16 runs in a container** with no host port, tuned for the box (`shared_buffers=1GB`,
   `max_connections=50`, API pool 20). Admin access is `docker compose exec` on the server.
6. **Backups are off-box and encrypted.** A nightly `pg_dump -Fc` is streamed through **age** to a **separate,
   private R2 bucket** with its own token. The server holds only the age **public** key, so a server breach
   cannot decrypt old backups. Retention: 30 dailies, 12 monthlies. Each run is a full independent snapshot.
   A healthchecks-style ping alerts when a night is missed. Restore defaults to a scratch database and refuses
   the live one without `CONFIRM_RESTORE=yes`.
7. **Two env files on the server**: `.env.prod` (compose-level: domains, image tag, Postgres password,
   backup keys) and `.env.api` (API runtime secrets only). `--env-file` fills compose placeholders but never
   reaches a container, so the API reads `.env.api` through `env_file`. Splitting them keeps the backup R2 keys
   out of the API container, so a compromised API cannot delete backups.
8. **One API container.** HTTP, schedulers and BullMQ workers run together. At 50 requests per second one
   container suffices. Scaling to two replicas is deferred until the cron and queue jobs are made safe to run
   twice (leader lock or a separate worker container). Until then a deploy means a few seconds of downtime.

## Consequences

- Cheapest workable setup and one moving part per concern. Compose files are the same locally, in CI and in
  production, so CI exercises what ships.
- **Single point of failure.** If the VPS dies, recovery is a new VPS plus a restore from R2: target under
  one hour, data loss up to 24 hours (nightly dumps). This must be rehearsed (see the runbook).
- Rollback reverts app images only; **database migrations are never reversed**. Migrations must stay additive
  (expand, then contract in a later release) so the previous app version works on the newer schema.
- Postgres operations (backups, upgrades, disk, tuning) are now ours. Major-version upgrades are a
  dump-and-restore in a quiet window.
- Moving to a managed database later only needs `DATABASE_URL` changed plus a dump and restore.

## Revisit when

- **Sustained load above roughly 50 requests per second**, or CPU steal / report generation hurting API
  latency: add an API replica and a worker split (after the double-run audit above), or move to a larger box.
- **A day of data loss becomes unacceptable** (paying customers, finance data): switch to WAL archiving with
  pgBackRest for point-in-time restore, or move to managed Postgres.
- **Zero-downtime deploys are required**: two API replicas behind Caddy `reverse_proxy` with health checks.
- Disk use passes 70%, or the nightly backup takes long enough to affect the box.

## Open items (not yet done or verified)

- Real R2 bucket, token and age keypair; real healthchecks ping URL.
- First real VPS deployment, GHCR pulls and Caddy certificate issuance.
- Image size: `api` is about 1.3 GB and `api-migrator` about 2.7 GB; shrink with `pnpm deploy --prod`.
- Admin panel protection (Cloudflare Access or `ADMIN_ALLOW_CIDR`) to be switched on before launch.
