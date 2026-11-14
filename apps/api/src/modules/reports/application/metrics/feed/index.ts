import type { MetricId } from '../../../domain/contracts/metric-definition';
import {
  compareMetric,
  valueOf,
  type BreakdownRow as BreakdownRowOut,
  type MetricResult,
  type MetricValue,
} from '../../../domain/contracts/metric-value';
import type { ReportException } from '../../../domain/contracts/snapshot';
import { buildCoverage, buildDataQuality } from '../../../domain/eligibility';
import type {
  DomainMetricModule,
  DomainMetricOutput,
  MetricContext,
} from '../metric-context';
import {
  computePeriodFigures,
  findLowStock,
  persistentlyOffTarget,
  type BreakdownRow,
  type LowStockItem,
  type PeriodFigures,
} from './feed-aggregation';
import {
  DQ_FARM_WIDE_TOTALS,
  FEED_DEFINITIONS,
  PERSISTENT_OFF_TARGET_MIN_DAYS,
  SOURCE,
} from './feed-definitions';
import { fetchLowStockInputs, fetchPeriodRaw } from './feed-fetch';

const defById = new Map(FEED_DEFINITIONS.map((d) => [d.id, d]));

function metric(
  id: MetricId,
  value: MetricValue,
  source: string,
  previous: MetricValue | null,
  rows?: BreakdownRowOut[],
): MetricResult {
  return {
    metricId: id,
    value,
    source,
    comparison: previous ? compareMetric(value, previous) : null,
    ...(rows ? { rows } : {}),
    requiresPermission: defById.get(id)?.requiresPermission ?? null,
  };
}

function kgRows(
  rows: readonly BreakdownRow[],
  source: string,
): BreakdownRowOut[] {
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: valueOf(r.kg, 'kg'),
    source,
  }));
}

function periodDays(startDate: string, endDate: string): number {
  return (
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1
  );
}

function lowStockRows(items: readonly LowStockItem[]): BreakdownRowOut[] {
  return items.map((i) => ({
    key: i.id,
    label: i.name,
    value: valueOf(i.stock, i.unit),
    source: SOURCE.asOfGeneration,
  }));
}

const NOT_APPLICABLE: MetricValue = { state: 'not_applicable' };

