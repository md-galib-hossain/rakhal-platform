# Deployment runbook (single VPS, Docker Compose)

Decision and rationale: [ADR-008](../decisions/ADR-008-single-vps-docker-deployment.md). This file is the
"how". Everything here runs **on the VPS** unless it says "laptop".

```
Cloudflare (DNS + proxy, SSL Full strict)
   -> Caddy :80/:443
        farm.rakhal.app  -> web   :3005
        admin.rakhal.app -> admin :3010
        api.rakhal.app   -> api   :5005   (/metrics blocked)
   docker compose: caddy web admin api postgres redis backup (+ one-shot migrate)
   off-box: GHCR (images), R2 (uploads bucket + private backups bucket), Resend, Sentry
```

Compose files: `docker-compose.yml` + `docker-compose.prod.yml`. Short alias used below:

```bash
alias dc='docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml'
```

**Never run `dc down -v` or `docker volume rm`**: `pg-data` is your database. `deploy.sh` refuses flags for this reason.

---

## 1. One-time setup

### 1.1 Accounts and secrets (laptop)
1. **Backup key pair** (keep the private key ONLY in your password manager):
   ```bash
   age-keygen -o rakhal-backup.key      # prints "Public key: age1..."
   ```
2. **R2**: create a private bucket `rakhal-backups` and an API token scoped to that bucket only (read, write,
   delete). Do not reuse the image-upload bucket or token.
3. **Healthchecks**: create a check (period 1 day, grace 2 hours) and copy its ping URL.
4. **Secrets**: generate each JWT/CSRF/session secret (32+ chars, all different):
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   Store every real value in the password manager. A lost VPS must not mean lost secrets.
5. **GitHub**: a classic personal access token with `read:packages` (needed to pull private GHCR images).
6. Optional repo variables for the web build: `WEB_PUBLIC_URL`, `FARM_PUBLIC_URL` (default
   `https://farm.rakhal.app`). They are baked into the web image at build time.

### 1.2 Server (Hostinger KVM 2, Ubuntu LTS)
Pick Singapore or India by pinging each datacenter from a Dhaka connection.

```bash
adduser deploy && usermod -aG sudo deploy          # then log in as deploy with an SSH key
# /etc/ssh/sshd_config: PasswordAuthentication no, PermitRootLogin no ; then: sudo systemctl reload ssh
sudo ufw default deny incoming && sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker deploy   # re-login
git clone https://github.com/md-galib-hossain/rakhal-platform.git ~/rakhal && cd ~/rakhal
echo "<PAT>" | docker login ghcr.io -u md-galib-hossain --password-stdin
```

Postgres, Redis and the apps publish **no** host ports in prod; only Caddy publishes 80/443. (Docker bypasses
ufw for published ports, which is one more reason to publish nothing else.)

### 1.3 Env files
```bash
cp .env.prod.example .env.prod && cp .env.api.example .env.api && chmod 600 .env.prod .env.api
```
- `.env.prod`: domains, `ACME_EMAIL`, `POSTGRES_PASSWORD`, `R2_ACCOUNT_ID`, `R2_BACKUP_*`, `AGE_PUBLIC_KEY`
  (public key only), `BACKUP_HEALTHCHECK_URL`, image registry/tag.
- `.env.api`: JWT/CSRF/session secrets, `EMAIL_FROM`, `RESEND_API_KEY`, image-upload R2 keys, Sentry.
- `EMAIL_FROM` must be a plain address (`no-reply@rakhal.app`), not `Name <addr>`.
- `.env.api` and `.env.prod` stay separate: the API must never receive the backup bucket keys.

### 1.4 Cloudflare
DNS: `farm`, `admin`, `api` A records to the VPS IP, proxied. SSL/TLS mode **Full (strict)**. Protect the admin
hostname with Cloudflare Access, or uncomment the IP allowlist block in `docker/Caddyfile` and set
`ADMIN_ALLOW_CIDR`.

---

## 2. Deploy

CI must be green and the images pushed first (GitHub, Actions, Images, `sha-<commit>` tags exist).

```bash
cd ~/rakhal
git fetch origin && git checkout <full-commit-sha>      # compose files and scripts must match the images
scripts/deploy.sh sha-<first-7-chars>
```

The script validates, pulls, backs up, migrates, swaps, waits for api/web/admin to be healthy, and records the
version in `.deploy/current` and `.deploy/history`. On a health failure it automatically redeploys the previous
version and exits non-zero. Read the lines it prints; do not assume success from a silent terminal.

First ever deploy: `previous` is `none`, so a failed first deploy has nothing to roll back to. Read the logs:
`dc logs api`.

Smoke check after any deploy:
```bash
curl -fsS https://api.rakhal.app/health && curl -fsS https://api.rakhal.app/ready
curl -s -o /dev/null -w '%{http_code}\n' https://farm.rakhal.app/    # 200
dc ps
```

**Migrations rule:** additive only (add columns/tables; remove or rename in a later release). Rollback does not
undo migrations, so the previous app must still work on the new schema.

## 3. Rollback

```bash
scripts/rollback.sh              # previous version from .deploy/history
scripts/rollback.sh sha-1234abc  # or a specific one
```
Skips backup and migrations (an old app must not change the schema). Running it twice flips between the two
versions. If a bad migration is the problem, rollback will not help: restore from backup (section 5) or ship a
forward fix.

