#!/usr/bin/env bash
# Redeploy the previous version (or a tag you name). App images only; the database is not rolled back.
#   scripts/rollback.sh              # back to the version before the current one (from .deploy/history)
#   scripts/rollback.sh sha-1234abc  # a specific version
# Runs a normal deploy with the pre-deploy backup and migrations skipped (an old app must not alter the schema).
# Set SKIP_BACKUP=0 to take a backup first. Rolling back twice in a row flips between the two versions.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${STATE_DIR:-$ROOT/.deploy}"

target="${1:-}"
if [ -z "$target" ]; then
  [ -f "$STATE_DIR/history" ] || { echo "no deploy history in $STATE_DIR; pass a tag explicitly" >&2; exit 1; }
  target="$(tail -n 1 "$STATE_DIR/history" | sed -n 's/.* prev=\([^ ]*\)$/\1/p')"
fi
if [ -z "$target" ] || [ "$target" = none ]; then
  echo "nothing to roll back to (no previous version recorded). Pass a tag explicitly." >&2
  exit 1
fi

echo "[rollback] redeploying $target"
export SKIP_MIGRATE=1
export SKIP_BACKUP="${SKIP_BACKUP:-1}"
exec "$ROOT/scripts/deploy.sh" "$target"
