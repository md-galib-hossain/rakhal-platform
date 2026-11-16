import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageFrom, fromCacheItem, parseProfile, withOverview } from '../src/cattle/cattle-detail-model.ts';
import {
  ageInMonths,
  cattleTitle,
  healthBadge,
  humanize,
  isStale,
  primaryBadge,
  productionBadge,
  reproBadge,
  toCattleItem,
  toCattleItems,
  STALE_AFTER_MS,
} from '../src/cattle/cattle-model.ts';
import { bn, en } from '../src/i18n/messages.ts';

const NOW = Date.parse('2026-11-15T12:00:00Z');

test('toCattleItem keeps the projected fields and drops rows without an id', () => {
  const item = toCattleItem({ id: 'c1', tagNumber: 'T-1', name: ' ', herdStatus: 'ACTIVE', breedName: 'Sahiwal', extra: 1 });
  assert.equal(item?.id, 'c1');
  assert.equal(item?.name, null, 'blank name is null');
  assert.equal(item?.breedName, 'Sahiwal');
  assert.equal(toCattleItem({ tagNumber: 'x' }), null);
  assert.equal(toCattleItems([{ id: 'a' }, { nope: true }, { id: 'b' }]).length, 2);
});

test('title shows tag then name; either alone', () => {
  assert.equal(cattleTitle({ tagNumber: 'T-1', name: 'Rupa' }), 'T-1 · Rupa');
  assert.equal(cattleTitle({ tagNumber: 'T-1', name: null }), 'T-1');
  assert.equal(cattleTitle({ tagNumber: '', name: 'Rupa' }), 'Rupa');
});

test('primary badge: left the herd beats sick beats milking beats pregnant beats healthy', () => {
  const base = { herdStatus: 'ACTIVE', healthStatus: 'HEALTHY', productionStatus: null, reproductiveStatus: null };
  assert.equal(primaryBadge({ ...base, herdStatus: 'SOLD', healthStatus: 'SICK' }).labelKey, 'cattle.status.sold');
  assert.equal(primaryBadge({ ...base, healthStatus: 'SICK', productionStatus: 'MILKING' }).labelKey, 'cattle.status.sick');
  assert.equal(
    primaryBadge({ ...base, productionStatus: 'MILKING', reproductiveStatus: 'PREGNANT' }).labelKey,
    'cattle.status.milking',
  );
  assert.equal(primaryBadge({ ...base, productionStatus: 'DRY' }).labelKey, 'cattle.status.dry');
  assert.equal(primaryBadge({ ...base, reproductiveStatus: 'PREGNANT' }).labelKey, 'cattle.status.pregnant');
  assert.equal(primaryBadge(base).labelKey, 'cattle.status.healthy');
});

test('an unknown server status is shown as text, not hidden', () => {
  const badge = primaryBadge({ herdStatus: 'QUARANTINED_X', healthStatus: null, productionStatus: null, reproductiveStatus: null });
  assert.equal(badge.labelKey, null);
  assert.equal(badge.raw, 'QUARANTINED_X');
  assert.equal(humanize('IN_TREATMENT_NOW'), 'In treatment now');
  assert.equal(productionBadge('ODD')?.raw, 'ODD');
  assert.equal(healthBadge(null), null);
  assert.equal(reproBadge('OPEN')?.labelKey, 'cattle.repro.open');
});

test('every badge has a word and a mark (tone or herd state), so colour is never the only signal', () => {
  const badges = [
    primaryBadge({ herdStatus: 'ACTIVE', healthStatus: 'SICK', productionStatus: null, reproductiveStatus: null }),
    productionBadge('MILKING'),
    healthBadge('HEALTHY'),
    reproBadge('PREGNANT'),
  ];
  for (const badge of badges) {
    assert.ok(badge?.labelKey, 'has a label key');
    assert.ok('herdState' in badge || 'tone' in badge, 'has a tone or herd state');
  }
});

