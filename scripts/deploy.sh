#!/usr/bin/env bash
# Deploy one image version to this server with a safety net. Run ON THE VPS from anywhere:
#   scripts/deploy.sh sha-a26bf8a
#
# Order: validate -> pull images -> start db/redis -> pre-deploy backup -> migrate -> swap app containers
#        -> health gate -> (on failure) automatic rollback to the previous version.
# Nothing touches the running app until the images are pulled, the backup is taken and migrations succeed.
# Rollback restores the previous APP images only. Database migrations are not reversed, which is why
# migrations must stay additive (old app version must still work on the new schema).
#
# Knobs (env): ENV_FILE COMPOSE_FILES DEPLOY_SERVICES HEALTH_SERVICES HEALTH_TIMEOUT CHECK_URL
#              SKIP_BACKUP=1 SKIP_MIGRATE=1 PULL=0 (use local images) ALLOW_LATEST=1 STATE_DIR
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILES="${COMPOSE_FILES:-docker-compose.yml docker-compose.prod.yml}"
DEPLOY_SERVICES="${DEPLOY_SERVICES:-api web admin caddy backup}"
HEALTH_SERVICES="${HEALTH_SERVICES:-api web admin}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
STATE_DIR="${STATE_DIR:-.deploy}"
API_ENV_FILE="${API_ENV_FILE:-.env.api}"   # API runtime secrets, kept apart from ENV_FILE (see .env.api.example)
REQUIRED_KEYS="${REQUIRED_KEYS:-POSTGRES_PASSWORD FARM_DOMAIN ADMIN_DOMAIN API_DOMAIN ACME_EMAIL AGE_PUBLIC_KEY}"
REQUIRED_API_KEYS="${REQUIRED_API_KEYS:-JWT_ACCESS_SECRET JWT_REFRESH_SECRET JWT_ADMIN_SECRET AUTH_CSRF_SECRET SESSION_SECRET EMAIL_FROM RESEND_API_KEY}"
PULL="${PULL:-1}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
SKIP_MIGRATE="${SKIP_MIGRATE:-0}"

log()  { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die()  { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

dc() {
  local args=(--env-file "$ENV_FILE") f
  for f in $COMPOSE_FILES; do args+=(-f "$f"); done
  docker compose "${args[@]}" "$@"
}

# ---------- 1. validate ----------
tag="${1:-}"
[ "$#" -eq 1 ] || die "usage: scripts/deploy.sh <image-tag>   e.g. sha-a26bf8a"
case "$tag" in
  -*) die "this script takes no flags (refusing '$tag'). It never removes volumes." ;;
  latest) [ "${ALLOW_LATEST:-0}" = 1 ] || die "refusing 'latest': deploy a concrete tag (sha-<commit>) so rollback is possible. ALLOW_LATEST=1 to override." ;;
  *) [[ "$tag" =~ ^(sha-[0-9a-f]{7,40}|v[0-9][0-9A-Za-z._-]*)$ ]] || die "bad tag '$tag' (expected sha-<7-40 hex> or vX.Y.Z)" ;;
esac

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found (copy .env.prod.example and fill it in)"
if perms="$(stat -c %a "$ENV_FILE" 2>/dev/null)" && [ "${perms: -1}" != 0 ]; then
  log "warning: $ENV_FILE is readable by other users (mode $perms); run: chmod 600 $ENV_FILE"
fi
missing=""
for key in $REQUIRED_KEYS; do
  grep -Eq "^${key}=.+" "$ENV_FILE" || missing="$missing $key"
done
[ -z "$missing" ] || die "empty or missing in $ENV_FILE:$missing"

[ -f "$API_ENV_FILE" ] || die "$API_ENV_FILE not found (copy .env.api.example and fill it in)"
missing=""
for key in $REQUIRED_API_KEYS; do
  grep -Eq "^${key}=.+" "$API_ENV_FILE" || missing="$missing $key"
done
[ -z "$missing" ] || die "empty or missing in $API_ENV_FILE:$missing"
export API_ENV_FILE

mkdir -p "$STATE_DIR"
if ! mkdir "$STATE_DIR/lock" 2>/dev/null; then
  die "another deploy is running (or crashed): remove $STATE_DIR/lock if you are sure it is not"
fi
trap 'rmdir "$STATE_DIR/lock" 2>/dev/null || true' EXIT

