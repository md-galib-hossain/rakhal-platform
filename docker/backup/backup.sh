#!/bin/bash
# One full pg_dump -> age encrypt -> rclone upload. Each run is a complete, independent snapshot.
# Layout in the bucket:
#   daily/rakhal-<UTC>.dump.age     kept KEEP_DAILY_DAYS (default 30)
#   monthly/rakhal-<UTC>.dump.age   copy made on the 1st, kept KEEP_MONTHLY_DAYS (default 365)
set -euo pipefail

: "${DATABASE_URL:?}" "${AGE_PUBLIC_KEY:?}" "${BACKUP_REMOTE:?}"
KEEP_DAILY_DAYS="${KEEP_DAILY_DAYS:-30}"
KEEP_MONTHLY_DAYS="${KEEP_MONTHLY_DAYS:-365}"
ping_url() { [ -n "${HEALTHCHECK_URL:-}" ] && curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}$1" >/dev/null || true; }

trap 'echo "[backup] FAILED at $(date -u +%FT%TZ)" >&2; ping_url /fail' ERR
ping_url /start

ts="$(date -u +%Y%m%dT%H%M%SZ)"
key="daily/rakhal-${ts}.dump.age"
echo "[backup] dumping -> ${BACKUP_REMOTE}/${key}"

# Custom format (-Fc) is compressed and restorable with pg_restore. Streamed: no plaintext touches disk.
pg_dump --format=custom --no-owner --no-privileges "${DATABASE_URL}" \
  | age -r "${AGE_PUBLIC_KEY}" \
  | rclone rcat "${BACKUP_REMOTE}/${key}"

# Verify: object exists and is not empty (a failed pg_dump already tripped pipefail above). An EMPTY database
# still dumps to ~1 KB (header + age envelope), so the floor must stay well below that.
size="$(rclone size --json "${BACKUP_REMOTE}/${key}" | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')"
[ "${size:-0}" -gt 100 ] || { echo "[backup] uploaded object is suspiciously small (${size:-0} bytes)" >&2; exit 1; }

if [ "$(date -u +%d)" = "01" ]; then
  rclone copyto "${BACKUP_REMOTE}/${key}" "${BACKUP_REMOTE}/monthly/rakhal-${ts}.dump.age"
fi

rclone delete "${BACKUP_REMOTE}/daily" --min-age "${KEEP_DAILY_DAYS}d"
rclone delete "${BACKUP_REMOTE}/monthly" --min-age "${KEEP_MONTHLY_DAYS}d" 2>/dev/null || true

echo "[backup] ok ${key} (${size} bytes)"
ping_url ""
