import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysIso,
  deriveCategoryPreview,
  expandDate,
  isEmptyHistory,
  isMonthOnly,
  previewItems,
  toHistoryPayload,
  type HistoryValues,
} from '../src/cattle/add-animal-model.ts';

test('isMonthOnly identifies YYYY-MM correctly', () => {
  assert.equal(isMonthOnly('2026-05'), true);
  assert.equal(isMonthOnly('2026-05-12'), false);
  assert.equal(isMonthOnly('invalid'), false);
  assert.equal(isMonthOnly(undefined), false);
  assert.equal(isMonthOnly(null), false);
});

test('expandDate converts month-only dates to the 15th', () => {
  assert.equal(expandDate('2026-03'), '2026-03-15');
  assert.equal(expandDate('2026-03-20'), '2026-03-20');
});

test('addDaysIso computes future and past dates accurately', () => {
  assert.equal(addDaysIso('2026-01-10', 5), '2026-01-15');
  assert.equal(addDaysIso('2026-01-31', 1), '2026-02-01');
  assert.equal(addDaysIso('2026-03-01', -1), '2026-02-28');
});

test('deriveCategoryPreview correctly categorizes cattle by age and gender', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  // Calf (< 1 year old)
  assert.equal(deriveCategoryPreview('FEMALE', '2026-01-01', false, now), 'CALF');
  assert.equal(deriveCategoryPreview('MALE', '2026-01-01', false, now), 'CALF');

  // Heifer (Female, 1 to 2 years, no calvings)
  assert.equal(deriveCategoryPreview('FEMALE', '2024-12-01', false, now), 'HEIFER');

  // Cow (Female, > 2 years or has calved before)
  assert.equal(deriveCategoryPreview('FEMALE', '2023-01-01', false, now), 'COW');
  assert.equal(deriveCategoryPreview('FEMALE', '2025-01-01', true, now), 'COW');

  // Bull (Male, >= 1 year)
  assert.equal(deriveCategoryPreview('MALE', '2024-01-01', false, now), 'BULL');

  // No DOB provided
  assert.equal(deriveCategoryPreview('FEMALE', null, false, now), 'HEIFER');
  assert.equal(deriveCategoryPreview('FEMALE', null, true, now), 'COW');
  assert.equal(deriveCategoryPreview('MALE', null, false, now), 'BULL');
});

test('previewItems generates the expected setup preview', () => {
  const today = '2026-06-01';

  // Empty history
  assert.deepEqual(previewItems({}, 'FEMALE', today), []);

  // Female with calving and milking
  const femaleValues: HistoryValues = {
    calvedBefore: 'yes',
    lastCalvingDate: '2026-02',
    calvingNumber: 2,
    milkingNow: 'yes',
    milkingSince: '2026-02-15',
    lastVaccinationDate: '2026-04-10',
  };
  const items = previewItems(femaleValues, 'FEMALE', today);
  assert.equal(items.length, 3);
  assert.equal(items[0]?.kind, 'calving');
  assert.equal(items[0]?.date, '2026-02-15');
  assert.equal(items[1]?.kind, 'milking');
  assert.equal(items[1]?.date, '2026-02-15');
  assert.equal(items[2]?.kind, 'vaccination');
  assert.equal(items[2]?.date, '2026-04-10');

  // Pregnant cow
  const pregnantValues: HistoryValues = {
    pregnant: 'yes',
    monthsPregnant: 5,
  };
  const pregItems = previewItems(pregnantValues, 'FEMALE', today);
  assert.ok(pregItems.some((i) => i.kind === 'pregnant'));

  // Male ignores female fields
  const maleItems = previewItems(femaleValues, 'MALE', today);
  assert.equal(maleItems.length, 1);
  assert.equal(maleItems[0]?.kind, 'vaccination');
});

test('toHistoryPayload creates well-formed payload for API', () => {
  const today = '2026-06-01';

  // Empty
  assert.equal(toHistoryPayload({}, 'FEMALE', today), undefined);
  assert.equal(isEmptyHistory({}, 'FEMALE'), true);

  // Female full history
  const values: HistoryValues = {
    calvedBefore: 'yes',
    lastCalvingDate: '2025-10-10',
    calvingNumber: 1,
    milkingNow: 'no',
    drySince: '2026-03-01',
    pregnant: 'yes',
    expectedCalvingDate: '2026-11-20',
    lastBreedingDate: '2026-02-14',
    breedingMethod: 'AI',
    bull: 'BULL-889',
    lastVaccinationDate: '2026-04-01',
    vaccineProduct: 'FMD Vaccine',
  };

  const payload = toHistoryPayload(values, 'FEMALE', today);
  assert.ok(payload);
  assert.equal(payload.length, 5);

  assert.deepEqual(payload[0], {
    kind: 'LAST_CALVING',
    date: '2025-10-10',
    calvingNumber: 1,
  });

  assert.deepEqual(payload[1], {
    kind: 'LAST_BREEDING',
    date: '2026-02-14',
    method: 'AI',
    bull: 'BULL-889',
  });

  assert.deepEqual(payload[2], {
    kind: 'PREGNANT',
    expectedCalvingDate: '2026-11-20',
  });

  assert.deepEqual(payload[3], {
    kind: 'DRY_SINCE',
    date: '2026-03-01',
  });

  assert.deepEqual(payload[4], {
    kind: 'LAST_VACCINATION',
    date: '2026-04-01',
    product: 'FMD Vaccine',
  });
});
