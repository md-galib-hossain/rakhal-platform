import type { SqlDb } from './sql-db.ts';

export interface Migration {
  /** Strictly increasing, starting at 1. Stored in `PRAGMA user_version`. */
  version: number;
  sql: string;
}

/**
 * Version 1 (WP8b, ADR-006 section 4). Never edit a shipped migration: add a new one. A migration runs in one
 * transaction together with the `user_version` bump, so a crash leaves the database at the old version, unchanged.
 */
const V1 = `
CREATE TABLE outbox (
  seq             INTEGER PRIMARY KEY AUTOINCREMENT,
  local_id        TEXT NOT NULL UNIQUE,
  farm_id         TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL,
  path            TEXT NOT NULL,
  body            TEXT NOT NULL,
  depends_on      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'failed', 'conflict', 'done')),
  queued_at       INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  last_error      TEXT,
  conflict        TEXT,
  result          TEXT,
  done_at         INTEGER
);
CREATE INDEX outbox_status_seq_idx ON outbox (status, seq);

CREATE TABLE cache_rows (
  farm_id TEXT NOT NULL,
  entity  TEXT NOT NULL,
  id      TEXT NOT NULL,
  search  TEXT NOT NULL DEFAULT '',
  data    TEXT NOT NULL,
  PRIMARY KEY (farm_id, entity, id)
);
CREATE INDEX cache_rows_entity_idx ON cache_rows (farm_id, entity);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const MIGRATIONS: readonly Migration[] = [{ version: 1, sql: V1 }];

export class DatabaseTooNewError extends Error {
  readonly found: number;
  readonly supported: number;
  constructor(found: number, supported: number) {
    super(`Local database is version ${found}, this app only understands up to ${supported}`);
    this.name = 'DatabaseTooNewError';
    this.found = found;
    this.supported = supported;
  }
}

/** Bring the database to the latest version. Returns the version it ends at. */
export async function migrate(db: SqlDb, migrations: readonly Migration[] = MIGRATIONS): Promise<number> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  sorted.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Migration versions must be 1..n with no gaps (found ${m.version} at ${i + 1})`);
  });
  const latest = sorted.length;
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > latest) throw new DatabaseTooNewError(current, latest);
  for (const m of sorted) {
    if (m.version <= current) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.exec(`PRAGMA user_version = ${m.version}`);
    });
  }
  return latest;
}
