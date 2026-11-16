# Nightly encrypted Postgres backup to R2 (or any rclone remote). Build context: repo root.
# Same major version as the database so pg_dump/pg_restore match.
FROM postgres:16-alpine
RUN apk add --no-cache bash rclone age tzdata curl
COPY docker/backup/backup.sh /usr/local/bin/backup.sh
COPY docker/backup/restore.sh /usr/local/bin/restore.sh
COPY docker/backup/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
