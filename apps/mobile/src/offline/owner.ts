import type { SqlDb } from './sql-db.ts';

export const OWNER_KEY = 'owner_user_id';

/**
 * Claim the local database for a signed-in user (ADR-006 section 8). When the previous owner was a different user the
 * queue, the cache and the meta rows are wiped first: one device never sends or shows another account's data.
 */
export async function claimDatabase(db: SqlDb, userId: string): Promise<{ wiped: boolean }> {
  return db.transaction(async (tx) => {
    const row = await tx.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [OWNER_KEY]);
    const wiped = row !== null && row.value !== userId;
    if (wiped) {
      await tx.exec('DELETE FROM outbox; DELETE FROM cache_rows; DELETE FROM meta;');
    }
    await tx.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
      OWNER_KEY,
      userId,
    ]);
    return { wiped };
  });
}

/**
 * Who the database was last claimed by. Used on an offline cold start, when the session is restored from the stored
 * refresh token but the user's profile has not loaded yet: the stored session belongs to the last user who signed in,
 * and signing in as anyone else wipes this database first, so the owner is that user.
 */
export async function readOwner(db: SqlDb): Promise<string | null> {
  const row = await db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [OWNER_KEY]);
  return row?.value ?? null;
}

/** Drop everything stored for offline use (sign-out with the user's confirmation). */
export async function clearLocalData(db: SqlDb): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.exec('DELETE FROM outbox; DELETE FROM cache_rows; DELETE FROM meta;');
  });
}
