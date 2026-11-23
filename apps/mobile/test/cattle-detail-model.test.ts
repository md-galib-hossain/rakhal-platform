import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhaseBar,
  calvingsShown,
  milkFigures,
  overviewCards,
  parseFeedRequirement,
  parseFinance,
  parseHealthSummary,
  parseOverview,
  parsePedigree,
  parseReproductionSummary,
  parseTimelineEvents,
  parseUpcomingEvents,
  weightTrend,
} from '../src/cattle/cattle-detail-model.ts';

test('parseOverview parses milk records, weight history, and bcs', () => {
  const raw = {
    aqr_score: 85,
    avg_daily_yield_7d: 14.2,
    last_weight_kg: 420,
    recent_milk_records: [
      { date: '2026-11-20', morning_l: 7, noon_l: 0, evening_l: 7, night_l: 0, total_l: 14 },
      { date: '2026-11-21', morning_l: 8, noon_l: 0, evening_l: 7, night_l: 0, total_l: 15 },
    ],
    weight_history: [
      { date: '2026-10-15', weight_kg: 410 },
      { date: '2026-11-15', weight_kg: 420 },
    ],
    bcs_records: [{ date: '2026-11-10', score: 3.5 }],
  };

  const parsed = parseOverview(raw);
  assert.ok(parsed);
  assert.equal(parsed.aqr_score, 85);
  assert.equal(parsed.avg_daily_yield_7d, 14.2);
  assert.equal(parsed.last_weight_kg, 420);
  assert.equal(parsed.recent_milk_records.length, 2);
  assert.equal(parsed.weight_history.length, 2);
  assert.equal(parsed.bcs_records.length, 1);
});

test('parseOverview normalizes ISO timestamp dates to YYYY-MM-DD', () => {
  const raw = {
    recent_milk_records: [
      { date: '2026-11-23T08:30:00.000Z', morning_l: 10, total_l: 10 },
    ],
    weight_history: [
      { date: '2026-11-20T12:00:00.000Z', weight_kg: 450 },
    ],
    bcs_records: [
      { date: '2026-11-15T00:00:00.000Z', score: 3.25 },
    ],
  };
  const parsed = parseOverview(raw);
  assert.ok(parsed);
  assert.equal(parsed.recent_milk_records[0]?.date, '2026-11-23');
  assert.equal(parsed.weight_history[0]?.date, '2026-11-20');
  assert.equal(parsed.bcs_records[0]?.date, '2026-11-15');
});

test('parseReproductionSummary parses female repro metrics', () => {
  const raw = {
    status: 'PREGNANT',
    currentLactation: 2,
    dim: 120,
    totalCalvings: 2,
    totalPregnancies: 2,
    totalAbortions: 0,
    conceptionRate: 80,
    expectedCalvingDate: '2027-04-10',
    daysPregnant: 95,
    lastBreeding: '2026-08-15',
    daysOpen: 60,
  };

  const parsed = parseReproductionSummary(raw);
  assert.ok(parsed);
  assert.equal(parsed.status, 'PREGNANT');
  assert.equal(parsed.currentLactation, 2);
  assert.equal(parsed.dim, 120);
  assert.equal(parsed.daysPregnant, 95);
  assert.equal(parsed.daysOpen, 60);
});

test('parseHealthSummary parses active cases and withdrawal alerts', () => {
  const raw = {
    activeCases: [
      {
        id: 'hc-1',
        caseCode: 'HC-001',
        note: 'Fever treated',
        condition: 'FEVER',
        careType: 'CURATIVE',
        priority: 'HIGH',
        status: 'OPEN',
        startDate: '2026-11-20',
        currentStep: 2,
        totalSteps: 3,
      },
    ],
    ongoingTreatment: true,
    activeWithdrawals: [
      {
        id: 'w-1',
        milkWithdrawalUntil: '2026-11-28',
        meatWithdrawalUntil: null,
      },
    ],
    safetyWithdrawalWarning: true,
  };

  const parsed = parseHealthSummary(raw, '2026-11-22');
  assert.ok(parsed);
  assert.equal(parsed.activeCases.length, 1);
  assert.equal(parsed.activeCases[0]?.condition, 'FEVER');
  assert.equal(parsed.activeWithdrawals.length, 1);
  assert.equal(parsed.activeWithdrawals[0]?.kind, 'milk');
  assert.equal(parsed.activeWithdrawals[0]?.daysLeft, 6);
});

