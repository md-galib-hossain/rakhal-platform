import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, backoffDelayMs } from '../src/offline/backoff.ts';
import { healthUrl, probeHealth } from '../src/offline/connectivity.ts';
import { DatabaseTooNewError, migrate, MIGRATIONS } from '../src/offline/migrations.ts';
import { claimDatabase, clearLocalData } from '../src/offline/owner.ts';
import { createNodeSqliteDb } from './helpers/node-sqlite-db.ts';

const tables = async (db: ReturnType<typeof createNodeSqliteDb>) =>
  (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map(
    (r) => r.name,
  );
const version = async (db: ReturnType<typeof createNodeSqliteDb>) => (await db.get<{ user_version: number }>('PRAGMA user_version'))!.user_version;

test('a fresh database migrates to version 1 and a second run changes nothing', async () => {
  const db = createNodeSqliteDb();
  assert.equal(await migrate(db), 1);
  assert.equal(await version(db), 1);
  assert.deepEqual(await tables(db), ['cache_rows', 'meta', 'outbox']);
  assert.equal(await migrate(db), 1);
  assert.equal(await version(db), 1);
});

test('v1 -> v2 keeps the rows already in the queue and bumps the version', async () => {
  const db = createNodeSqliteDb();
  await migrate(db);
  await db.run(
    "INSERT INTO outbox (local_id, farm_id, user_id, endpoint, method, path, body, status, queued_at) VALUES ('a', 'f', 'u', 'e', 'POST', '/x', '{}', 'pending', 1)",
  );
  const v2 = [...MIGRATIONS, { version: 2, sql: "ALTER TABLE outbox ADD COLUMN note TEXT; UPDATE outbox SET note = 'migrated';" }];
  assert.equal(await migrate(db, v2), 2);
  assert.equal(await version(db), 2);
  const row = await db.get<{ local_id: string; status: string; note: string }>('SELECT local_id, status, note FROM outbox');
  assert.deepEqual(row, { local_id: 'a', status: 'pending', note: 'migrated' });
});

test('a migration that throws rolls back whole: no half-made table, version unchanged', async () => {
  const db = createNodeSqliteDb();
  await migrate(db);
  const broken = [...MIGRATIONS, { version: 2, sql: 'CREATE TABLE half (x INTEGER); THIS IS NOT SQL;' }];
  await assert.rejects(() => migrate(db, broken));
  assert.equal(await version(db), 1);
  assert.equal((await tables(db)).includes('half'), false);
});

test('a database newer than the app is refused, never downgraded', async () => {
  const db = createNodeSqliteDb();
  await migrate(db);
  await db.exec('PRAGMA user_version = 9');
  await assert.rejects(() => migrate(db), (e: unknown) => e instanceof DatabaseTooNewError && e.found === 9 && e.supported === 1);
});

test('migration versions must be 1..n with no gaps', async () => {
  const db = createNodeSqliteDb();
  await assert.rejects(() => migrate(db, [{ version: 2, sql: 'SELECT 1' }]), /no gaps/);
});

test('backoff: 5 s, doubling, capped at 15 min, +-20% jitter', () => {
  const mid = () => 0.5;
  assert.equal(backoffDelayMs(1, mid), BACKOFF_BASE_MS);
  assert.equal(backoffDelayMs(2, mid), BACKOFF_BASE_MS * 2);
  assert.equal(backoffDelayMs(3, mid), BACKOFF_BASE_MS * 4);
  assert.equal(backoffDelayMs(30, mid), BACKOFF_MAX_MS);
  assert.equal(backoffDelayMs(1, () => 0), BACKOFF_BASE_MS * 0.8);
  assert.equal(backoffDelayMs(1, () => 1), BACKOFF_BASE_MS * 1.2);
  assert.equal(backoffDelayMs(12, () => 1), BACKOFF_MAX_MS, 'jitter never pushes past the cap');
  for (let attempts = 1; attempts < 40; attempts += 1) {
    const d = backoffDelayMs(attempts);
    assert.ok(d >= 1 && d <= BACKOFF_MAX_MS);
  }
});

test('claiming: the first user owns it, the same user keeps data, another user wipes it', async () => {
  const db = createNodeSqliteDb();
  await migrate(db);
  assert.deepEqual(await claimDatabase(db, 'u1'), { wiped: false });
  await db.run(
    "INSERT INTO outbox (local_id, farm_id, user_id, endpoint, method, path, body, status, queued_at) VALUES ('a', 'f', 'u1', 'e', 'POST', '/x', '{}', 'pending', 1)",
  );
  await db.run("INSERT INTO cache_rows (farm_id, entity, id, search, data) VALUES ('f', 'cattle', 'c1', 'x', '{}')");
  assert.deepEqual(await claimDatabase(db, 'u1'), { wiped: false });
  assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM outbox'))!.n, 1);

  assert.deepEqual(await claimDatabase(db, 'u2'), { wiped: true });
  assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM outbox'))!.n, 0);
  assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM cache_rows'))!.n, 0);
  assert.equal((await db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'owner_user_id'"))!.value, 'u2');
});

test('clearLocalData removes the queue, the cache and the owner', async () => {
  const db = createNodeSqliteDb();
  await migrate(db);
  await claimDatabase(db, 'u1');
  await db.run("INSERT INTO cache_rows (farm_id, entity, id, search, data) VALUES ('f', 'cattle', 'c1', 'x', '{}')");
  await clearLocalData(db);
  assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM cache_rows'))!.n, 0);
  assert.equal((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM meta'))!.n, 0);
});

test('the health route sits outside the API prefix', () => {
  assert.equal(healthUrl('http://10.0.0.5:5005/api/v1'), 'http://10.0.0.5:5005/health');
  assert.equal(healthUrl('https://api.rakhal.app/api/v1/'), 'https://api.rakhal.app/health');
  assert.equal(healthUrl('https://api.rakhal.app'), 'https://api.rakhal.app/health');
});

test('probeHealth: any answer is reachable, a network error or a hang is not', async () => {
  assert.equal(await probeHealth('http://x/health', (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch), true);
  assert.equal(
    await probeHealth('http://x/health', (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch),
    false,
  );
  const hang = ((_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
  assert.equal(await probeHealth('http://x/health', hang, 20), false);
});