test('cattle strings exist in both languages and the count line has no plural noun', () => {
  for (const key of Object.keys(en).filter((k) => k.startsWith('cattle.'))) {
    assert.ok(key in bn, `${key} in bn`);
  }
  assert.equal(en['cattle.count'], 'Animals: {count}');
});

test('age in months counts whole months and rejects future or missing dates', () => {
  assert.equal(ageInMonths('2024-11-15T00:00:00Z', NOW), 24);
  assert.equal(ageInMonths('2024-11-16T00:00:00Z', NOW), 23);
  assert.equal(ageInMonths('2030-01-01T00:00:00Z', NOW), null);
  assert.equal(ageInMonths(null, NOW), null);
  assert.equal(ageInMonths('garbage', NOW), null);
  assert.deepEqual(ageFrom('2022-09-01T00:00:00Z', NOW), { years: 4, months: 2 });
});

test('stale after 24 h without a sync, and when never synced', () => {
  assert.equal(isStale(null, NOW), true);
  assert.equal(isStale(NOW - STALE_AFTER_MS + 1000, NOW), false);
  assert.equal(isStale(NOW - STALE_AFTER_MS - 1000, NOW), true);
});

test('parseProfile reads the real profile shape; overview adds milk, weight and score', () => {
  const profile = {
    id: 'c1',
    tagNumber: 'RKL-1',
    name: null,
    gender: 'FEMALE',
    dateOfBirth: '2022-10-07T16:00:00.748Z',
    herdStatus: 'ACTIVE',
    productionStatus: 'MILKING',
    healthStatus: 'HEALTHY',
    animalCategory: 'COW',
    breed: { id: 'b1', name: 'Sahiwal' },
    shed: { id: 's1', name: 'Shed A' },
    mother: { id: 'm1', tagNumber: 'RKL-0', name: 'Old' },
    father: null,
    reproductionProfile: { reproductiveStatus: 'PREGNANT' },
    age: { years: 4, months: 1 },
    childrenCount: 2,
    lastWeightKg: 410,
    aqrScore: 12,
    updatedAt: '2026-11-15T16:00:00.748Z',
  };
  const detail = parseProfile(profile, NOW);
  assert.equal(detail?.breedName, 'Sahiwal');
  assert.equal(detail?.shedName, 'Shed A');
  assert.equal(detail?.motherLabel, 'RKL-0 · Old');
  assert.equal(detail?.fatherLabel, null);
  assert.equal(detail?.reproductiveStatus, 'PREGNANT');
  assert.deepEqual(detail?.age, { years: 4, months: 1 });
  assert.equal(detail?.avgDailyYield7d, null);
  const merged = withOverview(detail!, { avg_daily_yield_7d: 14.5, last_weight_kg: 420, aqr_score: 20 });
  assert.equal(merged.avgDailyYield7d, 14.5);
  assert.equal(merged.lastWeightKg, 420);
  assert.equal(merged.aqrScore, 20);
});

test('odd payloads never throw: no id is null, a bad overview changes nothing', () => {
  assert.equal(parseProfile(null, NOW), null);
  assert.equal(parseProfile({ tagNumber: 'x' }, NOW), null);
  const detail = parseProfile({ id: 'c1', age: 'old', breed: 7, mother: 'x', childrenCount: 'many' }, NOW)!;
  assert.equal(detail.breedName, null);
  assert.equal(detail.motherLabel, null);
  assert.equal(detail.childrenCount, null);
  assert.equal(withOverview(detail, 'nope'), detail);
  assert.equal(withOverview(detail, { avg_daily_yield_7d: 'x' }).avgDailyYield7d, null);
});

test('the offline fallback keeps what the cache knows and leaves the rest null', () => {
  const item = toCattleItem({ id: 'c1', tagNumber: 'T-1', dateOfBirth: '2024-11-15T00:00:00Z', productionStatus: 'DRY' })!;
  const detail = fromCacheItem(item, NOW);
  assert.equal(detail.tagNumber, 'T-1');
  assert.deepEqual(detail.age, { years: 2, months: 0 });
  assert.equal(detail.shedName, null);
  assert.equal(detail.avgDailyYield7d, null);
});