---

## 4. Backups

- Nightly 02:00 Dhaka, full `pg_dump`, encrypted with age, uploaded to `r2:rakhal-backups/daily/`.
  First of the month also copied to `monthly/`. Kept 30 daily and 12 monthly.
- Every deploy takes one extra backup first.
- A success ping goes to healthchecks. **A missed night alerts you**; do not ignore it.
- Run one now: `dc run --rm --no-deps backup backup-now`
- List: `dc run --rm --no-deps backup list`

### 4.1 Monthly restore drill (do this; an untested backup is not a backup)
```bash
# key from the password manager, copied to the server only for the drill:
scp rakhal-backup.key deploy@<vps>:/tmp/key
dc exec postgres psql -U rakhal -c 'CREATE DATABASE restore_test'
dc run --rm --no-deps -v /tmp/key:/id/key:ro \
  -e RESTORE_DATABASE_URL="postgresql://rakhal:<POSTGRES_PASSWORD>@postgres:5432/restore_test" \
  backup restore.sh daily/<file>.dump.age /id/key
dc exec postgres psql -U rakhal -d restore_test -c 'select count(*) from "User"'   # compare with live
dc exec postgres psql -U rakhal -c 'DROP DATABASE restore_test'
shred -u /tmp/key
```
Restore refuses the live database unless `CONFIRM_RESTORE=yes` is set.

---

## 5. Disaster recovery: the VPS is gone

Target: under 1 hour. Data loss: up to 24 hours (since the last nightly dump).

1. New Hostinger VPS, repeat section 1.2. Do this from a fresh clone.
2. Recreate `.env.prod` and `.env.api` **from the password manager**. Keep the JWT secrets identical to the
   old ones or every user is logged out. A new `POSTGRES_PASSWORD` is fine (restore uses `--no-owner`).
3. Point Cloudflare A records to the new IP.
4. Start only the database, restore the newest backup into it:
   ```bash
   dc up -d --wait postgres redis
   scp rakhal-backup.key deploy@<new-vps>:/tmp/key
   dc run --rm --no-deps backup list                       # pick the newest daily file
   dc run --rm --no-deps -v /tmp/key:/id/key:ro \
     -e CONFIRM_RESTORE=yes \
     -e RESTORE_DATABASE_URL="postgresql://rakhal:<POSTGRES_PASSWORD>@postgres:5432/rakhal" \
     backup restore.sh daily/<file>.dump.age /id/key
   shred -u /tmp/key
   ```
5. `scripts/deploy.sh sha-<last-good-tag>` (migrations are a no-op or apply any missing ones).
6. Smoke check (section 2). Tell users about the data-loss window.

Time the full procedure once on a throwaway VPS before launch.

---

## 6. Everyday operations

| Need | Command |
|---|---|
| Status | `dc ps` and `cat .deploy/current` |
| Logs | `dc logs -f --tail 100 api` (also `web`, `admin`, `caddy`, `backup`) |
| DB shell | `dc exec postgres psql -U rakhal -d rakhal` |
| Disk | `df -h` ; `docker system df` ; alert at 70% |
| Restart one service | `dc restart api` |
| Deploy history | `cat .deploy/history` |

**Do not run `pnpm seed` in production.** It creates demo accounts. Production data comes from real sign-ups.

Log files are rotated by Docker (10 MB x 3 per container). Redis is capped at 768 MB with `noeviction`, so alert
if it nears the cap (BullMQ writes will start failing instead of evicting).

## 7. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| API restarts, "Invalid environment variables" | A key missing or malformed in `.env.api` (`EMAIL_FROM` must be a plain email; secrets 32+ chars). `dc logs api` names the key. |
| `Missing API key. Pass it to the constructor new Resend` | `RESEND_API_KEY` empty. Any placeholder boots; real mail needs a real key. |
| `deploy.sh` stops at "pre-deploy backup failed" | R2 token/bucket wrong, or Postgres down. Fix, or `SKIP_BACKUP=1` for an emergency. |
| Caddy cannot get a certificate | DNS not pointing here, or Cloudflare not on Full (strict), or ports 80/443 blocked. |
| 502 from Caddy | api not healthy yet (`dc ps`, `dc logs api`). |
| No backup ping this morning | `dc logs backup`; run `dc run --rm --no-deps backup backup-now` and read the error. |
| `deploy.sh`: "another deploy is running" | A crashed deploy left `.deploy/lock`. Remove it only if no deploy is running. |
| Disk filling | `docker system df`; Postgres log or WAL growth; old images (`docker image prune -f`). |

## 8. When to scale (and what it needs first)

Under about 50 requests per second one `api` container is fine. Before scaling to two API replicas, make the
`@nestjs/schedule` cron jobs and BullMQ processors safe to run twice (a Redis leader lock, or a dedicated
worker container); otherwise reminders, emails and finance postings run twice. Then switch the `api` block in
`docker/Caddyfile` to multiple upstreams for zero-downtime deploys. Upgrading the VPS plan comes first if the
cause is plain CPU or RAM.

## 9. Known gaps (as of this document)
Not yet exercised on a real server: GHCR pulls, Caddy certificates, real R2 uploads, the healthchecks ping, the
Cloudflare setup, and the disaster-recovery timing. Treat the first real deploy as a rehearsal and update this
file with what actually happened.
