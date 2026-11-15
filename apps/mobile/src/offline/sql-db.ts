/**
 * The smallest SQLite surface the offline layer needs (ADR-006). The app implements it over `expo-sqlite`
 * (`expo-sqlite-db.ts`); tests implement it over Node's built-in `node:sqlite`, so the outbox, migrations and sync
 * engine are plain TypeScript with no React Native import and run under `node --test`.
 */
export type SqlParam = string | number | null;

export interface SqlDb {
  /** Run one or more statements with no parameters and no result (schema, PRAGMA). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlParam[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  get<T>(sql: string, params?: readonly SqlParam[]): Promise<T | null>;
  /**
   * Run `fn` in one transaction: it commits when `fn` resolves and rolls back when it throws. Use only the `tx`
   * handle inside `fn`. Transactions do not nest.
   */
  transaction<T>(fn: (tx: SqlDb) => Promise<T>): Promise<T>;
}
