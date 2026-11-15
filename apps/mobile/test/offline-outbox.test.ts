import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { migrate } from '../src/offline/migrations.ts';
import {
  createOutbox,
  DEPENDS_ON_FAILED,
  DONE_RETENTION_MS,
  OUTBOX_CAP,
  OutboxFullError,
  type EnqueueInput,
} from '../src/offline/outbox.ts';
import { createNodeSqliteDb } from './helpers/node-sqlite-db.ts';
import { fixedIds } from './helpers/fake-api.ts';

const scope = { userId: 'u1', farmId: 'f1' };
const item = (extra: Partial<EnqueueInput> = {}): EnqueueInput => ({
  ...scope,
  endpoint: 'task.complete',
  method: 'POST',
  path: '/tasks/t1/complete',
  body: { notes: 'done' },
  ...extra,
});

async function setup(file?: string) {
  const db = createNodeSqliteDb(file);
  await migrate(db);
  let t = 1_000;
  const clock = { now: () => t, set: (v: number) => (t = v) };
  const outbox = createOutbox(db, { newId: fixedIds('k'), now: clock.now });
  return { db, outbox, clock };
}
const next = (outbox: Awaited<ReturnType<typeof setup>>['outbox'], now: number) => outbox.nextForSending({ ...scope, now });

test('enqueue stores the write exactly as it will be sent, with its idempotency key', async () => {
  const { outbox } = await setup();
  const row = await outbox.enqueue(item());
  assert.equal(row.localId, 'k-1');
  assert.equal(row.status, 'pending');
  assert.deepEqual(row.body, { notes: 'done' });
  assert.equal(row.attempts, 0);
  assert.equal(row.endpoint, 'task.complete');
});

test('the queue survives a kill and a reboot: reopening the file finds every row in its state', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rakhal-outbox-'));
  const file = join(dir, 'q.db');
  try {
    const first = await setup(file);
    await first.outbox.enqueue(item());
    await first.outbox.enqueue(item({ path: '/tasks/t2/complete' }));
    await first.outbox.beginSending('k-1'); // the app dies while this one is in flight
    first.db.close();

    const second = await setup(file); // migrate() on an already-migrated file is a no-op
    const rows = await second.outbox.list({ userId: 'u1' });
    assert.deepEqual(rows.map((r) => [r.localId, r.status]), [['k-1', 'sending'], ['k-2', 'pending']]);
    assert.equal(await second.outbox.recoverInterrupted(), 1);
    const again = await second.outbox.list({ userId: 'u1' });
    assert.deepEqual(again.map((r) => r.status), ['pending', 'pending']);
    assert.equal(again[0]!.localId, 'k-1', 'same row, same key: the server answers a replay');
    second.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rows come out in the order they were queued, one at a time', async () => {
  const { outbox } = await setup();
  await outbox.enqueue(item({ path: '/a' }));
  await outbox.enqueue(item({ path: '/b' }));
  await outbox.enqueue(item({ path: '/c' }));
  const first = await next(outbox, 2_000);
  assert.equal(first.row?.path, '/a');
  await outbox.beginSending('k-1');
  await outbox.complete('k-1', { ok: true });
  assert.equal((await next(outbox, 2_000)).row?.path, '/b');
});

test('a row waiting out its backoff holds everything behind it, so order is kept', async () => {
  const { outbox } = await setup();
  await outbox.enqueue(item({ path: '/a' }));
  await outbox.enqueue(item({ path: '/b' }));
  await outbox.beginSending('k-1');
  await outbox.retryLater('k-1', 'network', 9_000);
  const blocked = await next(outbox, 5_000);
  assert.deepEqual(blocked, { row: null, waitMs: 4_000 });
  assert.equal((await next(outbox, 9_000)).row?.path, '/a');
});

test('a failed row is kept, shown, and does not block independent rows', async () => {
  const { outbox } = await setup();
  await outbox.enqueue(item({ path: '/a' }));
  await outbox.enqueue(item({ path: '/b' }));
  await outbox.beginSending('k-1');
  await outbox.fail('k-1', 'Cattle is not in the herd');
  const failed = await outbox.get('k-1');
  assert.equal(failed?.status, 'failed');
  assert.equal(failed?.lastError, 'Cattle is not in the herd');
  assert.equal((await next(outbox, 2_000)).row?.path, '/b');
  assert.deepEqual(await outbox.counts({ userId: 'u1' }), { waiting: 1, failed: 1, conflict: 0 });
});

test('a submit waits for its save, goes after it, and fails with it', async () => {
  const { outbox } = await setup();
  const save = await outbox.enqueue(item({ endpoint: 'milk.saveLog', path: '/milk/log' }));
  await outbox.enqueue(item({ endpoint: 'milk.submit', path: '/milk/submit', dependsOn: save.localId }));
  await outbox.enqueue(item({ path: '/other' }));

  assert.equal((await next(outbox, 2_000)).row?.path, '/milk/log');
  await outbox.beginSending(save.localId);
  await outbox.complete(save.localId, {});
  assert.equal((await next(outbox, 2_000)).row?.path, '/milk/submit');

  // Same shape, but the save fails: the submit fails with it, the unrelated row is still sent.
  const save2 = await outbox.enqueue(item({ endpoint: 'milk.saveLog', path: '/milk/log2' }));
  const submit2 = await outbox.enqueue(item({ endpoint: 'milk.submit', path: '/milk/submit2', dependsOn: save2.localId }));
  await outbox.beginSending('k-2');
  await outbox.complete('k-2', {});
  await outbox.beginSending('k-3');
  await outbox.complete('k-3', {});
  await outbox.beginSending(save2.localId);
  await outbox.fail(save2.localId, 'bad');
  const dependent = await outbox.get(submit2.localId);
  assert.equal(dependent?.status, 'failed');
  assert.equal(dependent?.lastError, DEPENDS_ON_FAILED);
});

