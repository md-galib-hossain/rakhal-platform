import type { MetricValue } from '../../../domain/contracts/metric-value';
import { valueOf } from '../../../domain/contracts/metric-value';
import { MAX_BREAKDOWN_ROWS } from './feed-definitions';

/** Raw rows for ONE period, as read by feed-fetch.ts. Pure input of the aggregation. */
export interface RawFeedData {
  distributions: {
    totalActualKg: number;
    totalRefusalKg: number;
    items: {
      ingredientId: string;
      ingredientName: string;
      actualKg: number;
    }[];
  }[];
  /** Non-voided cow rows only; `dayKey` is the farm-local YYYY-MM-DD of the distribution. */
  cattleItems: {
    cattleId: string;
    dayKey: string;
    offeredKg: number;
    refusalKg: number;
    costTk: number | null;
  }[];
  fitDays: {
    cattleId: string;
    date: string;
    severity: 'OK' | 'WARN' | 'BAD';
    estimated: boolean;
  }[];
  /**
   * FeedStockMovement.changeKg of non-voided distributions: FED (negative = consumed) plus the
   * compensating ADJUSTMENT rows a void writes.
   */
  fedMovementKgs: number[];
  /** Submitted milk of in-scope cows. */
  milk: { rows: number; litres: number };
  /** Ledger 5000 net; `null` = not fetched (finance not included). */
  ledgerNet: number | null;
  /** False when the farm has no ledger account 5000 (=> metric missing, not 0). */
  ledgerAccountExists: boolean;
}

export interface BreakdownRow {
  key: string;
  label: string | null;
  kg: number;
}

