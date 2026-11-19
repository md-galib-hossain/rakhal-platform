import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate } from '../src/offline/migrations.ts';
import { buildPullSpecs, lastPulledAt, pullEntity, readCache, TASK_WINDOW_DAYS } from '../src/offline/pull.ts';
import { classifyError, sendRow } from '../src/offline/sender.ts';
import type { OutboxRow } from '../src/offline/outbox.ts';
import { createNodeSqliteDb } from './helpers/node-sqlite-db.ts';
import { apiError, createFakeApi, networkError, page } from './helpers/fake-api.ts';

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);
const spec = (entity: string) => buildPullSpecs(NOW).find((s) => s.entity === entity)!;
const cow = (id: string, tag: string, extra: Record<string, unknown> = {}) => ({
  id,
  tagNumber: tag,
  name: `Cow ${tag}`,
  gender: 'FEMALE',
  herdStatus: 'ACTIVE',
  breed: { name: 'Holstein Friesian' },
  deletedAt: null,
  ...extra,
});

async function freshDb() {
  const db = createNodeSqliteDb();
  await migrate(db);
  return db;
}

test('cattle are pulled page by page by cursor and projected to what the screens read', async () => {
  const db = await freshDb();
  const { api, calls } = createFakeApi((c) => {
    if (!c.query?.cursor) return page([cow('c1', 'RKL-001'), cow('c2', 'RKL-002')], 'cur-1');
    if (c.query.cursor === 'cur-1') return page([cow('c3', 'RKL-003')]);
    throw new Error('unexpected cursor');
  });
  assert.equal(await pullEntity(api, db, 'f1', spec('cattle'), NOW), 3);
  assert.deepEqual(calls.map((c) => c.query?.cursor), [undefined, 'cur-1']);
  assert.equal(calls[0]!.query?.limit, 100);
  assert.equal(calls[0]!.query?.includeDeleted, false);

  const rows = await readCache(db, 'f1', 'cattle');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    id: 'c1',
    tagNumber: 'RKL-001',
    name: 'Cow RKL-001',
    gender: 'FEMALE',
    herdStatus: 'ACTIVE',
    shedId: null,
    productionStatus: null,
    healthStatus: null,
    animalCategory: null,
    reproductiveStatus: null,
    dateOfBirth: null,
    breedName: 'Holstein Friesian',
    aqrScore: null,
    lastWeightKg: null,
    shedName: null,
    lactationStage: null,
    nextEvent: null,
    updatedAt: null,
  });
});

test('cattle projection enriches aqrScore, weight, shed, lactation and nextEvent', async () => {
  const db = await freshDb();
  const enrichedCow = cow('c1', 'RKL-001', {
    aqrScore: 82,
    lastWeightKg: 460,
    shed: { name: 'Shed North' },
    lactationStage: 'MID',
    next_event: {
      kind: 'PREGNANCY_CHECK',
      urgency: 'OVERDUE',
      actionable: true,
      daysUntil: -3,
      dueAt: '2026-11-12T00:00:00Z',
      labelKey: 'cattle.upcoming.pregnancyCheck',
      labelParams: { count: 1 },
    },
  });
  const { api } = createFakeApi(() => page([enrichedCow]));
  assert.equal(await pullEntity(api, db, 'f1', spec('cattle'), NOW), 1);
  const rows = await readCache(db, 'f1', 'cattle');
  assert.deepEqual(rows[0], {
    id: 'c1',
    tagNumber: 'RKL-001',
    name: 'Cow RKL-001',
    gender: 'FEMALE',
    herdStatus: 'ACTIVE',
    shedId: null,
    productionStatus: null,
    healthStatus: null,
    animalCategory: null,
    reproductiveStatus: null,
    dateOfBirth: null,
    breedName: 'Holstein Friesian',
    aqrScore: 82,
    lastWeightKg: 460,
    shedName: 'Shed North',
    lactationStage: 'MID',
    nextEvent: {
      kind: 'PREGNANCY_CHECK',
      urgency: 'OVERDUE',
      actionable: true,
      daysUntil: -3,
      dueAt: '2026-11-12T00:00:00Z',
      labelKey: 'cattle.upcoming.pregnancyCheck',
      labelParams: { count: 1 },
    },
    updatedAt: null,
  });
});

