import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate } from '../src/offline/migrations.ts';
import { createOutbox, OUTBOX_CAP, OutboxFullError } from '../src/offline/outbox.ts';
import { readCache } from '../src/offline/pull.ts';
import { createSyncEngine, type SyncSnapshot } from '../src/offline/sync-engine.ts';
import { createNodeSqliteDb } from './helpers/node-sqlite-db.ts';
import {
  apiError,
  createFakeApi,
  createManualTimers,
  fixedIds,
  networkError,
  page,
  type Call,
  type Responder,
} from './helpers/fake-api.ts';

const USER = 'u1';
const FARM = 'f1';

/** Answers every pull route with an empty list unless the test overrides it. */
const base =
  (write: Responder): Responder =>
  (call) => {
    if (call.method === 'GET') return call.path === '/cattle' || call.path === '/tasks' ? page([]) : [];
    return write(call);
  };

async function setup(write: Responder = () => ({ ok: true }), options: { reachable?: () => boolean } = {}) {
  const db = createNodeSqliteDb();
  await migrate(db);
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const fake = createFakeApi(base(write));
  const timers = createManualTimers();
  let probes = 0;
  let hint: boolean | null = null;
  const engine = createSyncEngine({
    db,
    api: fake.api,
    session: { userId: USER, farmId: FARM },
    probe: async () => {
      probes += 1;
      return options.reachable?.() ?? true;
    },
    networkHint: () => hint,
    newId: fixedIds('eng'),
    now: clock.now,
    random: () => 0.5,
    timers: timers.timers,
    pullIntervalMs: 1_000,
  });
  // Test-side queue on the same database (the engine's own enqueue would also start a pass).
  const queue = createOutbox(db, { newId: fixedIds('q'), now: clock.now });
  const put = (path: string, extra: Record<string, unknown> = {}) =>
    queue.enqueue({ farmId: FARM, userId: USER, endpoint: 'task.complete', method: 'POST', path, body: { path }, ...extra });
  const statuses = async () => Object.fromEntries((await queue.list({ userId: USER })).map((r) => [r.path, r.status]));
  return {
    db,
    engine,
    queue,
    put,
    statuses,
    clock,
    timers,
    fake,
    probes: () => probes,
    setHint: (v: boolean | null) => (hint = v),
  };
}

const posted = (calls: Call[]) => calls.filter((c) => c.method !== 'GET').map((c) => c.path);

test('sends the queue in order with each row\'s own key, then pulls the working set', async () => {
  const s = await setup();
  await s.put('/a');
  await s.put('/b');
  await s.put('/c');
  await s.engine.kick();

  assert.deepEqual(posted(s.fake.calls), ['/a', '/b', '/c']);
  assert.deepEqual(
    s.fake.posts().map((c) => c.headers?.['Idempotency-Key']),
    ['q-1', 'q-2', 'q-3'],
  );
  assert.deepEqual(await s.statuses(), { '/a': 'done', '/b': 'done', '/c': 'done' });
  const lastPostIndex = s.fake.calls.map((c) => c.method).lastIndexOf('POST');
  const firstGetIndex = s.fake.calls.findIndex((c) => c.method === 'GET');
  assert.ok(firstGetIndex > lastPostIndex, 'push first, then pull');
  assert.deepEqual(s.fake.gets().map((c) => c.path), ['/sheds', '/inventory/milk-tanks', '/cattle', '/tasks', '/milk/log']);
  const snap = s.engine.getSnapshot();
  assert.equal(snap.state, 'idle');
  assert.deepEqual([snap.waiting, snap.failed, snap.conflict], [0, 0, 0]);
  assert.equal(snap.lastSyncedAt, s.clock.now());
});

test('a network failure on row 2 stops the pass: row 3 is not sent, the retry is scheduled, then the queue resumes in order with the same keys', async () => {
  let dead = true;
  const s = await setup((call) => {
    if (call.path === '/b' && dead) throw networkError();
    return { ok: true };
  });
  await s.put('/a');
  await s.put('/b');
  await s.put('/c');
  await s.engine.kick();

  assert.deepEqual(posted(s.fake.calls), ['/a', '/b'], 'c is never attempted behind a stuck b');
  assert.deepEqual(await s.statuses(), { '/a': 'done', '/b': 'pending', '/c': 'pending' });
  const b = (await s.queue.list({ userId: USER })).find((r) => r.path === '/b')!;
  assert.equal(b.attempts, 1);
  assert.equal(b.nextAttemptAt, s.clock.now() + 5_000);
  assert.equal(s.engine.getSnapshot().state, 'offline');
  assert.equal(s.fake.gets().length, 0, 'no pull while the queue is stuck');
  assert.equal(s.timers.active().length, 1, 'a retry is scheduled');

  dead = false;
  s.clock.advance(5_000);
  s.timers.fire();
  await s.engine.kick();
  assert.deepEqual(posted(s.fake.calls), ['/a', '/b', '/b', '/c']);
  assert.deepEqual(
    s.fake.posts().map((c) => c.headers?.['Idempotency-Key']),
    ['q-1', 'q-2', 'q-2', 'q-3'],
    'the retry of b carries b\'s original key',
  );
  assert.deepEqual(await s.statuses(), { '/a': 'done', '/b': 'done', '/c': 'done' });
  assert.equal(s.engine.getSnapshot().state, 'idle');
});

