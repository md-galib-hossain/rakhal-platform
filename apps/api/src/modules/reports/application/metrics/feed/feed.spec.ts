import type { DomainMetricOutput, MetricContext } from '../metric-context';
import {
  computePeriodFigures,
  findLowStock,
  persistentlyOffTarget,
  type RawFeedData,
} from './feed-aggregation';
import { assertNoFinance } from '../../../domain/contracts/snapshot';
import { feedMetricModule } from './index';

const emptyRaw = (over: Partial<RawFeedData> = {}): RawFeedData => ({
  distributions: [],
  cattleItems: [],
  fitDays: [],
  fedMovementKgs: [],
  milk: { rows: 0, litres: 0 },
  ledgerNet: null,
  ledgerAccountExists: true,
  ...over,
});

const row = (
  cattleId: string,
  dayKey: string,
  offeredKg: number,
  refusalKg: number,
  costTk: number | null,
) => ({ cattleId, dayKey, offeredKg, refusalKg, costTk });

describe('feed aggregation', () => {
  it('null costTk is unknown, never summed as zero', () => {
    const f = computePeriodFigures(
      emptyRaw({
        cattleItems: [
          row('a', '2026-10-01', 10, 1, 100),
          row('b', '2026-10-01', 10, 0, null),
        ],
      }),
    );
    expect(f.distributionCost.state).toBe('missing');
    expect(f.distributionCostKnownOnly).toEqual({
      state: 'value',
      value: 100,
      unit: 'BDT',
    });
    expect(f.costCoveragePct).toEqual({ state: 'value', value: 50, unit: '%' });
    expect(f.unknownCostRows).toBe(1);
    expect(f.costPerCowDay.state).toBe('not_calculated');
  });

  it('computes cost per cow-day and offered minus refusal when complete', () => {
    const f = computePeriodFigures(
      emptyRaw({
        cattleItems: [
          row('a', '2026-10-01', 10, 1, 90),
          row('a', '2026-10-02', 10, 0, 110),
        ],
      }),
    );
    expect(f.distributionCost).toEqual({
      state: 'value',
      value: 200,
      unit: 'BDT',
    });
    expect(f.costPerCowDay).toEqual({
      state: 'value',
      value: 100,
      unit: 'BDT/cow-day',
    });
    expect(f.offeredMinusRefusalKg).toEqual({
      state: 'value',
      value: 19,
      unit: 'kg',
    });
    expect(f.byCow).toEqual([{ key: 'a', label: null, kg: 19 }]);
  });

  it('cost per litre needs real litres', () => {
    const items = [row('a', '2026-10-01', 10, 0, 100)];
    expect(
      computePeriodFigures(emptyRaw({ cattleItems: items })).costPerLitre.state,
    ).toBe('not_calculated');
    expect(
      computePeriodFigures(
        emptyRaw({ cattleItems: items, milk: { rows: 3, litres: 0 } }),
      ).costPerLitre.state,
    ).toBe('not_calculated');
    expect(
      computePeriodFigures(
        emptyRaw({ cattleItems: items, milk: { rows: 3, litres: 50 } }),
      ).costPerLitre,
    ).toEqual({ state: 'value', value: 2, unit: 'BDT/L' });
  });

  it('empty scope: everything missing, nothing zero', () => {
    const f = computePeriodFigures(emptyRaw());
    for (const v of [
      f.actualKg,
      f.refusalKg,
      f.offeredMinusRefusalKg,
      f.distributionCost,
      f.fitOffTargetSharePct,
      f.tmrFedKg,
    ]) {
      expect(v.state).toBe('missing');
    }
    expect(f.ledgerFeedSpend).toBeNull();
  });

  it('recorded actual comes from distribution totals only; items by ingredient', () => {
    const f = computePeriodFigures(
      emptyRaw({
        distributions: [
          {
            totalActualKg: 30,
            totalRefusalKg: 2,
            items: [
              { ingredientId: 'i1', ingredientName: 'Maize', actualKg: 30 },
            ],
          },
        ],
      }),
    );
    expect(f.actualKg).toEqual({ state: 'value', value: 30, unit: 'kg' });
    expect(f.byItem).toEqual([{ key: 'i1', label: 'Maize', kg: 30 }]);
  });

  it('fit: estimated rows excluded from the share but counted', () => {
    const f = computePeriodFigures(
      emptyRaw({
        fitDays: [
          {
            cattleId: 'a',
            date: '2026-10-01',
            severity: 'OK',
            estimated: false,
          },
          {
            cattleId: 'a',
            date: '2026-10-02',
            severity: 'BAD',
            estimated: false,
          },
          {
            cattleId: 'b',
            date: '2026-10-02',
            severity: 'BAD',
            estimated: true,
          },
        ],
      }),
    );
    expect(f.fitOffTargetSharePct).toEqual({
      state: 'value',
      value: 50,
      unit: '%',
    });
    expect(f.fitEstimatedCowDays).toEqual({
      state: 'value',
      value: 1,
      unit: 'cow-days',
    });
  });

  it('low stock uses summed live lots, threshold>0, <=', () => {
    const r = findLowStock([
      { id: 'a', name: 'A', unit: 'kg', threshold: 10, batchStocks: [4, 6] },
      { id: 'b', name: 'B', unit: 'kg', threshold: 10, batchStocks: [20] },
      { id: 'c', name: 'C', unit: 'kg', threshold: 0, batchStocks: [0] },
    ]);
    expect(r.map((x) => x.id)).toEqual(['a']);
  });

  it('persistent off-target only when the constant is set', () => {
    const days = [
      {
        cattleId: 'a',
        date: '2026-10-01',
        severity: 'BAD' as const,
        estimated: false,
      },
      {
        cattleId: 'a',
        date: '2026-10-02',
        severity: 'WARN' as const,
        estimated: false,
      },
    ];
    expect(persistentlyOffTarget(days, null)).toEqual([]);
    expect(persistentlyOffTarget(days, 2)).toEqual(['a']);
    expect(persistentlyOffTarget(days, 3)).toEqual([]);
  });
});

