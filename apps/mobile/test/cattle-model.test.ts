import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageFrom, fromCacheItem, parseProfile, withOverview } from '../src/cattle/cattle-detail-model.ts';
import {
  ageInMonths,
  cattleTitle,
  computeCategoryCounts,
  computeCattleHighlights,
  formatNextEventDue,
  formatNextEventTitle,
  healthBadge,
  humanize,
  isStale,
  lactationBadge,
  matchesCategoryChip,
  primaryBadge,
  productionBadge,
  reproBadge,
  countActiveFilters,
  matchesCattleFilters,
  toCattleItem,
  toCattleItems,
  STALE_AFTER_MS,
} from '../src/cattle/cattle-model.ts';
import { bn, en, type MessageKey } from '../src/i18n/messages.ts';

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

test('toCattleItem parses enriched metrics (aqrScore, lastWeightKg, shedName, lactationStage, nextEvent)', () => {
  const item = toCattleItem({
    id: 'c1',
    tagNumber: 'T-100',
    name: 'Padma',
    gender: 'FEMALE',
    aqrScore: 78,
    lastWeightKg: 430,
    shedName: 'Shed 1',
    lactationStage: 'EARLY',
    nextEvent: {
      kind: 'CALVING',
      urgency: 'OVERDUE',
      actionable: true,
      daysUntil: -2,
      dueAt: '2026-11-13T00:00:00Z',
      labelKey: 'cattle.upcoming.calving',
    },
  });
  assert.ok(item);
  assert.equal(item.aqrScore, 78);
  assert.equal(item.lastWeightKg, 430);
  assert.equal(item.shedName, 'Shed 1');
  assert.equal(item.lactationStage, 'EARLY');
  assert.deepEqual(item.nextEvent, {
    kind: 'CALVING',
    title: null,
    urgency: 'OVERDUE',
    actionable: true,
    daysUntil: -2,
    dueAt: '2026-11-13T00:00:00Z',
    labelKey: 'cattle.upcoming.calving',
    labelParams: null,
  });
});

test('toCattleItem parses nextEvent with title and upcomingEventCount', () => {
  const item = toCattleItem({
    id: 'c2',
    tagNumber: 'T-200',
    upcoming_event_count: 3,
    next_event: {
      kind: 'TASK',
      title: 'Missing milk-log session',
      urgency: 'OVERDUE',
      daysUntil: -12,
    },
  });
  assert.ok(item?.nextEvent);
  assert.equal(item.nextEvent.title, 'Missing milk-log session');
  assert.equal(item.nextEvent.upcomingEventCount, 3);
  assert.equal(item.nextEvent.daysUntil, -12);
});

test('formatNextEventTitle prefers title, otherwise falls back to translated kind', () => {
  const mockT = (key: MessageKey) => `[${key}]`;
  assert.equal(
    formatNextEventTitle({ kind: 'TASK', title: 'Review reported sickness', urgency: 'OVERDUE', daysUntil: -1, dueAt: null, labelKey: null }, mockT),
    'Review reported sickness',
  );
  assert.equal(
    formatNextEventTitle({ kind: 'PREVENTIVE_STEP', title: null, urgency: 'DUE_SOON', daysUntil: 3, dueAt: null, labelKey: null }, mockT),
    '[cattle.upcoming.preventiveStep]',
  );
  assert.equal(
    formatNextEventTitle({ kind: 'SOME_UNKNOWN_KIND', title: '', urgency: null, daysUntil: null, dueAt: null, labelKey: null }, mockT),
    'Some unknown kind',
  );
});

test('formatNextEventDue formats overdue, today, tomorrow, and future days', () => {
  const mockT = (key: MessageKey, params?: Record<string, string | number>) => `${key}:${params ? JSON.stringify(params) : ''}`;
  const numFmt = (n: number) => String(n);

  const overdue = formatNextEventDue(-12, mockT, numFmt);
  assert.deepEqual(overdue, {
    text: 'cattle.upcoming.overdueDays:{"count":"12"}',
    urgency: 'destructive',
  });

  const today = formatNextEventDue(0, mockT, numFmt);
  assert.deepEqual(today, {
    text: 'cattle.upcoming.today:',
    urgency: 'warning',
  });

  const tomorrow = formatNextEventDue(1, mockT, numFmt);
  assert.deepEqual(tomorrow, {
    text: 'cattle.upcoming.tomorrow:',
    urgency: 'warning',
  });

  const inDays = formatNextEventDue(5, mockT, numFmt);
  assert.deepEqual(inDays, {
    text: 'cattle.upcoming.inDays:{"count":"5"}',
    urgency: 'info',
  });
});