test('malformed and soft-deleted rows are skipped, not cached', async () => {
  const db = await freshDb();
  const shed = createFakeApi(() => [{ id: 's1', name: 'Shed A', code: 'A' }, { name: 'no id' }, { id: 's2', deletedAt: '2026-01-01' }, 'junk', null]);
  assert.equal(await pullEntity(shed.api, db, 'f1', spec('sheds'), NOW), 1, 'sheds: no id, archived and non-object rows are skipped');
  const cattle = createFakeApi(() => page([cow('c1', 'RKL-001'), { name: 'no id' }, cow('c2', 'RKL-002', { deletedAt: '2026-01-01' }), 'junk', null]));
  assert.equal(await pullEntity(cattle.api, db, 'f1', spec('cattle'), NOW), 1);
});

test('a pull replaces the farm\'s rows: what the server no longer returns disappears', async () => {
  const db = await freshDb();
  let rows = [cow('c1', 'RKL-001'), cow('c2', 'RKL-002')];
  const { api } = createFakeApi(() => page(rows));
  await pullEntity(api, db, 'f1', spec('cattle'), NOW);
  rows = [cow('c2', 'RKL-002')];
  await pullEntity(api, db, 'f1', spec('cattle'), NOW + 1);
  assert.deepEqual((await readCache(db, 'f1', 'cattle')).map((r) => r.id), ['c2']);
});

test('a failure on a later page keeps the previous cache whole (never a partial wipe)', async () => {
  const db = await freshDb();
  const good = createFakeApi(() => page([cow('c1', 'RKL-001'), cow('c2', 'RKL-002')]));
  await pullEntity(good.api, db, 'f1', spec('cattle'), NOW);

  const bad = createFakeApi((c) => {
    if (!c.query?.cursor) return page([cow('c9', 'RKL-009')], 'next');
    throw networkError();
  });
  await assert.rejects(() => pullEntity(bad.api, db, 'f1', spec('cattle'), NOW + 5));
  assert.deepEqual((await readCache(db, 'f1', 'cattle')).map((r) => r.id), ['c1', 'c2']);

  const garbage = createFakeApi(() => ({ not: 'a list' }));
  await assert.rejects(() => pullEntity(garbage.api, db, 'f1', spec('cattle'), NOW + 6), /Unexpected cattle response/);
  assert.equal((await readCache(db, 'f1', 'cattle')).length, 2);
});

test('the cache is per farm: another farm\'s pull does not touch it', async () => {
  const db = await freshDb();
  await pullEntity(createFakeApi(() => page([cow('c1', 'RKL-001')])).api, db, 'f1', spec('cattle'), NOW);
  await pullEntity(createFakeApi(() => page([cow('x1', 'OTH-001')])).api, db, 'f2', spec('cattle'), NOW);
  assert.deepEqual((await readCache(db, 'f1', 'cattle')).map((r) => r.id), ['c1']);
  assert.deepEqual((await readCache(db, 'f2', 'cattle')).map((r) => r.id), ['x1']);
});

test('local search matches tag number or name, case-insensitively, and treats % and _ literally', async () => {
  const db = await freshDb();
  const rows = [cow('c1', 'RKL-001', { name: 'Lokkhi' }), cow('c2', 'RKL-002', { name: 'Bijoli' }), cow('c3', 'A_1'), cow('c4', 'AB1')];
  await pullEntity(createFakeApi(() => page(rows)).api, db, 'f1', spec('cattle'), NOW);
  assert.deepEqual((await readCache(db, 'f1', 'cattle', { search: 'rkl-002' })).map((r) => r.id), ['c2']);
  assert.deepEqual((await readCache(db, 'f1', 'cattle', { search: 'LOKK' })).map((r) => r.id), ['c1']);
  assert.deepEqual((await readCache(db, 'f1', 'cattle', { search: 'a_1' })).map((r) => r.id), ['c3'], '_ is not a wildcard');
  assert.deepEqual((await readCache(db, 'f1', 'cattle', { search: '%' })).map((r) => r.id), []);
});

test('tag search over a 500-animal herd is far under the 300 ms budget', async () => {
  const db = await freshDb();
  const herd = Array.from({ length: 500 }, (_, i) => cow(`c${i}`, `RKL-${String(i).padStart(3, '0')}`));
  await pullEntity(createFakeApi(() => page(herd)).api, db, 'f1', spec('cattle'), NOW);
  const started = performance.now();
  const hit = await readCache(db, 'f1', 'cattle', { search: 'rkl-437' });
  const ms = performance.now() - started;
  assert.deepEqual(hit.map((r) => r.id), ['c437']);
  assert.ok(ms < 300, `took ${ms.toFixed(1)} ms`);
});

test('tasks are pulled for a window of +-30 days around now', () => {
  const q = spec('tasks').query!;
  assert.equal(q.dueFrom, new Date(NOW - TASK_WINDOW_DAYS * 86_400_000).toISOString());
  assert.equal(q.dueTo, new Date(NOW + TASK_WINDOW_DAYS * 86_400_000).toISOString());
});

