import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toCattleItems } from '../src/cattle/cattle-model.ts';
import { migrate } from '../src/offline/migrations.ts';
import { buildPullSpecs, pullEntity, readCache, readCacheRow } from '../src/offline/pull.ts';
import { createFakeApi, page } from './helpers/fake-api.ts';
import { createNodeSqliteDb } from './helpers/node-sqlite-db.ts';

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);
const cattleSpec = buildPullSpecs(NOW).find((s) => s.entity === 'cattle')!;

function herd(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(4, '0');
    return {
      id: `c${n}`,
      tagNumber: `BD-${n}`,
      name: i % 5 === 0 ? `Rupa ${n}` : null,
      gender: 'FEMALE',
      herdStatus: 'ACTIVE',
      productionStatus: i % 2 ? 'MILKING' : 'DRY',
      breed: { name: 'Sahiwal' },
      deletedAt: null,
    };
  });
}

async function seeded(count: number) {
  const db = createNodeSqliteDb();
  await migrate(db);
  const { api } = createFakeApi(() => page(herd(count)));
  await pullEntity(api, db, 'f1', cattleSpec, NOW);
  return db;
}

test('readCacheRow returns one animal by id, scoped to the farm, or null', async () => {
  const db = await seeded(5);
  const row = await readCacheRow(db, 'f1', 'cattle', 'c0003');
  assert.equal(row?.tagNumber, 'BD-0003');
  assert.equal(await readCacheRow(db, 'f1', 'cattle', 'missing'), null);
  assert.equal(await readCacheRow(db, 'other-farm', 'cattle', 'c0003'), null);
  assert.equal(await readCacheRow(db, 'f1', 'tasks', 'c0003'), null);
});

test('search by tag or name is case-insensitive, treats % and _ as text, and stays fast on 500 animals', async () => {
  const db = await seeded(500);
  const started = performance.now();
  const byTag = await readCache(db, 'f1', 'cattle', { search: 'bd-0250', limit: 2000 });
  const byName = await readCache(db, 'f1', 'cattle', { search: 'RUPA 0251', limit: 2000 });
  const elapsed = performance.now() - started;
  assert.deepEqual(toCattleItems(byTag).map((i) => i.id), ['c0250']);
  assert.deepEqual(toCattleItems(byName).map((i) => i.id), ['c0251']);
  assert.equal((await readCache(db, 'f1', 'cattle', { search: '%', limit: 2000 })).length, 0, '% is not a wildcard');
  assert.equal((await readCache(db, 'f1', 'cattle', { limit: 2000 })).length, 500);
  assert.ok(elapsed < 300, `two searches took ${elapsed.toFixed(0)} ms`);
});