async function compute(ctx: MetricContext): Promise<DomainMetricOutput> {
  const args = {
    db: ctx.db,
    farmId: ctx.farmId,
    timezone: ctx.timezone,
    includeFinance: ctx.includeFinance,
  };
  const [raw, prevRaw, lowInputs] = await Promise.all([
    fetchPeriodRaw({ ...args, cattleIds: ctx.cattleIds }, ctx.period),
    ctx.previousPeriod
      ? fetchPeriodRaw(
          { ...args, cattleIds: ctx.previousCattleIds },
          ctx.previousPeriod,
        )
      : Promise.resolve(null),
    fetchLowStockInputs(ctx.db, ctx.farmId),
  ]);

  const cur: PeriodFigures = computePeriodFigures(raw);
  const prev: PeriodFigures | null = prevRaw
    ? computePeriodFigures(prevRaw)
    : null;
  const lowStock = findLowStock(lowInputs);

  // Recorded totals and TMR movements are farm-wide: meaningless for a cow/group scope.
  const farmWide = ctx.scopeKind === 'ALL_ELIGIBLE';
  const fw = (v: MetricValue): MetricValue => (farmWide ? v : NOT_APPLICABLE);
  const fwPrev = (v: MetricValue | undefined): MetricValue | null =>
    farmWide ? (v ?? null) : null;

  const metrics: MetricResult[] = [
    metric(
      'feed.recorded_actual_kg',
      fw(cur.actualKg),
      SOURCE.recordedActual,
      fwPrev(prev?.actualKg),
      farmWide ? kgRows(cur.byItem, SOURCE.recordedActual) : undefined,
    ),
    metric(
      'feed.refusal_kg',
      fw(cur.refusalKg),
      SOURCE.recordedRefusal,
      fwPrev(prev?.refusalKg),
    ),
    metric(
      'feed.offered_minus_refusal_kg',
      cur.offeredMinusRefusalKg,
      SOURCE.offeredMinusRefusal,
      prev?.offeredMinusRefusalKg ?? null,
      kgRows(cur.byCow, SOURCE.offeredMinusRefusal),
    ),
  ];

  // Cost metrics are finance-gated: structurally absent (and never read) without finance.
  if (ctx.includeFinance) {
    metrics.push(
      metric(
        'feed.distribution_cost',
        cur.distributionCost,
        SOURCE.distributionCost,
        prev?.distributionCost ?? null,
      ),
      metric(
        'feed.distribution_cost_known_only',
        cur.distributionCostKnownOnly,
        SOURCE.distributionCostKnownOnly,
        prev?.distributionCostKnownOnly ?? null,
      ),
      metric(
        'feed.distribution_cost_coverage',
        cur.costCoveragePct,
        SOURCE.distributionCost,
        null,
      ),
      metric(
        'feed.cost_per_cow_day',
        cur.costPerCowDay,
        SOURCE.distributionCost,
        prev?.costPerCowDay ?? null,
      ),
      metric(
        'feed.cost_per_litre',
        cur.costPerLitre,
        SOURCE.distributionCost,
        prev?.costPerLitre ?? null,
      ),
    );
  }

  // Ledger feed spend: structurally absent unless finance is included (and was never queried).
  if (ctx.includeFinance && cur.ledgerFeedSpend) {
    metrics.push(
      metric(
        'feed.ledger_feed_spend',
        cur.ledgerFeedSpend,
        SOURCE.ledgerFeed5000,
        prev?.ledgerFeedSpend ?? null,
      ),
    );
  }

  metrics.push(
    metric(
      'feed.fit_off_target_share',
      cur.fitOffTargetSharePct,
      SOURCE.planFit,
      prev?.fitOffTargetSharePct ?? null,
    ),
    metric(
      'feed.fit_estimated_cow_days',
      cur.fitEstimatedCowDays,
      SOURCE.planFit,
      null,
    ),
    metric(
      'feed.low_stock_items',
      valueOf(lowStock.length, 'items'),
      SOURCE.asOfGeneration,
      null,
      lowStockRows(lowStock),
    ),
    metric(
      'feed.tmr_fed_kg',
      fw(cur.tmrFedKg),
      SOURCE.tmrFedMovements,
      fwPrev(prev?.tmrFedKg),
    ),
  );

  const exceptions: ReportException[] = [];
  if (lowStock.length > 0) {
    exceptions.push({
      code: 'feed.low_stock_items',
      domain: 'feed',
      messageKey: 'reports.exception.feed.low_stock_items',
    });
  }
  const persistent = persistentlyOffTarget(
    raw.fitDays,
    PERSISTENT_OFF_TARGET_MIN_DAYS,
  );
  if (persistent.length > 0) {
    exceptions.push({
      code: 'feed.persistently_off_target',
      domain: 'feed',
      messageKey: 'reports.exception.feed.persistently_off_target',
      cattleIds: persistent,
    });
  }

  const dataQuality = buildDataQuality({
    coverage: buildCoverage(
      ctx.cattleIds.length *
        periodDays(ctx.period.startDate, ctx.period.endDate),
      cur.fedCowDays,
    ),
    hasUnknownCosts: ctx.includeFinance && cur.unknownCostRows > 0,
    hasEstimatedValues: cur.estimatedFitCowDays > 0,
    scopeEmpty: ctx.cattleIds.length === 0,
  });
  // Recorded actual/refusal are farm-wide; scope is unknowable here, so flag whenever cows are in scope.
  if (farmWide && ctx.cattleIds.length > 0) {
    dataQuality.notes.push(DQ_FARM_WIDE_TOTALS);
  }

  return {
    section: {
      id: 'feed',
      domain: 'feed',
      titleKey: 'reports.section.feed',
      metrics,
    },
    exceptions,
    dataQuality,
  };
}

export const feedMetricModule: DomainMetricModule = {
  definitions: FEED_DEFINITIONS,
  compute,
};