test('lastPulledAt is the newest pull for the farm, or null before any', async () => {
  const db = await freshDb();
  assert.equal(await lastPulledAt(db, 'f1'), null);
  await pullEntity(createFakeApi(() => []).api, db, 'f1', spec('sheds'), 100);
  await pullEntity(createFakeApi(() => []).api, db, 'f1', spec('milkTanks'), 250);
  assert.equal(await lastPulledAt(db, 'f1'), 250);
  assert.equal(await lastPulledAt(db, 'f2'), null);
});

// ── sender ───────────────────────────────────────────────────────────────────────────────────────────────────────

const row = (extra: Partial<OutboxRow> = {}): OutboxRow => ({
  seq: 1,
  localId: 'key-123',
  farmId: 'f1',
  userId: 'u1',
  endpoint: 'task.complete',
  method: 'POST',
  path: '/tasks/t1/complete',
  body: { notes: 'x' },
  dependsOn: null,
  status: 'sending',
  queuedAt: 1,
  attempts: 1,
  nextAttemptAt: null,
  lastError: null,
  conflict: null,
  result: null,
  doneAt: null,
  ...extra,
});

test('a queued write is sent with its own id as the Idempotency-Key', async () => {
  const { api, calls } = createFakeApi(() => ({ id: 't1' }));
  const outcome = await sendRow(api, row());
  assert.deepEqual(outcome, { kind: 'done', result: { id: 't1' } });
  assert.equal(calls[0]?.headers?.['Idempotency-Key'], 'key-123');
  assert.deepEqual(calls[0]?.body, { notes: 'x' });
});

test('a milk save the server partly refused is a conflict, with the server version kept for the user', async () => {
  const conflicts = [{ cattleId: 'c1', server: { yieldL: 4 }, yours: { yieldL: 9 } }];
  const { api } = createFakeApi(() => ({ saved: 1, anomaliesFlagged: 0, sessionTotalL: 3, conflicts }));
  const outcome = await sendRow(api, row({ endpoint: 'milk.saveLog', path: '/milk/log' }));
  assert.equal(outcome.kind, 'conflict');
  assert.deepEqual(outcome.kind === 'conflict' && outcome.conflict, conflicts);

  const clean = createFakeApi(() => ({ saved: 2, conflicts: [] }));
  assert.equal((await sendRow(clean.api, row({ endpoint: 'milk.saveLog' }))).kind, 'done');
});

test('a repeat the server answers as already completed is done, not an error', async () => {
  const { api } = createFakeApi(() => ({ id: 't1', alreadyCompleted: true, completedByName: 'Karim' }));
  assert.equal((await sendRow(api, row())).kind, 'done');
});

test('errors are classified: network and 5xx retry, 4xx is final, 401 pauses', () => {
  assert.deepEqual(classifyError(networkError()), { kind: 'retry', reason: 'network', error: 'network' });
  assert.equal(classifyError(apiError(500)).kind, 'retry');
  assert.equal(classifyError(apiError(503)).kind, 'retry');
  assert.deepEqual(classifyError(apiError(429, 'slow down')), { kind: 'retry', reason: 'rate-limit', error: 'slow down' });
  assert.equal(classifyError(apiError(408)).kind, 'retry');
  assert.deepEqual(classifyError(apiError(409, 'busy', 'IDEMPOTENCY_IN_PROGRESS')), { kind: 'retry', reason: 'in-progress', error: 'busy' });
  assert.deepEqual(classifyError(apiError(400, 'Bad entry')), { kind: 'failed', error: 'Bad entry' });
  assert.deepEqual(classifyError(apiError(403, 'No permission')), { kind: 'failed', error: 'No permission' });
  assert.deepEqual(classifyError(apiError(404, 'Gone')), { kind: 'failed', error: 'Gone' });
  assert.deepEqual(classifyError(apiError(409, 'Conflict')), { kind: 'failed', error: 'Conflict' });
  assert.deepEqual(classifyError(apiError(422, 'Key reused', 'IDEMPOTENCY_KEY_REUSED')), { kind: 'failed', error: 'Key reused' });
  assert.equal(classifyError(apiError(401)).kind, 'paused');
  assert.equal(classifyError(new Error('boom')).kind, 'retry', 'an unknown error keeps the write');
});

test('sendRow never throws: a network failure comes back as a retry', async () => {
  const { api } = createFakeApi(() => {
    throw networkError();
  });
  assert.equal((await sendRow(api, row())).kind, 'retry');
});