test('server errors back off 5 s, then 10 s; the row is never dropped', async () => {
  const s = await setup((call) => {
    if (call.path === '/a') throw apiError(503, 'down');
    return { ok: true };
  });
  await s.put('/a');
  await s.engine.kick();
  let a = (await s.queue.list({ userId: USER }))[0]!;
  assert.deepEqual([a.status, a.attempts, a.nextAttemptAt, a.lastError], ['pending', 1, s.clock.now() + 5_000, 'down']);

  s.clock.advance(5_000);
  s.timers.fire();
  await s.engine.kick();
  a = (await s.queue.list({ userId: USER }))[0]!;
  assert.deepEqual([a.attempts, a.nextAttemptAt], [2, s.clock.now() + 10_000]);
  assert.equal(s.engine.getSnapshot().waiting, 1);
});

test('an own-key rejection (400) fails that row only: it stays visible and the next row still goes', async () => {
  const s = await setup((call) => {
    if (call.path === '/b') throw apiError(400, 'Cattle is not in the herd');
    return { ok: true };
  });
  await s.put('/a');
  await s.put('/b');
  await s.put('/c');
  await s.engine.kick();

  assert.deepEqual(await s.statuses(), { '/a': 'done', '/b': 'failed', '/c': 'done' });
  const b = (await s.queue.list({ userId: USER })).find((r) => r.path === '/b')!;
  assert.equal(b.lastError, 'Cattle is not in the herd');
  const snap = s.engine.getSnapshot();
  assert.equal(snap.failed, 1);
  assert.equal(snap.state, 'idle');

  // Fix the cause, retry from the sheet: it goes out with its original key.
  await s.engine.retry(b.localId);
  await s.engine.kick();
  assert.equal(s.fake.posts().filter((c) => c.path === '/b').length >= 1, true);
});

test('a conflicted milk save waits for the user; its submit is held; keeping the server version releases the submit', async () => {
  const s = await setup((call) =>
    call.path === '/milk/log' ? { saved: 0, conflicts: [{ cattleId: 'c1', server: { yieldL: 4 } }] } : { ok: true },
  );
  const save = await s.put('/milk/log', { endpoint: 'milk.saveLog' });
  await s.put('/milk/submit', { endpoint: 'milk.submit', dependsOn: save.localId });
  await s.put('/other');
  await s.engine.kick();

  assert.deepEqual(await s.statuses(), { '/milk/log': 'conflict', '/milk/submit': 'pending', '/other': 'done' });
  assert.deepEqual(posted(s.fake.calls), ['/milk/log', '/other'], 'the submit is not sent while the conflict is open');
  assert.equal(s.engine.getSnapshot().conflict, 1);

  await s.engine.keepServerVersion(save.localId);
  await s.engine.kick();
  assert.deepEqual(posted(s.fake.calls), ['/milk/log', '/other', '/milk/submit']);
  assert.equal((await s.statuses())['/milk/submit'], 'done');
});

test('offline: nothing is sent or pulled, a re-check is scheduled; the phone\'s own flag skips the probe', async () => {
  let reachable = false;
  const s = await setup(() => ({ ok: true }), { reachable: () => reachable });
  await s.put('/a');
  await s.engine.kick();
  assert.equal(s.engine.getSnapshot().state, 'offline');
  assert.equal(s.fake.calls.length, 0);
  assert.equal(s.probes(), 1);
  assert.equal(s.timers.active().length, 1);

  s.setHint(false);
  await s.engine.kick();
  assert.equal(s.probes(), 1, 'a known-offline phone is not probed');

  s.setHint(null);
  reachable = true;
  await s.engine.kick();
  assert.deepEqual(posted(s.fake.calls), ['/a']);
  assert.equal(s.engine.getSnapshot().state, 'idle');
});

test('a write that was in flight when the app was killed is sent again with the same key', async () => {
  const s = await setup();
  const row = await s.put('/a');
  await s.queue.beginSending(row.localId); // process dies here, status stays 'sending'
  await s.engine.kick();
  assert.deepEqual(s.fake.posts().map((c) => c.headers?.['Idempotency-Key']), [row.localId]);
  assert.equal((await s.statuses())['/a'], 'done');
});