test('a conflicted save holds its submit for the user, while unrelated rows still go; keeping the server version releases it', async () => {
  const { outbox } = await setup();
  const save = await outbox.enqueue(item({ endpoint: 'milk.saveLog', path: '/milk/log' }));
  await outbox.enqueue(item({ endpoint: 'milk.submit', path: '/milk/submit', dependsOn: save.localId }));
  await outbox.enqueue(item({ path: '/other' }));
  await outbox.beginSending(save.localId);
  await outbox.markConflict(save.localId, [{ cattleId: 'c1' }], { saved: 0 });

  assert.equal((await next(outbox, 2_000)).row?.path, '/other', 'the submit is skipped, not failed');
  assert.equal((await outbox.get('k-2'))?.status, 'pending');

  await outbox.beginSending('k-3');
  await outbox.complete('k-3', {});
  assert.deepEqual(await next(outbox, 2_000), { row: null, waitMs: null }, 'only the held submit is left');

  assert.equal(await outbox.resolveConflict(save.localId, 'kept-server'), true);
  assert.equal((await next(outbox, 2_000)).row?.path, '/milk/submit');
});

test('retry brings a failed row and the rows that failed because of it back to pending', async () => {
  const { outbox } = await setup();
  const save = await outbox.enqueue(item({ path: '/a' }));
  await outbox.enqueue(item({ path: '/b', dependsOn: save.localId }));
  await outbox.beginSending(save.localId);
  await outbox.fail(save.localId, 'bad');
  assert.equal((await outbox.get('k-2'))?.status, 'failed');

  assert.equal(await outbox.retryNow(save.localId), true);
  const rows = await outbox.list({ userId: 'u1' });
  assert.deepEqual(rows.map((r) => [r.status, r.attempts, r.lastError]), [['pending', 0, null], ['pending', 0, null]]);
  assert.equal(await outbox.retryNow(save.localId), false, 'only failed rows can be retried');
});

test('discard removes a row but never one being sent; a row left waiting on it then fails', async () => {
  const { outbox } = await setup();
  const a = await outbox.enqueue(item({ path: '/a' }));
  const b = await outbox.enqueue(item({ path: '/b', dependsOn: a.localId }));
  await outbox.beginSending(a.localId);
  assert.equal(await outbox.discard(a.localId), false, 'in flight');
  await outbox.retryLater(a.localId, 'network', null);
  assert.equal(await outbox.discard(a.localId), true);
  assert.equal(await outbox.get(a.localId), null);
  assert.deepEqual(await next(outbox, 2_000), { row: null, waitMs: null });
  assert.equal((await outbox.get(b.localId))?.lastError, DEPENDS_ON_FAILED);
});

test('rows of another user or farm are never offered for sending', async () => {
  const { outbox } = await setup();
  await outbox.enqueue(item({ userId: 'u2', path: '/theirs' }));
  await outbox.enqueue(item({ farmId: 'f2', path: '/other-farm' }));
  await outbox.enqueue(item({ path: '/mine' }));
  assert.equal((await next(outbox, 2_000)).row?.path, '/mine');
  assert.deepEqual(await outbox.counts({ userId: 'u2' }), { waiting: 1, failed: 0, conflict: 0 });
});

test('the queue is capped, with a clear error, and done rows do not count', async () => {
  const { db, outbox } = await setup();
  await db.transaction(async (tx) => {
    for (let i = 0; i < OUTBOX_CAP; i += 1) {
      await tx.run(
        "INSERT INTO outbox (local_id, farm_id, user_id, endpoint, method, path, body, status, queued_at) VALUES (?, 'f1', 'u1', 'e', 'POST', '/x', '{}', 'pending', 1)",
        [`bulk-${i}`],
      );
    }
  });
  await assert.rejects(() => outbox.enqueue(item()), (e: unknown) => e instanceof OutboxFullError && e.cap === OUTBOX_CAP);
  await db.run("UPDATE outbox SET status = 'done', done_at = 1 WHERE local_id = 'bulk-0'");
  await outbox.enqueue(item());
});

test('finished rows are kept for 7 days and then purged; unfinished rows never are', async () => {
  const { outbox, clock } = await setup();
  await outbox.enqueue(item({ path: '/a' }));
  await outbox.enqueue(item({ path: '/b' }));
  await outbox.beginSending('k-1');
  await outbox.complete('k-1', {});
  clock.set(1_000 + DONE_RETENTION_MS - 1);
  assert.equal(await outbox.purgeDone(), 0);
  clock.set(1_000 + DONE_RETENTION_MS + 1);
  assert.equal(await outbox.purgeDone(), 1);
  assert.deepEqual((await outbox.list({ userId: 'u1' })).map((r) => r.localId), ['k-2']);
});