const period = (startDate: string, endDate: string, end: string) => ({
  start: `${startDate}T00:00:00.000Z`,
  end,
  startDate,
  endDate,
  timezone: 'UTC',
  label: 'x',
});

function makeDb(opts: { costTk?: number | null; noLedger?: boolean } = {}) {
  const journalAggregate = jest
    .fn()
    .mockResolvedValue({ _sum: { debit: 500, credit: 0 } });
  const db = {
    feedDistribution: {
      findMany: jest.fn().mockResolvedValue([
        {
          totalActualKg: 20,
          totalRefusalKg: 1,
          items: [{ ingredientId: 'i', ingredientName: 'Hay', actualKg: 20 }],
        },
      ]),
    },
    feedDistributionCattleItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          cattleId: 'c1',
          offeredKg: 10,
          refusalKg: 1,
          costTk: opts.costTk === undefined ? 100 : opts.costTk,
          distribution: { distributedAt: new Date('2026-10-01T05:00:00Z') },
        },
      ]),
    },
    feedPlanFitDay: { findMany: jest.fn().mockResolvedValue([]) },
    feedStockMovement: {
      findMany: jest.fn().mockResolvedValue([{ changeKg: -5 }]),
    },
    milkLogEntry: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _count: { _all: 2 }, _sum: { yieldL: 50 } }),
    },
    feedItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'f1',
          name: 'Silage',
          lowStockThreshold: 10,
          unit: { symbol: 'kg' },
          batches: [{ currentStock: 3 }],
        },
      ]),
    },
    journalEntry: { aggregate: journalAggregate },
    ledgerAccount: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opts.noLedger ? null : { id: 'la' }),
    },
  };
  return { db, journalAggregate };
}