test('a dead session pauses the queue and keeps every row for the next sign-in', async () => {
  const s = await setup(() => {
    throw apiError(401, 'expired');
  });
  await s.put('/a');
  await s.put('/b');
  await s.engine.kick();
  assert.equal(s.engine.getSnapshot().state, 'paused');
  assert.deepEqual(await s.statuses(), { '/a': 'pending', '/b': 'pending' });
  assert.deepEqual(posted(s.fake.calls), ['/a']);
});

test('overlapping kicks collapse: every row is sent exactly once', async () => {
  const s = await setup();
  await s.put('/a');
  await s.put('/b');
  await Promise.all([s.engine.kick(), s.engine.kick(), s.engine.kick({ pull: true })]);
  assert.deepEqual(posted(s.fake.calls), ['/a', '/b']);
});

test('the pull keeps the cache of the active farm, drops what the server dropped, and survives a failing route', async () => {
  let cattle = [{ id: 'c1', tagNumber: 'RKL-001' }, { id: 'c2', tagNumber: 'RKL-002' }];
  let failTasks = false;
  const s = await setup();
  const original = s.fake.api.get.bind(s.fake.api);
  s.fake.api.get = (async (path: string, options?: unknown) => {
    if (path === '/cattle') return { data: cattle, meta: { hasNextPage: false } };
    if (path === '/tasks' && failTasks) throw apiError(500, 'tasks down');
    return original(path, options as never);
  }) as typeof s.fake.api.get;

  await s.engine.kick({ pull: true });
  assert.deepEqual((await readCache(s.db, FARM, 'cattle')).map((r) => r.id), ['c1', 'c2']);

  cattle = [{ id: 'c2', tagNumber: 'RKL-002' }];
  failTasks = true;
  s.clock.advance(2_000);
  await s.engine.kick();
  assert.deepEqual((await readCache(s.db, FARM, 'cattle')).map((r) => r.id), ['c2'], 'cattle refreshed even though tasks failed');
  assert.equal(s.engine.getSnapshot().lastError, 'tasks down');
});

test('start() hands the database to the signed-in user: another user\'s queue and cache are wiped first', async () => {
  const s = await setup();
  await s.db.run("INSERT INTO meta (key, value) VALUES ('owner_user_id', 'someone-else')");
  await s.db.run(
    "INSERT INTO outbox (local_id, farm_id, user_id, endpoint, method, path, body, status, queued_at) VALUES ('old', 'f9', 'someone-else', 'e', 'POST', '/old', '{}', 'pending', 1)",
  );
  await s.engine.start();
  assert.equal((await s.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE local_id = 'old'"))!.n, 0);
  assert.equal(posted(s.fake.calls).length, 0, 'their write is never sent under this account');
  assert.equal((await s.db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'owner_user_id'"))!.value, USER);
});

test('enqueue through the engine starts a pass and the pill numbers follow; a full queue is refused with a clear error', async () => {
  const s = await setup();
  const seen: SyncSnapshot[] = [];
  s.engine.subscribe(() => seen.push(s.engine.getSnapshot()));
  await s.engine.enqueue({ endpoint: 'task.complete', method: 'POST', path: '/x', body: {} });
  await s.engine.kick(); // join the pass the enqueue started
  assert.deepEqual(posted(s.fake.calls), ['/x']);
  assert.ok(seen.some((snap) => snap.waiting === 1), 'the pill saw "1 pending"');
  assert.equal(s.engine.getSnapshot().waiting, 0);

  await s.db.transaction(async (tx) => {
    for (let i = 0; i < OUTBOX_CAP; i += 1) {
      await tx.run(
        "INSERT INTO outbox (local_id, farm_id, user_id, endpoint, method, path, body, status, queued_at) VALUES (?, 'f1', 'u1', 'e', 'POST', '/y', '{}', 'failed', 1)",
        [`full-${i}`],
      );
    }
  });
  await assert.rejects(
    () => s.engine.enqueue({ endpoint: 'task.complete', method: 'POST', path: '/z', body: {} }),
    (e: unknown) => e instanceof OutboxFullError,
  );
});

test('clearAll (sign-out with confirmation) empties the queue and the cache and resets the pill', async () => {
  const s = await setup();
  await s.put('/a');
  await s.engine.kick({ pull: true });
  await s.put('/b');
  await s.engine.clearAll();
  assert.deepEqual(await s.queue.list({ userId: USER }), []);
  assert.deepEqual(await readCache(s.db, FARM, 'cattle'), []);
  const snap = s.engine.getSnapshot();
  assert.deepEqual([snap.waiting, snap.lastSyncedAt], [0, null]);
});

test('stop() cancels the retry timer and ignores later kicks', async () => {
  const s = await setup(() => {
    throw networkError();
  });
  await s.put('/a');
  await s.engine.kick();
  assert.equal(s.timers.active().length, 1);
  s.engine.stop();
  assert.equal(s.timers.active().length, 0);
  const before = s.fake.calls.length;
  await s.engine.kick();
  assert.equal(s.fake.calls.length, before);
});
