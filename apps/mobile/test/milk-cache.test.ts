import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate } from '../src/offline/migrations.ts';
import {
  buildPullSpecs,
  pullEntity,
  readCache,
  readCacheRow,
  readSessionConfig,
} from '../src/offline/pull.ts';
import { createFakeApi } from './helpers/fake-api.ts';
import { createNodeSqliteDb } from './helpers/node-sqlite-db.ts';

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
const milkLogSpec = buildPullSpecs(NOW).find((s) => s.entity === 'milkLog')!;

function milkGrid(count: number) {
  return {
    date: '2026-11-16',
    sessionConfig: {
      activeSessions: ['MORNING', 'EVENING'],
    },
    entries: Array.from({ length: count }, (_, i) => {
      const n = String(i + 1).padStart(4, '0');
      return {
        cattleId: `c${n}`,
        tag: `BD-${n}`,
        name: i % 5 === 0 ? `Rupa ${n}` : null,
        shed: 'Shed 1',
        avgYield7d: 12.5,
        prevDayYieldL: 11.0,
        productionStatus: 'milking',
        withholding: i % 10 === 0,
        log: {
          morningL: 6.0,
          noonL: null,
          eveningL: 5.5,
          nightL: null,
          totalL: 11.5,
          tank: 'SELLABLE',
          tankLocked: false,
          tankId: null,
          anomalyFlag: false,
          submittedSessions: ['MORNING'],
          dispositions: { MORNING: 'SALEABLE' },
          updatedAt: { MORNING: '2026-11-16T06:00:00.000Z' },
        },
      };
    }),
  };
}

test('milkLog pull caches the day grid entries and session config', async () => {
  const db = createNodeSqliteDb();
  await migrate(db);
  const data = milkGrid(5);
  const { api } = createFakeApi(() => data);

  const pulled = await pullEntity(api, db, 'f1', milkLogSpec, NOW);
  assert.equal(pulled, 5);

  const row = await readCacheRow(db, 'f1', 'milkLog', 'c0003');
  assert.equal(row?.cattleId, 'c0003');
  assert.equal(row?.tag, 'BD-0003');
  assert.equal(row?.withholding, false);
  const log = row?.log as Record<string, unknown>;
  assert.equal(log?.morningL, 6.0);
  assert.deepEqual(log?.updatedAt, { MORNING: '2026-11-16T06:00:00.000Z' });

  const config = await readSessionConfig(db, 'f1');
  assert.deepEqual(config?.activeSessions, ['MORNING', 'EVENING']);
});

test('milkLog local search filters by tag or cow name', async () => {
  const db = createNodeSqliteDb();
  await migrate(db);
  const data = milkGrid(20);
  const { api } = createFakeApi(() => data);
  await pullEntity(api, db, 'f1', milkLogSpec, NOW);

  const byTag = await readCache(db, 'f1', 'milkLog', { search: 'bd-0005' });
  assert.equal(byTag.length, 1);
  assert.equal(byTag[0]?.cattleId, 'c0005');

  const byName = await readCache(db, 'f1', 'milkLog', { search: 'rupa' });
  assert.equal(byName.length, 4); // 0001 (idx 0), 0006 (idx 5), 0011 (idx 10), 0016 (idx 15)
});