test('parsePedigree parses self, dam, sire, siblings and offspring', () => {
  const raw = {
    self: { id: 'c1', name: 'Lokkhi', tag: 'GALIB_DAIRY_1-001' },
    dam: { id: 'dam-1', name: 'Shundori', tag: 'GALIB_DAIRY_1-002' },
    sire: { id: 'sire-1', name: 'Bahadur', tag: 'SIRE-999', is_external: true },
    siblings: [{ id: 'sib-1', name: 'Tara', tag: 'GALIB_DAIRY_1-003' }],
    offspring: [
      { id: 'calf-1', name: 'Bachur 1', tag: 'GALIB_DAIRY_1-010', gender: 'FEMALE', birth_date: '2026-03-01' },
    ],
  };

  const parsed = parsePedigree(raw);
  assert.ok(parsed);
  assert.equal(parsed.dam?.name, 'Shundori');
  assert.equal(parsed.sire?.is_external, true);
  assert.equal(parsed.siblings.length, 1);
  assert.equal(parsed.offspring.length, 1);
  assert.equal(parsed.offspring[0]?.tag, 'GALIB_DAIRY_1-010');
});

test('parseFinance parses profit, breakdown and chart points', () => {
  const raw = {
    period: '2026-11',
    total_income: 18500,
    total_cost: 11200,
    net_profit: 7300,
    expense_breakdown: { feed: 8000, health: 2000, breeding: 1200, others: 0 },
    income_breakdown: { milk_sales: 18500, calf_sales: 0 },
    monthly_chart: [
      { month: '2026-10', income: 17000, cost: 10500 },
      { month: '2026-11', income: 18500, cost: 11200 },
    ],
  };

  const parsed = parseFinance(raw);
  assert.ok(parsed);
  assert.equal(parsed.period, '2026-11');
  assert.equal(parsed.total_income, 18500);
  assert.equal(parsed.net_profit, 7300);
  assert.equal(parsed.expense_breakdown.feed, 8000);
  assert.equal(parsed.monthly_chart.length, 2);
});

test('parseFeedRequirement parses energy and protein tables', () => {
  const raw = {
    requirements: {
      dm_kg: 14.5,
      cp_kg: 2.1,
      me_mj: 145,
      ne_mcal: 22.5,
      energy_density_mj_per_kg_dm: 10,
      cp_pct_of_dm: 14.5,
      rdp_pct: 65,
      rup_pct: 35,
    },
  };

  const parsed = parseFeedRequirement(raw);
  assert.ok(parsed);
  assert.equal(parsed.dm_kg, 14.5);
  assert.equal(parsed.cp_kg, 2.1);
  assert.equal(parsed.me_mj, 145);
  assert.equal(parsed.rdp_pct, 65);
});

test('parseTimelineEvents maps event groups correctly', () => {
  const raw = [
    { id: 'ev-1', type: 'HEAT', eventAt: '2026-11-01', notes: 'Standing heat' },
    { id: 'ev-2', type: 'VACCINATION', eventAt: '2026-11-05', notes: 'FMD vaccine' },
    { id: 'ev-3', type: 'WEIGHT', eventAt: '2026-11-10', notes: 'Regular weighing' },
    { id: 'ev-4', type: 'MOVE', eventAt: '2026-11-12', notes: 'Moved to Shed A' },
  ];

  const parsed = parseTimelineEvents(raw);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0]?.group, 'REPRODUCTION');
  assert.equal(parsed[1]?.group, 'HEALTH');
  assert.equal(parsed[2]?.group, 'GROWTH');
  assert.equal(parsed[3]?.group, 'MOVEMENT');
});

