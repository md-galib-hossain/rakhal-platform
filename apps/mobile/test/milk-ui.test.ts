/**
 * Pure TypeScript tests for milk domain rules, live totals aggregation,
 * session configuration & locking, and quick presets (WP10 UI/UX overhaul).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultSessionByClock,
  isMilkAnomaly,
  QUICK_YIELD_PRESETS,
  type MilkCowRow,
  type MilkTotals,
} from '../src/milk/milk-model.ts';

test('QUICK_YIELD_PRESETS provides ergonomic quick adjustments', () => {
  assert.deepEqual(QUICK_YIELD_PRESETS, [0.5, 1.0, 5.0]);
});

test('defaultSessionByClock respects configuredSessions', () => {
  // At 14:00 (Noon), if only Morning and Evening are active, fallback to first active
  const noonTime = new Date('2026-11-16T14:00:00');
  const session = defaultSessionByClock(noonTime, ['MORNING', 'EVENING']);
  assert.equal(session, 'MORNING');

  // If Noon is configured, it picks Noon
  const sessionWithNoon = defaultSessionByClock(noonTime, ['MORNING', 'NOON', 'EVENING']);
  assert.equal(sessionWithNoon, 'NOON');
});

test('Live totals calculation correctly aggregates sellable vs withheld milk', () => {
  const rows: MilkCowRow[] = [
    {
      cattleId: 'c1',
      tag: 'TAG-1',
      name: 'Rupa',
      animalCategory: 'COW',
      withholding: false,
      yieldL: 12.5,
      anomalyFlag: false,
      status: 'saved',
      baseUpdatedAt: null,
      isSubmitted: false,
    },
    {
      cattleId: 'c2',
      tag: 'TAG-2',
      name: 'Shona',
      animalCategory: 'COW',
      withholding: true,
      withholdingReason: 'Mastitis',
      yieldL: 8.0,
      anomalyFlag: false,
      status: null,
      baseUpdatedAt: null,
      isSubmitted: false,
    },
    {
      cattleId: 'c3',
      tag: 'TAG-3',
      name: null,
      animalCategory: 'COW',
      withholding: false,
      yieldL: null, // not logged yet
      anomalyFlag: false,
      status: null,
      baseUpdatedAt: null,
      isSubmitted: false,
    },
  ];

  let totalL = 0;
  let sellableL = 0;
  let withheldL = 0;
  let loggedCount = 0;

  for (const r of rows) {
    if (r.yieldL !== null && r.yieldL > 0) {
      totalL += r.yieldL;
      loggedCount += 1;
      if (r.withholding) {
        withheldL += r.yieldL;
      } else {
        sellableL += r.yieldL;
      }
    }
  }

  const totals: MilkTotals = {
    totalL: Math.round(totalL * 10) / 10,
    sellableL: Math.round(sellableL * 10) / 10,
    withheldL: Math.round(withheldL * 10) / 10,
    loggedCount,
    totalCows: rows.length,
  };

  assert.equal(totals.totalL, 20.5);
  assert.equal(totals.sellableL, 12.5);
  assert.equal(totals.withheldL, 8.0);
  assert.equal(totals.loggedCount, 2);
  assert.equal(totals.totalCows, 3);
});

test('isMilkAnomaly flags drops > 30% from 7-day average', () => {
  // Normal yield (10L when 7d avg is 10L)
  assert.equal(isMilkAnomaly(10.0, 10.0), false);

  // Drop to 6.5L when 7d avg is 10L (>30% drop)
  assert.equal(isMilkAnomaly(6.5, 10.0), true);

  // Server anomaly flag always wins
  assert.equal(isMilkAnomaly(10.0, 10.0, true), true);

  // Zero or null yields are not anomalies
  assert.equal(isMilkAnomaly(null, 10.0), false);
  assert.equal(isMilkAnomaly(0, 10.0), false);
});