previous="none"
[ -f "$STATE_DIR/current" ] && previous="$(cat "$STATE_DIR/current")"
log "deploying $tag (currently: $previous)"

export IMAGE_TAG="$tag"
dc config -q || die "compose config is invalid"

# ---------- health gate ----------
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) svc cid st restarts
  for svc in $HEALTH_SERVICES; do
    while :; do
      cid="$(dc ps -q "$svc" 2>/dev/null | head -n1 || true)"
      st="none"; restarts=0
      if [ -n "$cid" ]; then
        st="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo none)"
        restarts="$(docker inspect -f '{{.RestartCount}}' "$cid" 2>/dev/null || echo 0)"
      fi
      if [ "$st" = healthy ] || [ "$st" = running ]; then log "  $svc: $st"; break; fi
      if [ "$restarts" -ge 3 ]; then log "  $svc: crash-looping ($restarts restarts)"; return 1; fi
      if [ "$SECONDS" -ge "$deadline" ]; then log "  $svc: not healthy after ${HEALTH_TIMEOUT}s (state: $st)"; return 1; fi
      sleep 3
    done
  done
  if [ -n "${CHECK_URL:-}" ]; then
    curl -fsS -m 15 "$CHECK_URL" >/dev/null || { log "  CHECK_URL $CHECK_URL failed"; return 1; }
    log "  $CHECK_URL ok"
  fi
}

swap_app() { # $1 = tag
  export IMAGE_TAG="$1"
  # `up` exits non-zero when api never turns healthy (web/admin wait on it). That must NOT abort the script:
  # the health gate below decides, and on failure it rolls back.
  # shellcheck disable=SC2086
  dc up -d --no-build --pull never --remove-orphans $DEPLOY_SERVICES \
    || log "compose up reported a failure; the health gate will decide"
}

# ---------- 2. pull ----------
if [ "$PULL" = 1 ]; then
  log "pulling images for $tag"
  dc pull api web admin migrate backup || die "pull failed; nothing changed"
else
  log "PULL=0: using images already on this machine"
fi

# ---------- 3-5. db up, backup, migrate (the running app is untouched so far) ----------
log "ensuring postgres and redis are up"
dc up -d --wait postgres redis || die "postgres/redis did not become healthy; nothing changed"

if [ "$SKIP_BACKUP" = 1 ]; then
  log "SKIP_BACKUP=1: skipping pre-deploy backup"
else
  log "pre-deploy backup"
  dc run --rm --no-deps backup backup-now || die "pre-deploy backup failed; nothing changed. Fix it or set SKIP_BACKUP=1"
fi

if [ "$SKIP_MIGRATE" = 1 ]; then
  log "SKIP_MIGRATE=1: skipping migrations"
else
  log "running migrations"
  dc run --rm --no-deps migrate || die "migration failed; the previous app version is still running untouched"
fi

# ---------- 6-7. swap + gate + rollback ----------
log "starting new app containers"
swap_app "$tag"
log "health gate (timeout ${HEALTH_TIMEOUT}s per service)"
if ! wait_healthy; then
  log "HEALTH CHECK FAILED for $tag"
  if [ "$previous" != none ] && [ "$previous" != "$tag" ]; then
    log "rolling back app containers to $previous"
    [ "$PULL" = 1 ] && { IMAGE_TAG="$previous" dc pull api web admin backup >/dev/null 2>&1 || true; }
    swap_app "$previous"
    if wait_healthy; then
      log "ROLLED BACK to $previous. $tag is NOT live. Check: docker compose logs api"
    else
      log "ROLLBACK ALSO UNHEALTHY. Manual action needed now: docker compose logs"
    fi
  else
    log "no previous version recorded: nothing to roll back to. Check: docker compose logs"
  fi
  exit 1
fi

# ---------- 8. record ----------
printf '%s' "$tag" > "$STATE_DIR/current"
# Redeploying the version that is already live must not write "prev=<same tag>": that would make
# rollback.sh a no-op. History only records real version changes.
if [ "$previous" != "$tag" ]; then
  printf '%s %s prev=%s\n' "$(date -u +%FT%TZ)" "$tag" "$previous" >> "$STATE_DIR/history"
else
  log "same version as before: history unchanged"
fi
docker image prune -f >/dev/null 2>&1 || true
log "OK: $tag is live (was $previous)"
dc ps