test('buildPhaseBar creates pipeline markers for a bred/pregnant cow', () => {
  const bar = buildPhaseBar({
    today: '2026-11-22',
    dim: 120,
    lastBreeding: '2026-09-01',
    expectedCalvingDate: '2027-06-10',
    pregnant: true,
  });

  assert.ok(bar);
  assert.ok(bar.markers.length >= 4);
  const keys = bar.markers.map((m) => m.key);
  assert.ok(keys.includes('calved'));
  assert.ok(keys.includes('vwp'));
  assert.ok(keys.includes('bred'));
  assert.ok(keys.includes('check'));
  assert.ok(keys.includes('due'));
});

test('milkFigures computes today, 7d average and week total', () => {
  const records = [
    { date: '2026-11-16', total_l: 12 },
    { date: '2026-11-17', total_l: 13 },
    { date: '2026-11-18', total_l: 14 },
    { date: '2026-11-19', total_l: 13 },
    { date: '2026-11-20', total_l: 15 },
    { date: '2026-11-21', total_l: 14 },
    { date: '2026-11-22', total_l: 16 },
  ];

  const fig = milkFigures(records, '2026-11-22');
  assert.equal(fig.today, 16);
  assert.equal(fig.weekTotal, 97);
  assert.equal(fig.hasData, true);
  assert.equal(fig.series.length, 7);
  assert.deepEqual(fig.series, [12, 13, 14, 13, 15, 14, 16]);
});

test('milkFigures handles full ISO timestamps matching today and calculates week metrics', () => {
  const records = [
    { date: '2026-11-20T00:00:00.000Z', total_l: 10 },
    { date: '2026-11-22T00:00:00.000Z', total_l: 12 },
    { date: '2026-11-23T08:30:00.000Z', total_l: 15 },
  ];

  const fig = milkFigures(records, '2026-11-23');
  assert.equal(fig.today, 15);
  assert.equal(fig.weekTotal, 37);
  assert.equal(fig.hasData, true);
  assert.equal(fig.series.length, 7);
  // Last 7 days: Nov 17..Nov 23
  // Nov 17: 0, Nov 18: 0, Nov 19: 0, Nov 20: 10, Nov 21: 0, Nov 22: 12, Nov 23: 15
  assert.deepEqual(fig.series, [0, 0, 0, 10, 0, 12, 15]);
});

test('milkFigures handles single-day entry for today with 6 leading zeros', () => {
  const records = [{ date: '2026-11-23', total_l: 14.5 }];
  const fig = milkFigures(records, '2026-11-23');
  assert.equal(fig.today, 14.5);
  assert.equal(fig.weekTotal, 14.5);
  assert.equal(fig.hasData, true);
  assert.equal(fig.series.length, 7);
  assert.deepEqual(fig.series, [0, 0, 0, 0, 0, 0, 14.5]);
});

test('milkFigures handles zero records with 7 zeros and null today', () => {
  const fig = milkFigures([], '2026-11-23');
  assert.equal(fig.today, null);
  assert.equal(fig.weekTotal, 0);
  assert.equal(fig.hasData, false);
  assert.equal(fig.series.length, 7);
  assert.deepEqual(fig.series, [0, 0, 0, 0, 0, 0, 0]);
});

test('weightTrend calculates 30-day delta and overview cards applicability', () => {
  const history = [
    { date: '2026-10-20', weight_kg: 400 },
    { date: '2026-11-20', weight_kg: 412 },
  ];
  const trend = weightTrend(history, '2026-11-22');
  assert.equal(trend.delta30, 12);

  const cowCards = overviewCards({ gender: 'FEMALE', animalCategory: 'COW', productionStatus: 'MILKING' });
  assert.equal(cowCards.reproduction, true);
  assert.equal(cowCards.milk, true);

  const bullCards = overviewCards({ gender: 'MALE', animalCategory: 'BULL', productionStatus: null });
  assert.equal(bullCards.reproduction, false);
  assert.equal(bullCards.milk, false);
});

test('parseUpcomingEvents parses task lists and calvingsShown works', () => {
  const raw = {
    events: [
      { id: 'up-1', kind: 'VACCINATION', title: 'FMD Dose 2', urgency: 'HIGH', actionable: true, daysUntil: 3 },
    ],
  };
  const parsed = parseUpcomingEvents(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.title, 'FMD Dose 2');
  assert.equal(calvingsShown(null, 100), 1);
  assert.equal(calvingsShown(3, null), 3);
});