export interface PeriodFigures {
  actualKg: MetricValue;
  refusalKg: MetricValue;
  offeredMinusRefusalKg: MetricValue;
  distributionCost: MetricValue;
  distributionCostKnownOnly: MetricValue;
  costCoveragePct: MetricValue;
  costPerCowDay: MetricValue;
  costPerLitre: MetricValue;
  ledgerFeedSpend: MetricValue | null;
  fitOffTargetSharePct: MetricValue;
  fitEstimatedCowDays: MetricValue;
  tmrFedKg: MetricValue;
  byCow: BreakdownRow[];
  byItem: BreakdownRow[];
  /** cost rows / unknown-cost rows / distinct fed cow-days, for data quality. */
  costRows: number;
  unknownCostRows: number;
  fedCowDays: number;
  estimatedFitCowDays: number;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

function sumOrMissing(
  xs: readonly number[],
  unit: string,
  reason: string,
): MetricValue {
  return xs.length === 0
    ? { state: 'missing', reason }
    : valueOf(round2(sum(xs)), unit);
}

function topN(map: Map<string, BreakdownRow>): BreakdownRow[] {
  return Array.from(map.values())
    .map((r) => ({ ...r, kg: round2(r.kg) }))
    .sort((a, b) => b.kg - a.kg || a.key.localeCompare(b.key))
    .slice(0, MAX_BREAKDOWN_ROWS);
}

export function computePeriodFigures(raw: RawFeedData): PeriodFigures {
  const { distributions, cattleItems, fitDays } = raw;

  const actualKg = sumOrMissing(
    distributions.map((d) => d.totalActualKg),
    'kg',
    'no feed distribution recorded in period',
  );
  const refusalKg = sumOrMissing(
    distributions.map((d) => d.totalRefusalKg),
    'kg',
    'no feed distribution recorded in period',
  );
  const offeredMinusRefusalKg = sumOrMissing(
    cattleItems.map((r) => r.offeredKg - r.refusalKg),
    'kg',
    'no per-cow feeding rows in period',
  );

  const byCowMap = new Map<string, BreakdownRow>();
  for (const r of cattleItems) {
    const cur = byCowMap.get(r.cattleId) ?? {
      key: r.cattleId,
      label: null,
      kg: 0,
    };
    cur.kg += r.offeredKg - r.refusalKg;
    byCowMap.set(r.cattleId, cur);
  }
  const byItemMap = new Map<string, BreakdownRow>();
  for (const d of distributions) {
    for (const i of d.items) {
      const cur = byItemMap.get(i.ingredientId) ?? {
        key: i.ingredientId,
        label: i.ingredientName,
        kg: 0,
      };
      cur.kg += i.actualKg;
      byItemMap.set(i.ingredientId, cur);
    }
  }

  // Distribution cost: an unknown (null) costTk is never summed as 0.
  const costRows = cattleItems.length;
  const known = cattleItems.filter((r) => r.costTk !== null);
  const unknownCostRows = costRows - known.length;
  const knownSum = sum(known.map((r) => r.costTk as number));
  let distributionCost: MetricValue;
  if (costRows === 0) {
    distributionCost = {
      state: 'missing',
      reason: 'no per-cow feeding rows in period',
    };
  } else if (unknownCostRows > 0) {
    distributionCost = {
      state: 'missing',
      reason: `${unknownCostRows} of ${costRows} feeding rows have unknown cost`,
    };
  } else {
    distributionCost = valueOf(round2(knownSum), 'BDT');
  }
  const distributionCostKnownOnly: MetricValue =
    known.length === 0
      ? { state: 'missing', reason: 'no feeding rows with a known cost' }
      : valueOf(round2(knownSum), 'BDT');
  const costCoveragePct: MetricValue =
    costRows === 0
      ? { state: 'missing', reason: 'no per-cow feeding rows in period' }
      : valueOf(round2((known.length / costRows) * 100), '%');

  const fedCowDays = new Set(
    cattleItems.map((r) => `${r.cattleId}|${r.dayKey}`),
  ).size;

  const costPerCowDay: MetricValue =
    distributionCost.state === 'value' && fedCowDays > 0
      ? valueOf(round2(distributionCost.value / fedCowDays), 'BDT/cow-day')
      : {
          state: 'not_calculated',
          reason:
            distributionCost.state !== 'value'
              ? 'distribution cost is not a complete value'
              : 'no fed cow-days',
        };

  const costPerLitre: MetricValue =
    distributionCost.state === 'value' &&
    raw.milk.rows > 0 &&
    raw.milk.litres > 0
      ? valueOf(round2(distributionCost.value / raw.milk.litres), 'BDT/L')
      : {
          state: 'not_calculated',
          reason:
            distributionCost.state !== 'value'
              ? 'distribution cost is not a complete value'
              : 'no submitted milk litres for in-scope cows',
        };

  const ledgerFeedSpend: MetricValue | null =
    raw.ledgerNet === null && raw.ledgerAccountExists
      ? null
      : !raw.ledgerAccountExists
        ? { state: 'missing', reason: 'ledger account 5000 does not exist' }
        : valueOf(round2(raw.ledgerNet as number), 'BDT');

  const firm = fitDays.filter((f) => !f.estimated);
  const estimatedFitCowDays = fitDays.length - firm.length;
  const fitOffTargetSharePct: MetricValue =
    firm.length === 0
      ? { state: 'missing', reason: 'no non-estimated plan-fit days in period' }
      : valueOf(
          round2(
            (firm.filter((f) => f.severity !== 'OK').length / firm.length) *
              100,
          ),
          '%',
        );
  const fitEstimatedCowDays: MetricValue =
    fitDays.length === 0
      ? { state: 'missing', reason: 'no plan-fit days in period' }
      : valueOf(estimatedFitCowDays, 'cow-days');

  const tmrFedKg: MetricValue =
    raw.fedMovementKgs.length === 0
      ? { state: 'missing', reason: 'no FED stock movements in period' }
      : valueOf(round2(-sum(raw.fedMovementKgs) + 0), 'kg');

  return {
    actualKg,
    refusalKg,
    offeredMinusRefusalKg,
    distributionCost,
    distributionCostKnownOnly,
    costCoveragePct,
    costPerCowDay,
    costPerLitre,
    ledgerFeedSpend,
    fitOffTargetSharePct,
    fitEstimatedCowDays,
    tmrFedKg,
    byCow: topN(byCowMap),
    byItem: topN(byItemMap),
    costRows,
    unknownCostRows,
    fedCowDays,
    estimatedFitCowDays,
  };
}

export interface LowStockInput {
  id: string;
  name: string;
  unit: string;
  threshold: number;
  batchStocks: number[];
}
export interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  stock: number;
  threshold: number;
}

/** Items with threshold > 0 whose live-lot total is at or below it (dashboard convention). */
export function findLowStock(items: readonly LowStockInput[]): LowStockItem[] {
  return items
    .map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      threshold: i.threshold,
      stock: round2(sum(i.batchStocks)),
    }))
    .filter((i) => i.threshold > 0 && i.stock <= i.threshold)
    .sort((a, b) => a.stock - b.stock || a.id.localeCompare(b.id));
}

/**
 * Cows with >= minDays consecutive non-estimated off-target (WARN/BAD) days ending on the last
 * recorded day. Returns [] when `minDays` is null (constant not set).
 */
export function persistentlyOffTarget(
  days: readonly {
    cattleId: string;
    date: string;
    severity: 'OK' | 'WARN' | 'BAD';
    estimated: boolean;
  }[],
  minDays: number | null,
): string[] {
  if (minDays === null || minDays < 1) return [];
  const byCow = new Map<string, { date: string; off: boolean }[]>();
  for (const d of days) {
    if (d.estimated) continue;
    const list = byCow.get(d.cattleId) ?? [];
    list.push({ date: d.date, off: d.severity !== 'OK' });
    byCow.set(d.cattleId, list);
  }
  const out: string[] = [];
  for (const [cattleId, list] of byCow) {
    list.sort((a, b) => b.date.localeCompare(a.date));
    let run = 0;
    for (const d of list) {
      if (!d.off) break;
      run++;
    }
    if (run >= minDays) out.push(cattleId);
  }
  return out.sort();
}