test('computeCattleHighlights calculates active count, average AQR, breeding ready and milking cows', () => {
  const items = [
    toCattleItem({ id: 'c1', tagNumber: '1', gender: 'FEMALE', herdStatus: 'ACTIVE', aqrScore: 80, reproductiveStatus: 'OPEN', productionStatus: 'MILKING' })!,
    toCattleItem({ id: 'c2', tagNumber: '2', gender: 'FEMALE', herdStatus: 'ACTIVE', aqrScore: 60, reproductiveStatus: 'PREGNANT', productionStatus: 'MILKING' })!,
    toCattleItem({ id: 'c3', tagNumber: '3', gender: 'MALE', herdStatus: 'SOLD', aqrScore: 50, reproductiveStatus: 'NOT_ELIGIBLE', productionStatus: 'DRY' })!,
  ];
  const hl = computeCattleHighlights(items);
  assert.equal(hl.totalActive, 2);
  assert.equal(hl.avgHerdAqr, 63.3);
  assert.equal(hl.breedingReadyCount, 1);
  assert.equal(hl.milkingCount, 2);
});

test('category chips and counts filter correctly', () => {
  const items = [
    toCattleItem({ id: 'c1', tagNumber: '1', gender: 'FEMALE', animalCategory: 'COW', productionStatus: 'MILKING', reproductiveStatus: 'OPEN', healthStatus: 'HEALTHY' })!,
    toCattleItem({ id: 'c2', tagNumber: '2', gender: 'FEMALE', animalCategory: 'HEIFER', productionStatus: 'DRY', reproductiveStatus: 'PREGNANT', healthStatus: 'SICK' })!,
    toCattleItem({ id: 'c3', tagNumber: '3', gender: 'MALE', animalCategory: 'CALF', productionStatus: null, reproductiveStatus: null, healthStatus: 'HEALTHY' })!,
  ];
  const counts = computeCategoryCounts(items);
  assert.equal(counts.ALL, 3);
  assert.equal(counts.COW, 1);
  assert.equal(counts.HEIFER, 1);
  assert.equal(counts.CALF, 1);
  assert.equal(counts.MALE, 1);
  assert.equal(counts.FEMALE, 2);
  assert.equal(counts.MILKING, 1);
  assert.equal(counts.DRY, 1);
  assert.equal(counts.PREGNANT, 1);
  assert.equal(counts.OPEN, 1);
  assert.equal(counts.SICK, 1);

  assert.equal(matchesCategoryChip(items[0], 'COW'), true);
  assert.equal(matchesCategoryChip(items[0], 'HEIFER'), false);
  assert.equal(matchesCategoryChip(items[1], 'SICK'), true);
});

test('lactationBadge maps stages to tones/herdStates and labels', () => {
  assert.equal(lactationBadge('FRESH')?.labelKey, 'cattle.lactation.fresh');
  assert.equal(lactationBadge('MID')?.labelKey, 'cattle.lactation.mid');
  assert.equal(lactationBadge('UNKNOWN')?.raw, 'UNKNOWN');
  assert.equal(lactationBadge(null), null);
});

test('matchesCattleFilters filters by production, lactation, reproduction, health, category and group', () => {
  const cow1 = toCattleItem({
    id: 'c1',
    tagNumber: 'TAG-1',
    animalCategory: 'COW',
    productionStatus: 'MILKING',
    lactationStage: 'FRESH',
    reproductiveStatus: 'OPEN',
    healthStatus: 'HEALTHY',
    groupIds: ['g1', 'g2'],
  })!;

  const cow2 = toCattleItem({
    id: 'c2',
    tagNumber: 'TAG-2',
    animalCategory: 'HEIFER',
    productionStatus: 'DRY',
    lactationStage: 'DRY_PERIOD',
    reproductiveStatus: 'PREGNANT',
    healthStatus: 'SICK',
    groupIds: ['g2'],
  })!;

  assert.equal(matchesCattleFilters(cow1, { animalCategory: 'COW' }), true);
  assert.equal(matchesCattleFilters(cow2, { animalCategory: 'COW' }), false);

  assert.equal(matchesCattleFilters(cow1, { productionStatus: 'MILKING' }), true);
  assert.equal(matchesCattleFilters(cow2, { productionStatus: 'MILKING' }), false);

  assert.equal(matchesCattleFilters(cow1, { lactationStage: 'FRESH' }), true);
  assert.equal(matchesCattleFilters(cow2, { lactationStage: 'FRESH' }), false);

  assert.equal(matchesCattleFilters(cow1, { reproductiveStatus: 'OPEN' }), true);
  assert.equal(matchesCattleFilters(cow2, { reproductiveStatus: 'OPEN' }), false);

  assert.equal(matchesCattleFilters(cow1, { healthStatus: 'HEALTHY' }), true);
  assert.equal(matchesCattleFilters(cow2, { healthStatus: 'HEALTHY' }), false);

  assert.equal(matchesCattleFilters(cow1, { animalGroupId: 'g1' }), true);
  assert.equal(matchesCattleFilters(cow2, { animalGroupId: 'g1' }), false);
  assert.equal(matchesCattleFilters(cow2, { animalGroupId: 'g2' }), true);

  assert.equal(countActiveFilters({}), 0);
  assert.equal(countActiveFilters({ productionStatus: 'MILKING', animalGroupId: 'g1' }), 2);
});
