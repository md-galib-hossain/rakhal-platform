#!/bin/bash
# Installs the cron schedule and runs crond in the foreground.
# `entrypoint.sh backup-now` runs one backup immediately; `entrypoint.sh restore.sh ...` runs a restore.
set -euo pipefail

case "${1:-cron}" in
  backup-now) exec /usr/local/bin/backup.sh ;;
  restore.sh|list) shift; exec /usr/local/bin/restore.sh "$@" ;;
  cron)
    # crond does not inherit the container env, so snapshot it for the job.
    printenv | grep -E '^(DATABASE_URL|AGE_PUBLIC_KEY|BACKUP_REMOTE|RCLONE_|HEALTHCHECK_URL|KEEP_|TZ)' \
      | sed 's/^/export /; s/=/="/; s/$/"/' > /etc/backup.env
    chmod 600 /etc/backup.env
    echo "${BACKUP_CRON:-0 2 * * *} . /etc/backup.env; /usr/local/bin/backup.sh > /proc/1/fd/1 2>&1" > /etc/crontabs/root
    echo "[backup] schedule '${BACKUP_CRON:-0 2 * * *}' (${TZ:-UTC}); remote ${BACKUP_REMOTE}"
    exec crond -f -l 8
    ;;
  *) echo "usage: entrypoint.sh [cron|backup-now|restore.sh <args>|list]" >&2; exit 2 ;;
esac