const ctxOf = (db: unknown, over: Partial<MetricContext> = {}): MetricContext =>
  ({
    db,
    farmId: 'farm',
    timezone: 'UTC',
    period: period('2026-10-01', '2026-10-07', '2026-10-08T00:00:00.000Z'),
    previousPeriod: null,
    cattleIds: ['c1'],
    previousCattleIds: ['c1'],
    scopeKind: 'ALL_ELIGIBLE',
    generatedAt: new Date('2026-10-08T01:00:00Z'),
    thresholds: {
      suddenDropPct: 30,
      repeatedCaseWindowDays: 60,
      finalizationMaxWaitHours: 24,
    },
    includeFinance: false,
    ...over,
  }) as MetricContext;

const sec = (o: DomainMetricOutput) => {
  if (!o.section) throw new Error('section expected');
  return o.section;
};

describe('feedMetricModule', () => {
  it('every output carries a source; per-cow is offeredMinusRefusal, never consumed/intake', async () => {
    const { db } = makeDb();
    const out = await feedMetricModule.compute(
      ctxOf(db, { includeFinance: true }),
    );
    for (const m of sec(out).metrics) {
      expect(m.source).toBeTruthy();
      expect(m.source).not.toMatch(/consumed|intake/i);
    }
    expect(sec(out).metrics.some((m) => m.metricId.includes(':'))).toBe(false);
    const omr = sec(out).metrics.find(
      (m) => m.metricId === 'feed.offered_minus_refusal_kg',
    );
    expect(omr?.source).toBe('offeredMinusRefusal');
    expect(omr?.rows).toEqual([
      {
        key: 'c1',
        label: null,
        value: { state: 'value', value: 9, unit: 'kg' },
        source: 'offeredMinusRefusal',
      },
    ]);
    expect(
      sec(out).metrics.find((m) => m.metricId === 'feed.recorded_actual_kg')
        ?.rows,
    ).toEqual([
      {
        key: 'i',
        label: 'Hay',
        value: { state: 'value', value: 20, unit: 'kg' },
        source: 'recordedActual',
      },
    ]);
    expect(out.dataQuality.notes).toContain('reports.dq.feed_farm_wide_totals');
    expect(
      sec(out).metrics.find((m) => m.metricId === 'feed.recorded_actual_kg')
        ?.source,
    ).toBe('recordedActual');
    const cost = sec(out).metrics.find(
      (m) => m.metricId === 'feed.distribution_cost',
    );
    expect(cost?.source).toBe('distributionCost');
    expect(cost?.requiresPermission).toBe('finance.read');
  });

  it('excludes voided rows in the query', async () => {
    const { db } = makeDb();
    await feedMetricModule.compute(ctxOf(db));
    type Call = [
      { where: { voidedAt: null; distribution?: { voidedAt: null } } },
    ];
    const cow = db.feedDistributionCattleItem.findMany.mock
      .calls[0] as unknown as Call;
    const dist = db.feedDistribution.findMany.mock.calls[0] as unknown as Call;
    expect(cow[0].where.voidedAt).toBeNull();
    expect(cow[0].where.distribution?.voidedAt).toBeNull();
    expect(dist[0].where.voidedAt).toBeNull();
  });

  it('ledger metric absent and ledger not queried when finance excluded', async () => {
    const { db, journalAggregate } = makeDb();
    const out = await feedMetricModule.compute(ctxOf(db));
    expect(journalAggregate).not.toHaveBeenCalled();
    expect(
      sec(out).metrics.some((m) => m.metricId === 'feed.ledger_feed_spend'),
    ).toBe(false);
    expect(
      sec(out).metrics.some((m) => m.requiresPermission === 'finance.read'),
    ).toBe(false);
  });

  it('ledger metric present, gated and separately sourced when finance included', async () => {
    const { db, journalAggregate } = makeDb();
    const out = await feedMetricModule.compute(
      ctxOf(db, { includeFinance: true }),
    );
    expect(journalAggregate).toHaveBeenCalledTimes(1);
    const l = sec(out).metrics.find(
      (m) => m.metricId === 'feed.ledger_feed_spend',
    );
    expect(l?.source).toBe('ledgerFeed5000');
    expect(l?.requiresPermission).toBe('finance.read');
    expect(l?.value).toEqual({ state: 'value', value: 500, unit: 'BDT' });
  });

  it('null cost row => unknown flag, cost missing', async () => {
    const { db } = makeDb({ costTk: null });
    const out = await feedMetricModule.compute(
      ctxOf(db, { includeFinance: true }),
    );
    expect(out.dataQuality.flags.hasUnknownCosts).toBe(true);
    expect(out.dataQuality.notes).toContain('reports.dq.unknown_costs');
    expect(
      sec(out).metrics.find((m) => m.metricId === 'feed.distribution_cost')
        ?.value.state,
    ).toBe('missing');
  });

  it('low stock listed as of generation with exception; previous-period comparison', async () => {
    const { db } = makeDb();
    const out = await feedMetricModule.compute(
      ctxOf(db, {
        previousPeriod: period(
          '2026-09-24',
          '2026-09-30',
          '2026-10-01T00:00:00.000Z',
        ),
      }),
    );
    expect(out.exceptions.map((e) => e.code)).toContain('feed.low_stock_items');
    const low = sec(out).metrics.find(
      (m) => m.metricId === 'feed.low_stock_items',
    );
    expect(low?.source).toBe('asOfGeneration');
    expect(low?.rows).toEqual([
      {
        key: 'f1',
        label: 'Silage',
        value: { state: 'value', value: 3, unit: 'kg' },
        source: 'asOfGeneration',
      },
    ]);
    const actual = sec(out).metrics.find(
      (m) => m.metricId === 'feed.recorded_actual_kg',
    );
    expect(actual?.comparison?.absoluteChange).toBe(0);
    expect(actual?.comparison?.percentChange).toBe(0);
  });

  it('empty scope: no cow rows, previous zero gives null percent change', async () => {
    const { db } = makeDb();
    db.feedDistributionCattleItem.findMany.mockResolvedValue([]);
    const out = await feedMetricModule.compute(
      ctxOf(db, {
        cattleIds: [],
        previousCattleIds: [],
        includeFinance: true,
      }),
    );

    expect(out.dataQuality.notes).toContain('reports.dq.scope_empty');
    expect(out.dataQuality.notes).not.toContain(
      'reports.dq.feed_farm_wide_totals',
    );
    expect(
      sec(out).metrics.find((m) => m.metricId === 'feed.distribution_cost')
        ?.value.state,
    ).toBe('missing');
  });

  it('finance off: no cost/ledger metric, no BDT, no cost column or milk read, assertNoFinance passes', async () => {
    const { db } = makeDb({ costTk: null });
    const out = await feedMetricModule.compute(ctxOf(db));
    const metrics = sec(out).metrics;
    expect(metrics.some((m) => /cost|ledger/.test(m.metricId))).toBe(false);
    expect(JSON.stringify(out)).not.toContain('BDT');
    expect(out.dataQuality.flags.hasUnknownCosts).toBe(false);
    expect(out.dataQuality.notes).not.toContain('reports.dq.unknown_costs');
    type Sel = [{ select: Record<string, unknown> }];
    const sel = db.feedDistributionCattleItem.findMany.mock
      .calls[0] as unknown as Sel;
    expect(sel[0].select).not.toHaveProperty('costTk');
    expect(db.milkLogEntry.aggregate).not.toHaveBeenCalled();
    expect(db.ledgerAccount.findFirst).not.toHaveBeenCalled();
    assertNoFinance({
      schemaVersion: 1,
      calcVersion: 1,
      templateVersion: 1,
      farm: { id: 'farm', name: 'F', timezone: 'UTC' },
      period: period('2026-10-01', '2026-10-07', '2026-10-08T00:00:00.000Z'),
      scope: {} as never,
      generatedAt: '2026-10-08T01:00:00.000Z',
      includesFinance: false,
      sections: [sec(out)],
      exceptions: out.exceptions,
      dataQuality: out.dataQuality,
    });
  });

  it('all 5 cost metrics are finance.read gated', () => {
    const ids = [
      'feed.distribution_cost',
      'feed.distribution_cost_known_only',
      'feed.distribution_cost_coverage',
      'feed.cost_per_cow_day',
      'feed.cost_per_litre',
    ];
    for (const id of ids) {
      expect(
        feedMetricModule.definitions.find((d) => d.id === id)
          ?.requiresPermission,
      ).toBe('finance.read');
    }
  });

  it('missing ledger account 5000 => missing, not 0', async () => {
    const { db, journalAggregate } = makeDb({ noLedger: true });
    const out = await feedMetricModule.compute(
      ctxOf(db, { includeFinance: true }),
    );
    const l = sec(out).metrics.find(
      (m) => m.metricId === 'feed.ledger_feed_spend',
    );
    expect(l?.value.state).toBe('missing');
    expect(journalAggregate).not.toHaveBeenCalled();
  });

  it('farm-wide totals are not_applicable unless scope is ALL_ELIGIBLE', async () => {
    for (const scopeKind of ['SINGLE_COW', 'GROUP'] as const) {
      const { db } = makeDb();
      const out = await feedMetricModule.compute(ctxOf(db, { scopeKind }));
      for (const id of [
        'feed.recorded_actual_kg',
        'feed.refusal_kg',
        'feed.tmr_fed_kg',
      ]) {
        const m = sec(out).metrics.find((x) => x.metricId === id);
        expect(m?.value).toEqual({ state: 'not_applicable' });
        expect(m?.rows).toBeUndefined();
      }
      expect(out.dataQuality.notes).not.toContain(
        'reports.dq.feed_farm_wide_totals',
      );
      expect(
        sec(out).metrics.find(
          (x) => x.metricId === 'feed.offered_minus_refusal_kg',
        )?.value.state,
      ).toBe('value');
    }
  });

  it('tmr_fed_kg nets voided feedings and is bound to non-voided distributions', async () => {
    const { db } = makeDb();
    db.feedDistribution.findMany.mockResolvedValue([
      { id: 'd1', totalActualKg: 20, totalRefusalKg: 1, items: [] },
    ]);
    db.feedStockMovement.findMany.mockResolvedValue([
      { changeKg: -10 },
      { changeKg: -6 },
      { changeKg: 4 },
    ]);
    const out = await feedMetricModule.compute(ctxOf(db));
    expect(
      sec(out).metrics.find((m) => m.metricId === 'feed.tmr_fed_kg')?.value,
    ).toEqual({ state: 'value', value: 12, unit: 'kg' });
    expect(db.feedStockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reason: { in: ['FED', 'ADJUSTMENT'] },
          distributionId: { in: ['d1'] },
          stock: { farmId: 'farm' },
        },
      }),
    );
  });

  it('where shapes: farm scope, voidedAt null, period bounds', async () => {
    const { db } = makeDb();
    const ctx = ctxOf(db, { includeFinance: true });
    await feedMetricModule.compute(ctx);
    const start = new Date(ctx.period.start);
    const end = new Date(ctx.period.end);
    const range = {
      gte: new Date(ctx.period.startDate),
      lte: new Date(ctx.period.endDate),
    };
    expect(db.feedDistribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          farmId: 'farm',
          voidedAt: null,
          distributedAt: { gte: start, lt: end },
        },
      }),
    );
    expect(db.feedDistributionCattleItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cattleId: { in: ['c1'] },
          voidedAt: null,
          distribution: {
            farmId: 'farm',
            voidedAt: null,
            distributedAt: { gte: start, lt: end },
          },
        },
      }),
    );
    expect(db.feedPlanFitDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { farmId: 'farm', cattleId: { in: ['c1'] }, date: range },
      }),
    );
    expect(db.milkLogEntry.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          farmId: 'farm',
          cattleId: { in: ['c1'] },
          submitted: true,
          logDate: range,
        },
      }),
    );
    expect(db.feedItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          farmId: 'farm',
          deletedAt: null,
          lowStockThreshold: { gt: 0 },
        },
      }),
    );
    expect(db.ledgerAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { farmId: 'farm', code: '5000' } }),
    );
    expect(db.journalEntry.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ledgerAccount: { farmId: 'farm', code: '5000' },
          journalTransaction: { transactionDate: { gte: start, lt: end } },
        },
      }),
    );
  });
});
