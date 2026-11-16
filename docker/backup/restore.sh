#!/bin/bash
# Restore a backup into a target database. Needs the age PRIVATE key (identity file) from your password manager.
#   list                                   show available backups
#   restore.sh <object-key> <identity-file> restore into $RESTORE_DATABASE_URL
# Defaults to a SCRATCH database so a drill can never touch live data. To restore for real, point
# RESTORE_DATABASE_URL at the new empty database explicitly and set CONFIRM_RESTORE=yes.
set -euo pipefail

: "${BACKUP_REMOTE:?}"

if [ "${1:-}" = "list" ] || [ "$#" -eq 0 ]; then
  echo "== daily =="; rclone lsl "${BACKUP_REMOTE}/daily" | sort -k2,3 | tail -n 40
  echo "== monthly =="; rclone lsl "${BACKUP_REMOTE}/monthly" 2>/dev/null | sort -k2,3 | tail -n 14 || true
  exit 0
fi

key="${1:?object key, e.g. daily/rakhal-20261116T200000Z.dump.age}"
identity="${2:?path to age identity (private key) file}"
target="${RESTORE_DATABASE_URL:?set RESTORE_DATABASE_URL (a scratch DB for drills)}"
[ -r "${identity}" ] || { echo "cannot read identity file ${identity}" >&2; exit 1; }

live_host="$(printf '%s' "${DATABASE_URL:-}" | sed -E 's#^[^@]*@([^/?]*)/([^?]*).*$#\1/\2#')"
target_host="$(printf '%s' "${target}" | sed -E 's#^[^@]*@([^/?]*)/([^?]*).*$#\1/\2#')"
if [ -n "${DATABASE_URL:-}" ] && [ "${live_host}" = "${target_host}" ] && [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "refusing: target equals the LIVE database. Set CONFIRM_RESTORE=yes if that is truly intended." >&2
  exit 1
fi

echo "[restore] ${key} -> ${target_host}"
rclone cat "${BACKUP_REMOTE}/${key}" \
  | age -d -i "${identity}" \
  | pg_restore --no-owner --no-privileges --clean --if-exists --exit-on-error -d "${target}"
echo "[restore] done. Spot-check row counts before trusting it."
