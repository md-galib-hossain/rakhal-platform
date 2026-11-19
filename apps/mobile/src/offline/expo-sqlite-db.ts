import type { SqlDb, SqlParam } from './sql-db.ts';

/** What both `SQLiteDatabase` and the handle given to an exclusive transaction offer. */
interface Handle {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlParam[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlParam[]): Promise<T | null>;
}

function wrap(handle: Handle, transaction: SqlDb['transaction']): SqlDb {
  return {
    exec: (sql) => handle.execAsync(sql),
    run: async (sql, params = []) => ({ changes: (await handle.runAsync(sql, [...params])).changes }),
    all: <T>(sql: string, params: readonly SqlParam[] = []) => handle.getAllAsync<T>(sql, [...params]),
    get: <T>(sql: string, params: readonly SqlParam[] = []) => handle.getFirstAsync<T>(sql, [...params]),
    transaction,
  };
}

function isExpoSqliteAvailable(): boolean {
  const g = globalThis as unknown as { expo?: { modules?: Record<string, unknown> } };
  return Boolean(g.expo?.modules?.['ExpoSQLite']);
}

/** Open the on-device database (WAL, so reads are not blocked by the sync loop's writes). */
export async function openExpoSqliteDb(name = 'rakhal-offline.db'): Promise<SqlDb> {
  if (!isExpoSqliteAvailable()) {
    throw new Error("Cannot find native module 'ExpoSQLite'. Offline storage requires a client build with ExpoSQLite linked.");
  }
  const SQLite = await import('expo-sqlite');
  const raw = await SQLite.openDatabaseAsync(name);
  await raw.execAsync('PRAGMA journal_mode = WAL;');

  const transaction: SqlDb['transaction'] = async (fn) => {
    let result: unknown;
    await raw.withExclusiveTransactionAsync(async (txn) => {
      const nested: SqlDb['transaction'] = () => Promise.reject(new Error('Transactions do not nest'));
      result = await fn(wrap(txn as unknown as Handle, nested));
    });
    return result as never;
  };
  return wrap(raw as unknown as Handle, transaction);
}
