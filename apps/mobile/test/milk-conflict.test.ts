import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate } from '../src/offline/migrations.ts';
import { createOutbox } from '../src/offline/outbox.ts';
import { createSyncEngine } from '../src/offline/sync-engine.ts';
import { createFakeApi, fixedIds } from './helpers/fake-api.ts';
import { createNodeSqliteDb } from './helpers/node-sqlite-db.ts';

const USER = 'u1';
const FARM = 'f1';

async function setupOutbox() {
  const db = createNodeSqliteDb();
  await migrate(db);
  const outbox = createOutbox(db, {
    newId: fixedIds('test-k'),
    now: () => 1_000,
  });
  return { db, outbox };
}

test('resolveUseMine creates a new outbox row with new key and server baseUpdatedAt, marks old row resolved, and repoints dependent rows', async () => {
  const { outbox } = await setupOutbox();

  const originalBody = {
    date: '2026-11-16',
    session: 'MORNING',
    entries: [
      { cattleId: 'c1', yieldL: 5, baseUpdatedAt: '2026-11-16T05:00:00.000Z' },
      { cattleId: 'c2', yieldL: 8, baseUpdatedAt: null },
    ],
  };

  const save = await outbox.enqueue({
    farmId: FARM,
    userId: USER,
    endpoint: 'milk.saveLog',
    method: 'POST',
    path: '/milk/log',
    body: originalBody,
  });

  const submit = await outbox.enqueue({
    farmId: FARM,
    userId: USER,
    endpoint: 'milk.submit',
    method: 'POST',
    path: '/milk/submit',
    body: { date: '2026-11-16', session: 'MORNING' },
    dependsOn: save.localId,
  });

  // Mark conflict on c1: server has yieldL 6 and updatedAt 2026-11-16T05:30:00.000Z
  await outbox.beginSending(save.localId);
  const serverConflict = [
    {
      cattleId: 'c1',
      server: {
        yieldL: 6,
        updatedAt: '2026-11-16T05:30:00.000Z',
        updatedBy: 'u2',
        updatedByName: 'Manager',
      },
      yours: { yieldL: 5 },
    },
  ];
  await outbox.markConflict(save.localId, serverConflict, { saved: 1, conflicts: serverConflict });

  const conflictedSave = await outbox.get(save.localId);
  assert.equal(conflictedSave?.status, 'conflict');

  // Resolve with "Use mine"
  const newRow = await outbox.resolveUseMine(save.localId, 'new-use-mine-key');
  assert.ok(newRow);
  assert.equal(newRow.localId, 'new-use-mine-key');
  assert.equal(newRow.status, 'pending');

  const newBody = newRow.body as typeof originalBody;
  assert.equal(newBody.entries[0]?.cattleId, 'c1');
  assert.equal(newBody.entries[0]?.baseUpdatedAt, '2026-11-16T05:30:00.000Z', 'updated baseUpdatedAt to server version');
  assert.equal(newBody.entries[1]?.cattleId, 'c2');
  assert.equal(newBody.entries[1]?.baseUpdatedAt, null);

  // Old row is marked done with resolved 'used-mine'
  const oldRow = await outbox.get(save.localId);
  assert.equal(oldRow?.status, 'done');
  assert.deepEqual(oldRow?.result, { resolved: 'used-mine', replacedBy: 'new-use-mine-key' });

  // Submit row now depends on the new local ID
  const updatedSubmit = await outbox.get(submit.localId);
  assert.equal(updatedSubmit?.dependsOn, 'new-use-mine-key');
});

test('syncEngine useMine resolves the conflict and triggers kick', async () => {
  const db = createNodeSqliteDb();
  await migrate(db);
  const fake = createFakeApi(() => ({ saved: 1, conflicts: [] }));
  const engine = createSyncEngine({
    db,
    api: fake.api,
    session: { userId: USER, farmId: FARM },
    probe: async () => true,
    networkHint: () => true,
    newId: fixedIds('eng-k'),
    now: () => 1_000,
    random: () => 0.5,
  });

  const save = await engine.enqueue({
    endpoint: 'milk.saveLog',
    method: 'POST',
    path: '/milk/log',
    body: {
      date: '2026-11-16',
      session: 'MORNING',
      entries: [{ cattleId: 'c1', yieldL: 5, baseUpdatedAt: '2026-11-16T05:00:00.000Z' }],
    },
  });

  const outbox = createOutbox(db, { newId: fixedIds('k'), now: () => 1000 });
  await outbox.beginSending(save.localId);
  await outbox.markConflict(
    save.localId,
    [{ cattleId: 'c1', server: { updatedAt: '2026-11-16T06:00:00.000Z' } }],
    { saved: 0 },
  );

  const resolved = await engine.useMine(save.localId);
  assert.ok(resolved);
  assert.equal(resolved.status, 'pending');
  const body = resolved.body as { entries: Array<{ baseUpdatedAt: string }> };
  assert.equal(body.entries[0]?.baseUpdatedAt, '2026-11-16T06:00:00.000Z');
});
