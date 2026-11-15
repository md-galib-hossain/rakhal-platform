/** Test-only: the `SqlDb` seam over Node's built-in SQLite, so the offline core runs under `node --test`. */
import { DatabaseSync } from 'node:sqlite';
import type { SqlDb, SqlParam } from '../../src/offline/sql-db.ts';

export function createNodeSqliteDb(file = ':memory:'): SqlDb & { close(): void } {
  const db = new DatabaseSync(file);
  let inTransaction = false;

  const params = (p: readonly SqlParam[] | undefined): SqlParam[] => [...(p ?? [])];

  const self: SqlDb & { close(): void } = {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, p) => {
      const info = db.prepare(sql).run(...params(p));
      return { changes: Number(info.changes) };
    },
    // node:sqlite rows have a null prototype; copy to plain objects like expo-sqlite returns.
    all: async <T>(sql: string, p?: readonly SqlParam[]) =>
      db.prepare(sql).all(...params(p)).map((row) => ({ ...row })) as T[],
    get: async <T>(sql: string, p?: readonly SqlParam[]) => {
      const row = db.prepare(sql).get(...params(p));
      return row ? ({ ...row } as T) : null;
    },
    transaction: async <T>(fn: (tx: SqlDb) => Promise<T>): Promise<T> => {
      if (inTransaction) throw new Error('Transactions do not nest');
      inTransaction = true;
      db.exec('BEGIN');
      try {
        const result = await fn(self);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        inTransaction = false;
      }
    },
    close: () => db.close(),
  };
  return self;
}
